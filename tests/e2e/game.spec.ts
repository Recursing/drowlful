import { expect, type Page, test } from "@playwright/test";

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

// With 200ms poll intervals in test mode, pages sync within ~400ms.
const PHASE_TIMEOUT = 3_000;
const DEADLINE_TIMEOUT = 5_000;

/**
 * Wait for ALL pages to show at least one of the given texts.
 * This ensures every browser has polled and received the current phase.
 */
async function syncAllPages(pages: Page[], ...texts: string[]) {
	const locator = (p: Page) => {
		let loc = p.getByText(texts[0]!);
		for (let i = 1; i < texts.length; i++) {
			loc = loc.or(p.getByText(texts[i]!));
		}
		return loc;
	};
	await Promise.all(pages.map((p) => locator(p).waitFor({ state: "visible", timeout: PHASE_TIMEOUT })));
}

/** Login all players, return the game code */
async function loginAllPlayers(pages: Page[]): Promise<string> {
	const p0 = at(pages, 0);
	await p0.goto("/");
	await p0.fill("#username-input", "player0");
	await p0.fill('[placeholder="e.g. A cat riding a bicycle"]', at(PROMPTS, 0));
	await p0.click("text=Ready!");

	await expect(p0.getByText(/Game code:/)).toBeVisible();
	const gameCodeText = await p0.getByText(/Game code:/).textContent();
	if (!gameCodeText) throw new Error("Game code text not found");
	const gameCode = gameCodeText.replace("Game code:", "").trim();
	console.log(`Game code: ${gameCode}`);

	// Players 1-4 join in parallel
	await Promise.all(
		Array.from({ length: NUM_PLAYERS - 1 }, (_, j) => {
			const i = j + 1;
			const page = at(pages, i);
			return (async () => {
				await page.goto(`/?game=${gameCode}`);
				await page.fill("#username-input", `player${i}`);
				await page.fill('[placeholder="e.g. A cat riding a bicycle"]', at(PROMPTS, i));
				await page.click("text=Ready!");
			})();
		}),
	);

	// Verify all players visible on all pages
	await Promise.all(
		pages.map(async (page) => {
			for (let i = 0; i < NUM_PLAYERS; i++) {
				await expect(page.getByText(`player${i}`)).toBeVisible();
			}
		}),
	);

	return gameCode;
}

async function drawPhase(pages: Page[]) {
	for (const page of pages) {
		const svg = page.locator("svg");
		await expect(svg).toBeVisible();
		const box = await svg.boundingBox();
		if (!box) throw new Error("SVG not found");
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 300);
		await page.mouse.up();
		await page.click("text=Done!");
		await page.click("text=Yes");
	}
}

/** Dismiss any open modal dialog (error alerts from previous actions) */
async function dismissModal(page: Page) {
	const dialog = page.locator("dialog[open]");
	if (await dialog.count() > 0) {
		await page.locator('dialog button:has-text("OK")').click();
	}
}

/** Submit a guess by setting the input value atomically in the browser.
 * Playwright's fill() can race with Svelte 5's $state.raw re-renders from polling:
 * a re-render between the DOM value set and the input event dispatch resets the value.
 * Using page.evaluate ensures the value set + event dispatch is one synchronous block. */
async function fillAndSubmitGuess(page: Page, guess: string) {
	await dismissModal(page);
	await page.evaluate((text) => {
		const input = document.querySelector('[placeholder="Your guess"]') as HTMLInputElement;
		if (!input) throw new Error("Guess input not found");
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
		setter.call(input, text);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}, guess);
	await page.locator('button:has-text("Send!")').click();
}

async function playRound(pages: Page[], round: number) {
	console.log(`--- Round ${round + 1} of ${NUM_PLAYERS} ---`);

	// GUESS: sync all pages, then act on guessers
	await syncAllPages(pages, "Type your guess for:", "Wait for everybody to guess");
	for (const [i, page] of pages.entries()) {
		const input = page.locator('[placeholder="Your guess"]');
		if (await input.isVisible()) {
			await fillAndSubmitGuess(page, `Guess ${i} r${round}`);
		}
	}

	// VOTE: sync all pages, then act on voters
	await syncAllPages(pages, "Pick one!", "Wait for everybody to pick");
	for (const page of pages) {
		if (await page.getByText("Pick one!").isVisible()) {
			await page.locator('input[type="radio"]').first().click();
			await page.click('button:has-text("Send!")');
		}
	}

	// LOL: sync all pages, then click LOL buttons (optional — deadline advances phase)
	await syncAllPages(pages, "Give LOLs!");
	for (const page of pages) {
		try {
			const btn = page.locator('button:has-text("LOL point")').first();
			if (await btn.isVisible({ timeout: 300 })) {
				await btn.click({ timeout: 500 });
			}
		} catch {
			// LOL button may detach during poll-triggered re-renders; deadline advances phase
		}
	}

	// Wait for ALL pages to advance past leaderboard
	await Promise.all(
		pages.map(async (p, i) => {
			try {
				await p
					.getByText("Type your guess for:")
					.or(p.getByText("Wait for everybody to guess"))
					.or(p.getByText("THE END!"))
					.waitFor({ timeout: DEADLINE_TIMEOUT });
			} catch (e) {
				const h1 = await p.locator("h1").first().textContent().catch(() => "??");
				const banner = await p.locator(".reconnecting").isVisible().catch(() => false);
				console.error(`Player ${i} stuck: h1="${h1}", reconnecting=${banner}`);
				throw e;
			}
		}),
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

	for (let round = 0; round < NUM_PLAYERS; round++) {
		await playRound(pages, round);
		for (const page of pages) {
			if (await page.getByText("THE END!").isVisible().catch(() => false)) {
				console.log("  Game ended!");
				round = NUM_PLAYERS;
				break;
			}
		}
	}

	for (const page of pages) {
		await expect(page.getByText("THE END!")).toBeVisible();
	}

	const scoreTexts: string[] = [];
	for (const page of pages) {
		const text = await page.locator(".row").first().textContent();
		scoreTexts.push(text?.replace(/\s+/g, " ").trim() ?? "");
	}
	for (let i = 1; i < scoreTexts.length; i++) {
		expect(scoreTexts[i]).toBe(scoreTexts[0]);
	}

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

	await syncAllPages(pages, "Type your guess for:", "Wait for everybody to guess");

	const p2 = at(pages, 2);
	console.log("Player 2 refreshing...");
	await p2.reload();

	await expect(
		p2.getByText("Type your guess for:").or(p2.getByText("Wait for everybody to guess")),
	).toBeVisible({ timeout: PHASE_TIMEOUT });
	await expect(p2.locator('[placeholder="e.g. A cat riding a bicycle"]')).not.toBeVisible();

	console.log("Player 2 reconnected successfully!");
	await playRound(pages, 0);

	// Verify all players are in guess phase (not stuck on leaderboard or end)
	await syncAllPages(pages, "Type your guess for:", "Wait for everybody to guess");

	console.log("Reconnection test passed!");
	for (const ctx of contexts) await ctx.close();
});

test("late-login player joins mid-game and participates", async ({ browser }) => {
	const contexts = await Promise.all(
		Array.from({ length: NUM_PLAYERS + 1 }, () => browser.newContext()),
	);
	const allPages = await Promise.all(contexts.map((ctx) => ctx.newPage()));
	const pages = allPages.slice(0, NUM_PLAYERS);
	const latePage = at(allPages, NUM_PLAYERS);

	const gameCode = await loginAllPlayers(pages);
	await at(pages, 0).click("text=Everybody in!");
	await drawPhase(pages);

	// Play round 1 with original 5 players
	await playRound(pages, 0);
	console.log("Round 1 complete, late player joining...");

	// Late player joins during round 2 guess phase
	await syncAllPages(pages, "Type your guess for:", "Wait for everybody to guess");
	await latePage.goto(`/?game=${gameCode}`);
	// The page shows the non-login rejoin UI since game is in progress
	await latePage.click("text=Login as new player");
	await latePage.fill("#username-input", "lateplayer");
	await latePage.click("text=Login as new player");

	// Late player should see the guess phase (not the login form)
	await expect(
		latePage.getByText("Type your guess for:").or(latePage.getByText("Wait for everybody to guess")),
	).toBeVisible({ timeout: PHASE_TIMEOUT });
	console.log("Late player joined successfully!");

	// Now play round 2 with all 6 players (late player participates)
	const allPlayingPages = [...pages, latePage];
	await playRound(allPlayingPages, 1);

	// Verify all 6 pages advanced past the round
	await syncAllPages(allPlayingPages, "Type your guess for:", "Wait for everybody to guess", "THE END!");

	console.log("Late-login test passed!");
	for (const ctx of contexts) await ctx.close();
});
