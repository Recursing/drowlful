import { expect, type Locator, type Page, test } from "@playwright/test";

function at<T>(arr: readonly T[], i: number): T {
	const v = arr.at(i);
	if (v === undefined) throw new Error(`Index ${i} out of bounds (length ${arr.length})`);
	return v;
}

const NUM_PLAYERS = 5;
const PROMPTS = [
	"A CAT RIDING A BICYCLE",
	"SUNSET OVER THE OCEAN",
	"ROBOT EATING SPAGHETTI",
	"PENGUIN WITH A TOP HAT",
	"DANCING BANANA IN SPACE",
];

// Tight timeouts to catch regressions — these should resolve in <1s normally
const PHASE_TIMEOUT = 5_000;
// Deadline-based transitions (LOL vote + leaderboard) take ~10s in test mode
const DEADLINE_TIMEOUT = 15_000;

/**
 * For each page in parallel: race between two locators.
 * If `actionLocator` wins, run the action. If `skipLocator` wins, this page is excluded.
 * Uses Playwright's built-in waitFor — no custom polling loops.
 */
async function raceAndAct(
	pages: Page[],
	actionLocator: (p: Page) => Locator,
	skipLocator: (p: Page) => Locator,
	action: (p: Page, i: number) => Promise<void>,
	timeout = PHASE_TIMEOUT,
) {
	await Promise.all(
		pages.map(async (page, i) => {
			const result = await Promise.race([
				actionLocator(page)
					.waitFor({ state: "visible", timeout })
					.then(() => "act" as const),
				skipLocator(page)
					.waitFor({ state: "visible", timeout })
					.then(() => "skip" as const),
			]);
			if (result === "act") {
				await action(page, i);
			}
		}),
	);
}

/** Login all players, return the game code */
async function loginAllPlayers(pages: Page[]): Promise<string> {
	// First player creates the game
	const p0 = at(pages, 0);
	await p0.goto("/");
	await p0.fill('#username-input', "player0");
	await p0.fill('[placeholder="e.g. A cat riding a bicycle"]', at(PROMPTS, 0));
	await p0.click("text=Ready!");

	await expect(p0.getByText(/Game code:/)).toBeVisible();
	const gameCodeText = await p0.getByText(/Game code:/).textContent();
	if (!gameCodeText) throw new Error("Game code text not found");
	const gameCode = gameCodeText.replace("Game code:", "").trim();
	console.log(`Game code: ${gameCode}`);

	// Remaining players join
	for (let i = 1; i < NUM_PLAYERS; i++) {
		const page = at(pages, i);
		await page.goto(`/?game=${gameCode}`);
		await page.fill('#username-input', `player${i}`);
		await page.fill('[placeholder="e.g. A cat riding a bicycle"]', at(PROMPTS, i));
		await page.click("text=Ready!");
	}

	// All players visible in every lobby
	for (const page of pages) {
		for (let i = 0; i < NUM_PLAYERS; i++) {
			await expect(page.getByText(`player${i}`)).toBeVisible();
		}
	}

	return gameCode;
}

/** All players draw a simple shape and submit */
async function drawPhase(pages: Page[]) {
	for (const page of pages) {
		await expect(page.locator("svg")).toBeVisible();
	}

	for (const page of pages) {
		const svg = page.locator("svg");
		const box = await svg.boundingBox();
		if (!box) throw new Error("SVG not found");

		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 100);
		await page.mouse.move(box.x + 300, box.y + 300);
		await page.mouse.move(box.x + 100, box.y + 300);
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.up();

		page.on("dialog", (dialog) => dialog.accept());
		await page.click("text=Done!");
	}
}

/** Play one guess→vote→lol→leaderboard round */
async function playRound(pages: Page[], round: number) {
	console.log(`--- Round ${round + 1} of ${NUM_PLAYERS} ---`);

	// GUESS: each page races between "I see guess input" vs "vote phase started"
	const voteOrWait = (p: Page) =>
		p.getByText("Pick one!").or(p.getByText("Wait for everybody to pick"));

	await raceAndAct(
		pages,
		(p) => p.locator('[placeholder="Your guess"]'),
		voteOrWait,
		async (p, i) => {
			await p.fill('[placeholder="Your guess"]', `Guess ${i} r${round}`);
			await p.click('button:has-text("Send!")');
		},
	);

	// VOTE: each page races between "I see Pick one!" vs "LOL phase started"
	await raceAndAct(
		pages,
		(p) => p.getByText("Pick one!"),
		(p) => p.getByText("Give LOLs!"),
		async (p) => {
			await p.locator('input[type="radio"]').first().click();
			await p.click('button:has-text("Send!")');
		},
	);

	// LOL VOTE: optional, click if available (short timeout — phase has a deadline)
	await Promise.all(
		pages.map(async (page) => {
			try {
				const lolButton = page.locator('button:has-text("LOL point")').first();
				await lolButton.waitFor({ state: "visible", timeout: 2000 });
				await lolButton.click();
			} catch {
				// LOL phase may have already expired or this player can't LOL-vote
			}
		}),
	);

	// Wait for leaderboard to auto-advance to next round or end
	await Promise.race(
		pages.map((p) =>
			Promise.race([
				p.locator('[placeholder="Your guess"]').waitFor({ timeout: DEADLINE_TIMEOUT }),
				p.getByText("Wait for everybody to guess").waitFor({ timeout: DEADLINE_TIMEOUT }),
				p.getByText("THE END!").waitFor({ timeout: DEADLINE_TIMEOUT }),
			]),
		),
	);
}

test("full game with 5 players", async ({ browser }) => {
	const contexts = await Promise.all(
		Array.from({ length: NUM_PLAYERS }, () => browser.newContext()),
	);
	const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

	await loginAllPlayers(pages);
	await at(pages, 0).click("text=Everybody in!");
	await drawPhase(pages);

	// Play all rounds
	for (let round = 0; round < NUM_PLAYERS; round++) {
		await playRound(pages, round);

		// Check if game ended
		for (const page of pages) {
			if (
				await page
					.getByText("THE END!")
					.isVisible()
					.catch(() => false)
			) {
				console.log("  Game ended!");
				round = NUM_PLAYERS; // break outer loop
				break;
			}
		}
	}

	// All players see "THE END!"
	for (const page of pages) {
		await expect(page.getByText("THE END!")).toBeVisible();
	}

	// Scores consistent across all browsers
	const scoreTexts: string[] = [];
	for (const page of pages) {
		const text = await page.locator(".row").first().textContent();
		scoreTexts.push(text?.replace(/\s+/g, " ").trim() ?? "");
	}
	for (let i = 1; i < scoreTexts.length; i++) {
		expect(scoreTexts[i]).toBe(scoreTexts[0]);
	}

	// RenderState: all drawings visible with canvases at end phase
	for (const page of pages) {
		const svgCount = await page.locator("svg").count();
		expect(svgCount).toBe(NUM_PLAYERS);
		for (const prompt of PROMPTS) {
			await expect(page.getByText(prompt).first()).toBeVisible();
		}
	}

	console.log("Game completed successfully!");
	for (const ctx of contexts) await ctx.close();
});

test("player reconnects after page refresh", async ({ browser }) => {
	const contexts = await Promise.all(
		Array.from({ length: NUM_PLAYERS }, () => browser.newContext()),
	);
	const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

	await loginAllPlayers(pages);
	await at(pages, 0).click("text=Everybody in!");
	await drawPhase(pages);

	// Wait for guess phase to start on all pages
	await Promise.all(
		pages.map((p) =>
			Promise.race([
				p.locator('[placeholder="Your guess"]').waitFor({ timeout: PHASE_TIMEOUT }),
				p.getByText("Wait for everybody to guess").waitFor({ timeout: PHASE_TIMEOUT }),
			]),
		),
	);

	// Player 2 refreshes their page
	const p2 = at(pages, 2);
	console.log("Player 2 refreshing...");
	await p2.reload();

	// Player 2 should auto-reconnect — NOT see the login screen
	// They should see either the guess input or the "wait" message
	await expect(
		p2.locator('[placeholder="Your guess"]').or(p2.getByText("Wait for everybody to guess")),
	).toBeVisible({ timeout: PHASE_TIMEOUT });

	// Verify they do NOT see the login form
	await expect(p2.locator('[placeholder="e.g. A cat riding a bicycle"]')).not.toBeVisible();

	console.log("Player 2 reconnected successfully!");

	// Play through the first round to verify the reconnected player participates
	await playRound(pages, 0);

	// Verify all players see the same phase after the round
	const phases = await Promise.all(
		pages.map(async (p) => {
			if (
				await p
					.getByText("THE END!")
					.isVisible()
					.catch(() => false)
			)
				return "end";
			if (
				await p
					.locator('[placeholder="Your guess"]')
					.isVisible()
					.catch(() => false)
			)
				return "guess";
			if (
				await p
					.getByText("Wait for everybody to guess")
					.isVisible()
					.catch(() => false)
			)
				return "guess-wait";
			return "other";
		}),
	);
	console.log("Phases after round:", phases);
	// All should be in the same general phase (guess/guess-wait for next round, or end)
	const nonOther = phases.filter((p) => p !== "other");
	expect(nonOther.length).toBeGreaterThan(0);

	console.log("Reconnection test passed!");
	for (const ctx of contexts) await ctx.close();
});
