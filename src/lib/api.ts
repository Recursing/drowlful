import { game } from "$lib/game-state.svelte";
import type { Shape } from "$lib/types";

let pollAbort: AbortController | null = null;
let pollWakeup: (() => void) | null = null; // resolve the sleep early on stop/visibility
let consecutiveErrors = 0;
// Monotonic timestamp: tracks when state was last updated from a POST.
// GETs that started before this timestamp are stale and their state is discarded,
// preventing an in-flight GET from overwriting a fresher POST response.
let lastPostStateAt = 0;

type ApiResponse = {
	state?: import("$lib/types").State;
	poll_after_ms?: number | null;
	gameId?: string;
	error?: string;
};

type Action =
	| "login"
	| "relogin"
	| "late-login"
	| "start"
	| "drawing"
	| "guess"
	| "vote"
	| "lol-vote"
	| "reset";

async function post(action: Action, body: Record<string, unknown>): Promise<string | undefined> {
	const payload = JSON.stringify({ ...body, gameId: game.gameId });
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const res = await fetch(`/api/${action}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: payload,
			});
			const data: ApiResponse = await res.json();
			if (data.gameId) game.setGameId(data.gameId);
			if (data.state) {
				lastPostStateAt = Date.now();
				game.updateFromServer(data.state);
			}
			if (data.error) return data.error;
			return undefined;
		} catch {
			if (attempt === 2) return "Network error, please try again";
			await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
		}
	}
}

/** Poll loop: fetch → wait server-specified delay → repeat. No timers to manage. */
async function pollLoop() {
	if (pollAbort) return; // already running
	pollAbort = new AbortController();
	const { signal } = pollAbort;
	let delay = 500;
	try {
		while (!signal.aborted && game.gameId) {
			try {
				const fetchStartedAt = Date.now();
				const res = await fetch(`/api/state?game=${game.gameId}`, { signal });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data: ApiResponse = await res.json();
				const fetchDuration = Date.now() - fetchStartedAt;
				consecutiveErrors = 0;
				game.connectionOk = true;
				if (data.state && fetchStartedAt >= lastPostStateAt) {
					game.updateFromServer(data.state);
				}
				if (data.poll_after_ms == null) break;
				// Adaptive: don't poll faster than the server can respond
				delay = Math.max(data.poll_after_ms, Math.min(fetchDuration, 5000));
			} catch (e) {
				if (signal.aborted) break;
				console.error("Poll failed:", e);
				consecutiveErrors++;
				game.connectionOk = consecutiveErrors < 3;
				if (consecutiveErrors >= 3) {
					delay = Math.min(delay * 2, 5000);
				}
			}
			await new Promise<void>((r) => {
				pollWakeup = r;
				setTimeout(r, delay);
			});
			pollWakeup = null;
		}
	} finally {
		pollAbort = null;
	}
}

export function startPolling() {
	consecutiveErrors = 0;
	pollLoop();
}

export function stopPolling() {
	pollAbort?.abort();
	pollWakeup?.();
}

// Re-poll immediately when tab becomes visible (recovers from backgrounded tabs)
if (typeof document !== "undefined") {
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && pollAbort && game.gameId) {
			pollWakeup?.();
		}
	});
}

// --- API methods ---

export async function login(
	username: string,
	img_src: string,
	prompt: string,
	gameId?: string,
): Promise<string | undefined> {
	if (gameId) game.setGameId(gameId);
	const error = await post("login", { username, img_src, prompt });
	if (!error) game.setUsername(username);
	return error;
}

export async function relogin(username: string, gameId: string): Promise<string | undefined> {
	game.setGameId(gameId);
	const error = await post("relogin", { username });
	if (!error) game.setUsername(username);
	return error;
}

export async function lateLogin(
	username: string,
	img_src: string,
	gameId: string,
): Promise<string | undefined> {
	game.setGameId(gameId);
	const error = await post("late-login", { username, img_src });
	if (!error) game.setUsername(username);
	return error;
}

export async function startGameAction(): Promise<string | undefined> {
	return await post("start", {});
}

export async function sendDrawing(prompt: string, shapes: Shape[]): Promise<string | undefined> {
	return await post("drawing", { username: game.myUsername, prompt, shapes });
}

export async function sendGuess(
	real_prompt: string,
	guessed_prompt: string,
): Promise<string | undefined> {
	return await post("guess", { username: game.myUsername, real_prompt, guessed_prompt });
}

export async function sendVote(
	real_prompt: string,
	voted_prompt: string,
): Promise<string | undefined> {
	return await post("vote", { username: game.myUsername, real_prompt, voted_prompt });
}

export async function sendLolVote(
	real_prompt: string,
	voted_prompt: string,
): Promise<string | undefined> {
	return await post("lol-vote", { username: game.myUsername, real_prompt, voted_prompt });
}

export async function resetGameAction(): Promise<string | undefined> {
	return await post("reset", {});
}
