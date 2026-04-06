/**
 * Play Drowlful against 4 automated bots.
 *
 * Usage:
 *   1. Start the dev server:  deno task dev
 *   2. Run this script:       npx tsx tests/play-with-bots.ts
 *   3. Open http://localhost:5173 in your browser, log in, and create a game
 *   4. Paste the game code when prompted
 *
 * The bots join your game automatically. Click "Everybody in!" to start!
 */

import * as readline from "node:readline";
import { chromium, type Locator, type Page } from "@playwright/test";

function at<T>(arr: readonly T[], i: number): T {
	const v = arr.at(i);
	if (v === undefined) throw new Error(`Index ${i} out of bounds (length ${arr.length})`);
	return v;
}

const BASE_URL = "http://localhost:5173";
const NUM_BOTS = 4;
const BOT_PROMPTS = [
	"A CAT RIDING A BICYCLE",
	"SUNSET OVER THE OCEAN",
	"ROBOT EATING SPAGHETTI",
	"PENGUIN WITH A TOP HAT",
];
const BOT_IMAGES = [
	"https://upload.wikimedia.org/wikipedia/en/a/a6/Pok%C3%A9mon_Pikachu_art.png",
	"https://upload.wikimedia.org/wikipedia/en/2/28/Pok%C3%A9mon_Bulbasaur_art.png",
	"https://upload.wikimedia.org/wikipedia/en/5/59/Pok%C3%A9mon_Squirtle_art.png",
	"https://img.pokemondb.net/artwork/large/charmander.jpg",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ask(question: string): Promise<string> {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim().toUpperCase());
		});
	});
}

/** Wait for one of several locators to become visible, return which one won */
async function waitForAny(
	_page: Page,
	options: { name: string; locator: Locator }[],
	timeout = 120_000,
): Promise<string> {
	return Promise.race(
		options.map(({ name, locator }) =>
			locator.waitFor({ state: "visible", timeout }).then(() => name),
		),
	);
}

async function runBot(page: Page, botIndex: number, gameCode: string) {
	const name = `Bot${botIndex + 1}`;
	console.log(`[${name}] Joining game ${gameCode}...`);

	// Login
	await page.goto(`${BASE_URL}/?game=${gameCode}`);
	await page.fill('[placeholder="Username"]', name);
	await page.fill('input[type="url"]', at(BOT_IMAGES, botIndex));
	await page.fill('[placeholder="Your prompt"]', at(BOT_PROMPTS, botIndex));
	await page.click("text=Login");
	console.log(`[${name}] Logged in`);

	// Wait for game to start (human clicks "Everybody in!")
	await page.locator("svg").or(page.getByText("THE END!")).waitFor({ timeout: 300_000 });

	// Draw phase
	if (
		await page
			.locator("svg")
			.isVisible()
			.catch(() => false)
	) {
		const doneButton = page.locator('button:has-text("Done!")');
		if (await doneButton.isVisible().catch(() => false)) {
			console.log(`[${name}] Drawing...`);
			const svg = page.locator("svg");
			const box = await svg.boundingBox();
			if (box) {
				const cx = box.x + 400,
					cy = box.y + 300;
				const r = 80 + botIndex * 30;
				const sides = 3 + botIndex; // triangle, square, pentagon, hexagon
				await page.mouse.move(cx + r, cy);
				await page.mouse.down();
				for (let j = 1; j <= sides; j++) {
					const angle = (j / sides) * Math.PI * 2;
					await page.mouse.move(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
				}
				await page.mouse.up();
			}
			page.on("dialog", (dialog: { accept: () => Promise<void> }) => dialog.accept());
			await doneButton.click();
			console.log(`[${name}] Drawing submitted`);
		}
	}

	// Game loop — react to phases until the end
	while (true) {
		const phase = await waitForAny(page, [
			{
				name: "guess",
				locator: page.locator('[placeholder="Your guess"]'),
			},
			{
				name: "guess-wait",
				locator: page.getByText("Wait for everybody to guess"),
			},
			{ name: "vote", locator: page.getByText("Pick one!") },
			{
				name: "vote-wait",
				locator: page.getByText("Wait for everybody to pick"),
			},
			{ name: "lol", locator: page.getByText("Give LOLs!") },
			{
				name: "leaderboard",
				locator: page.getByText("THE END!").or(page.locator('[placeholder="Your guess"]')),
			},
			{
				name: "draw-wait",
				locator: page.getByText("Waiting for other players to finish drawing"),
			},
		]);

		if (phase === "guess") {
			await sleep(500 + Math.random() * 2000);
			const input = page.locator('[placeholder="Your guess"]');
			if (await input.isVisible().catch(() => false)) {
				const guesses = [
					"A HAPPY DOG",
					"SPAGHETTI MONSTER",
					"THE MOON",
					"A TOASTER",
					"FISH ON A BIKE",
					"DANCING ROBOT",
					"BURNING HOUSE",
					"SAD CLOWN",
				];
				await input.fill(at(guesses, Math.floor(Math.random() * guesses.length)));
				await page.click('button:has-text("Send!")');
				console.log(`[${name}] Guess submitted`);
			}
		} else if (phase === "vote") {
			await sleep(500 + Math.random() * 1500);
			const radios = page.locator('input[type="radio"]');
			const count = await radios.count();
			if (count > 0) {
				const pick = Math.floor(Math.random() * count);
				await radios.nth(pick).click();
				await page.click('button:has-text("Send!")');
				console.log(`[${name}] Vote submitted`);
			}
		} else if (phase === "lol") {
			await sleep(300 + Math.random() * 1000);
			const buttons = page.locator('button:has-text("LOL point")');
			const count = await buttons.count();
			if (count > 0) {
				const pick = Math.floor(Math.random() * count);
				await buttons
					.nth(pick)
					.click()
					.catch(() => {});
				console.log(`[${name}] LOL vote cast`);
			}
		} else if (phase === "guess-wait" || phase === "vote-wait" || phase === "draw-wait") {
			await sleep(1000);
		} else if (phase === "leaderboard") {
			if (
				await page
					.getByText("THE END!")
					.isVisible()
					.catch(() => false)
			) {
				console.log(`[${name}] Game over!`);
				break;
			}
		}

		await sleep(200);
	}
}

async function main() {
	console.log("=== Drowlful: Play with Bots ===\n");
	console.log("1. Open http://localhost:5173 in your browser");
	console.log("2. Log in with a username, image, and prompt");
	console.log("3. After you see the game code, paste it here\n");

	const gameCode = await ask("Enter game code: ");
	if (!gameCode || gameCode.length !== 4) {
		console.error("Invalid game code. Expected 4 characters.");
		process.exit(1);
	}

	console.log(`\nLaunching 4 bots for game ${gameCode}...`);
	const browser = await chromium.launch({ headless: false });

	const botPages: Page[] = [];
	for (let i = 0; i < NUM_BOTS; i++) {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		botPages.push(page);
	}

	// Run all bots in parallel
	const botPromises = botPages.map((page, i) => runBot(page, i, gameCode));

	console.log('All bots joining... Click "Everybody in!" when ready.\n');

	// Wait for bots to finish
	await Promise.all(botPromises);

	console.log("\n=== GAME OVER ===");
	await browser.close();
	process.exit(0);
}

main().catch(console.error);
