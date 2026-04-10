import type { Guess, Shape, State, StoredState, User, Vote } from "$lib/types";
import { normalizePrompt } from "$lib/types";

export const GAME_TTL = 3_600_000; // 1 hour

// --- Drawing compression (brotli via built-in CompressionStream) ---
// "brotli" is supported by Deno but not yet in TS's CompressionFormat type
const BROTLI = "brotli" as CompressionFormat;

async function compressShapes(shapes: Shape[]): Promise<Uint8Array> {
	const json = new TextEncoder().encode(JSON.stringify(shapes));
	const stream = new Blob([json]).stream().pipeThrough(new CompressionStream(BROTLI));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompressShapes(data: Uint8Array): Promise<Shape[]> {
	const stream = new Blob([new Uint8Array(data)])
		.stream()
		.pipeThrough(new DecompressionStream(BROTLI));
	const json = await new Response(stream).text();
	return JSON.parse(json);
}

const IS_TEST = typeof Deno !== "undefined" && Deno.env.get("DROWLFUL_FAST_TIMERS") === "1";

// Server deadlines are intentionally longer than client-displayed timers.
// This gives players a grace period: the client timer hits 0, but the server
// still accepts actions for a few more seconds (important with global latency).
// Client displays: LOL = 3s/player, Leaderboard = 2s/player (in Progressbar.svelte)
const LOL_VOTE_MS_PER_PLAYER = IS_TEST ? 200 : 3000;
const LEADERBOARD_MS_PER_PLAYER = IS_TEST ? 200 : 3000;
// Guess/vote phases auto-advance after this deadline if not all players have acted.
// This prevents disconnected players from permanently stalling the game.
const GUESS_VOTE_DEADLINE_MS = IS_TEST ? 5000 : 120_000; // 2 min in production

// --- Game ID generation ---

const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid confusion

export function generateGameId(): string {
	return Array.from(
		{ length: 4 },
		() => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)],
	).join("");
}

// --- Initial state ---

export function createInitialState(): StoredState {
	return {
		users: [],
		drawings: [],
		guesses: [],
		votes: [],
		lol_votes: [],
		phase: "login",
		current_prompt: "",
	};
}

// --- Sattolo shuffle (no element stays in its original position) ---
// https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#Sattolo's_algorithm

function sattoloShuffle<T>(array: T[]): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * i);
		const a = array.at(i);
		const b = array.at(j);
		if (a === undefined || b === undefined) continue;
		array[j] = a;
		array[i] = b;
	}
	return array;
}

// --- Helper to find a user ---

function findUser(state: StoredState, username: string): User | undefined {
	return state.users.find((u) => u.username === username);
}

// --- Action handlers (mutate state in place, return error string or undefined) ---

export function login(
	state: StoredState,
	name: string,
	img_src: string,
	prompt: string,
): string | undefined {
	if (state.phase !== "login") {
		return `Wrong phase to login: ${state.phase}`;
	}
	for (const user of state.users) {
		if (user.username === name) {
			return `${name} name is taken, choose a different one`;
		}
		if (user.proposed_prompt === prompt) {
			return `${prompt} prompt is taken, choose a different one`;
		}
	}
	state.users.push({
		username: name,
		img_src,
		proposed_prompt: prompt,
		assigned_prompt: "",
		score: 0,
		lol_score: 0,
	});
}

export function relogin(state: StoredState, name: string): string | undefined {
	if (state.phase === "login") {
		return "Cannot relogin in login phase";
	}
	if (!state.users.some((u) => u.username === name)) {
		return `Cannot relogin as ${name}, user not found`;
	}
}

export function lateLogin(state: StoredState, name: string, img_src: string): string | undefined {
	// Late login is allowed during any active phase (spectator).
	// activePlayers() excludes late-login users from phase transition thresholds.
	if (state.phase === "login") {
		return "Game hasn't started yet, use normal login";
	}
	if (state.users.some((u) => u.username === name)) {
		return `Cannot late login as ${name}, username taken`;
	}
	state.users.push({
		username: name,
		img_src,
		proposed_prompt: "",
		assigned_prompt: "",
		score: 0,
		lol_score: 0,
	});
}

export function startGame(state: StoredState): string | undefined {
	if (state.users.length < 4) {
		return "Not enough players! Need at least 4";
	}
	if (state.phase !== "login") {
		return `Cannot start game from phase: ${state.phase}`;
	}
	const prompts = state.users.map((u) => u.proposed_prompt);
	sattoloShuffle(prompts);
	state.users.forEach((u, i) => {
		const prompt = prompts.at(i);
		if (prompt !== undefined) u.assigned_prompt = prompt;
	});
	if (state.users.some((u) => u.assigned_prompt === u.proposed_prompt)) {
		console.error("Shuffling error!");
	}
	state.phase = "draw";
}

export function submitDrawing(
	state: StoredState,
	username: string,
	prompt: string,
): string | undefined {
	const normalizedPrompt = normalizePrompt(prompt);
	if (state.phase !== "draw") {
		return `Wrong game phase for drawing: ${state.phase}`;
	}
	if (state.drawings.some((d) => d.username === username)) {
		return undefined; // Idempotent: already submitted, treat as success
	}
	state.drawings.push({ prompt: normalizedPrompt, username });
	const firstDrawing = state.drawings.at(0);
	if (state.drawings.length === state.users.length && firstDrawing) {
		state.phase = "guess";
		state.current_prompt = firstDrawing.prompt;
		state.guess_ends_at = Date.now() + GUESS_VOTE_DEADLINE_MS;
	}
}

export function submitGuess(state: StoredState, guess: Guess): string | undefined {
	const normalized: Guess = { ...guess, guessed_prompt: normalizePrompt(guess.guessed_prompt) };

	if (state.phase !== "guess") {
		return `Wrong game phase for a guess: ${state.phase}`;
	}
	if (normalized.real_prompt !== state.current_prompt) {
		return `Guessing on wrong prompt: ${normalized.real_prompt}`;
	}
	if (normalized.guessed_prompt === normalized.real_prompt) {
		return "Guess is too similar to real prompt!";
	}
	if (
		state.guesses.some(
			(g) =>
				g.real_prompt === normalized.real_prompt && g.guessed_prompt === normalized.guessed_prompt,
		)
	) {
		return "Guess is too similar to another guess!";
	}
	if (
		state.guesses.some(
			(g) =>
				g.real_prompt === normalized.real_prompt &&
				g.guesser_username === normalized.guesser_username,
		)
	) {
		return "You have already guessed!";
	}

	state.guesses.push(normalized);
	if (
		state.guesses.filter((g) => g.real_prompt === state.current_prompt).length ===
		state.users.length - 2
	) {
		state.phase = "vote";
		state.guess_ends_at = undefined;
		state.vote_ends_at = Date.now() + GUESS_VOTE_DEADLINE_MS;
	}
}

export function submitVote(state: StoredState, vote: Vote): string | undefined {
	if (state.phase !== "vote") {
		return `Wrong game phase for voting: ${state.phase}`;
	}
	if (vote.real_prompt !== state.current_prompt) {
		return `Voting on wrong prompt: ${vote.real_prompt}`;
	}
	if (
		state.votes.some(
			(v) => v.real_prompt === vote.real_prompt && v.voter_username === vote.voter_username,
		)
	) {
		return "You have already voted!";
	}

	const guess = state.guesses.find(
		(g) => g.guessed_prompt === vote.voted_prompt && g.real_prompt === vote.real_prompt,
	);

	if (guess === undefined && vote.voted_prompt !== vote.real_prompt) {
		return `Voted for unknown prompt ${vote.voted_prompt}`;
	}

	if (guess) {
		if (guess.guesser_username === vote.voter_username) {
			return "Can't vote for yourself >:[";
		}
		const user = findUser(state, guess.guesser_username);
		if (user) user.score += 100;
	} else {
		const drawing = state.drawings.find(
			(d) => d.prompt === vote.voted_prompt && vote.voted_prompt === vote.real_prompt,
		);
		if (!drawing) {
			return `Can't find drawing with prompt ${vote.voted_prompt}`;
		}
		if (drawing.username === vote.voter_username) {
			return "Can't vote for yourself >:[";
		}
		const drawer = findUser(state, drawing.username);
		if (drawer) drawer.score += 100;
		const voter = findUser(state, vote.voter_username);
		if (voter) voter.score += 100;
	}

	state.votes.push(vote);

	// All votes in for this round? Start LOL vote phase with deadline
	if (
		state.votes.filter((v) => v.real_prompt === state.current_prompt).length ===
		state.users.length - 2
	) {
		state.phase = "lol vote";
		state.vote_ends_at = undefined;
		state.lol_vote_ends_at = Date.now() + state.users.length * LOL_VOTE_MS_PER_PLAYER;
	}
}

export function submitLolVote(state: StoredState, vote: Vote): string | undefined {
	if (state.phase !== "lol vote") {
		return `Wrong game phase for lols: ${state.phase}`;
	}
	if (vote.real_prompt !== state.current_prompt) {
		return `LOL voting on wrong prompt: ${vote.real_prompt}`;
	}
	if (
		state.lol_votes.some(
			(v) =>
				v.real_prompt === vote.real_prompt &&
				v.voter_username === vote.voter_username &&
				v.voted_prompt === vote.voted_prompt,
		)
	) {
		return "Already LOL-voted for this!";
	}

	const guess = state.guesses.find(
		(g) => g.guessed_prompt === vote.voted_prompt && g.real_prompt === vote.real_prompt,
	);

	if (guess === undefined && vote.voted_prompt !== vote.real_prompt) {
		return `Voted for unknown prompt ${vote.voted_prompt}`;
	}

	if (guess) {
		if (guess.guesser_username === vote.voter_username) {
			return "Can't vote for yourself >:[";
		}
		const user = findUser(state, guess.guesser_username);
		if (user) user.lol_score += 1;
	} else {
		const votedUser = state.users.find(
			(u) => u.proposed_prompt === vote.voted_prompt && vote.real_prompt === vote.voted_prompt,
		);
		if (!votedUser) {
			return `Can't find user for prompt ${vote.voted_prompt}`;
		}
		if (votedUser.username === vote.voter_username) {
			return "Can't vote for yourself >:[";
		}
		votedUser.lol_score += 1;
	}

	state.lol_votes.push(vote);
}

export function resetGame(state: StoredState): void {
	Object.assign(state, createInitialState());
}

// --- Deadline-based phase transitions (idempotent) ---

export function checkDeadlines(state: StoredState): void {
	const now = Date.now();
	// Guess/vote deadlines: auto-advance if a disconnected player is stalling the game
	if (state.phase === "guess" && state.guess_ends_at && now >= state.guess_ends_at) {
		state.phase = "vote";
		state.guess_ends_at = undefined;
		state.vote_ends_at = Date.now() + GUESS_VOTE_DEADLINE_MS;
	} else if (state.phase === "vote" && state.vote_ends_at && now >= state.vote_ends_at) {
		state.phase = "lol vote";
		state.vote_ends_at = undefined;
		state.lol_vote_ends_at = now + state.users.length * LOL_VOTE_MS_PER_PLAYER;
	} else if (state.phase === "lol vote" && state.lol_vote_ends_at && now >= state.lol_vote_ends_at) {
		state.phase = "leaderboard";
		state.leaderboard_ends_at = now + state.users.length * LEADERBOARD_MS_PER_PLAYER;
		state.lol_vote_ends_at = undefined;
	} else if (
		state.phase === "leaderboard" &&
		state.leaderboard_ends_at &&
		now >= state.leaderboard_ends_at
	) {
		const idx = state.drawings.findIndex((d) => d.prompt === state.current_prompt);
		const next = state.drawings.at(idx + 1);
		if (idx >= 0 && next) {
			state.phase = "guess";
			state.current_prompt = next.prompt;
			state.guess_ends_at = Date.now() + GUESS_VOTE_DEADLINE_MS;
		} else {
			state.phase = "end";
		}
		state.leaderboard_ends_at = undefined;
	}
}

// --- Poll interval calculation ---

export function getPollDelay(state: StoredState): number | null {
	const now = Date.now();
	switch (state.phase) {
		case "login":
			return IS_TEST ? 200 : 3000;
		case "draw":
			return state.drawings.length >= state.users.length - 1
				? IS_TEST ? 200 : 1000
				: IS_TEST ? 400 : 5000;
		case "guess":
		case "vote":
			return IS_TEST ? 200 : 2000;
		case "lol vote":
			return state.lol_vote_ends_at
				? Math.max(IS_TEST ? 100 : 300, state.lol_vote_ends_at - now)
				: IS_TEST ? 200 : 2000;
		case "leaderboard":
			return state.leaderboard_ends_at
				? Math.max(IS_TEST ? 100 : 300, state.leaderboard_ends_at - now)
				: IS_TEST ? 200 : 2000;
		case "end":
			return null;
	}
}

// --- Build client-visible state from stored state + drawing shapes ---

export async function buildClientState(
	kv: Deno.Kv,
	gameId: string,
	state: StoredState,
): Promise<State> {
	let drawings: { prompt: string; username: string; shapes: Shape[] }[];

	if (state.phase === "end") {
		// At end phase, load ALL drawing shapes for the full recap.
		// kv.getMany supports max 10 keys, so batch if needed.
		const allEntries: (Deno.KvEntryMaybe<Uint8Array>)[] = [];
		const keys = state.drawings.map((d) => ["game", gameId, "drawing", d.username] as const);
		for (let i = 0; i < keys.length; i += 10) {
			const batch = keys.slice(i, i + 10);
			const entries = await kv.getMany<Uint8Array[]>(batch);
			allEntries.push(...entries);
		}
		drawings = await Promise.all(
			state.drawings.map(async (d, i) => {
				const compressed = allEntries.at(i)?.value;
				return { ...d, shapes: compressed ? await decompressShapes(compressed) : [] };
			}),
		);
	} else {
		const currentDrawing = state.drawings.find((d) => d.prompt === state.current_prompt);
		let currentShapes: Shape[] = [];
		if (currentDrawing) {
			const entry = await kv.get<Uint8Array>(["game", gameId, "drawing", currentDrawing.username]);
			currentShapes = entry.value ? await decompressShapes(entry.value) : [];
		}
		drawings = state.drawings.map((d) => ({
			...d,
			shapes: currentDrawing && d.username === currentDrawing.username ? currentShapes : [],
		}));
	}

	const now = Date.now();
	return {
		users: state.users,
		drawings,
		guesses: state.guesses,
		votes: state.votes,
		lol_votes: state.lol_votes,
		phase: state.phase,
		current_prompt: state.current_prompt,
		lol_vote_remaining_ms: state.lol_vote_ends_at
			? Math.max(0, state.lol_vote_ends_at - now)
			: undefined,
		leaderboard_remaining_ms: state.leaderboard_ends_at
			? Math.max(0, state.leaderboard_ends_at - now)
			: undefined,
	};
}

// --- Atomic state operations ---
// Note: withState always writes even for read-only operations (e.g. relogin).
// This is intentional — the overhead is negligible for a party game (5-12 players),
// and it keeps the code simple. checkDeadlines may also advance the phase, which
// needs to be persisted. A read-only variant isn't worth the added complexity.

export async function withState<T>(
	kv: Deno.Kv,
	gameId: string,
	fn: (state: StoredState) => T,
): Promise<{ ok: true; result: T; state: StoredState } | { ok: false; error: string }> {
	for (let attempt = 0; attempt < 10; attempt++) {
		const entry = await kv.get<StoredState>(["game", gameId, "state"]);
		const state = entry.value ?? createInitialState();
		checkDeadlines(state);

		const result = fn(state);

		const res = await kv
			.atomic()
			.check(entry)
			.set(["game", gameId, "state"], state, { expireIn: GAME_TTL })
			.commit();

		if (res.ok) {
			return { ok: true, result, state };
		}
	}
	return { ok: false, error: "Too many conflicts, try again" };
}

/** Like withState but also saves drawing shapes in the same atomic op */
export async function withStateAndDrawing(
	kv: Deno.Kv,
	gameId: string,
	username: string,
	shapes: Shape[],
	fn: (state: StoredState) => string | undefined,
): Promise<{ ok: true; state: StoredState } | { ok: false; error: string }> {
	const compressed = await compressShapes(shapes);
	if (compressed.byteLength > 60_000) {
		return { ok: false, error: "Drawing is too complex! Try removing some strokes with Undo." };
	}

	for (let attempt = 0; attempt < 10; attempt++) {
		const entry = await kv.get<StoredState>(["game", gameId, "state"]);
		const state = entry.value ?? createInitialState();
		checkDeadlines(state);

		const error = fn(state);
		if (error) return { ok: false, error };

		const res = await kv
			.atomic()
			.check(entry)
			.set(["game", gameId, "state"], state, { expireIn: GAME_TTL })
			.set(["game", gameId, "drawing", username], compressed, {
				expireIn: GAME_TTL,
			})
			.commit();

		if (res.ok) {
			return { ok: true, state };
		}
	}
	return { ok: false, error: "Too many conflicts, try again" };
}
