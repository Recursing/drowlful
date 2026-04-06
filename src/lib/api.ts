import { game } from "$lib/game-state.svelte";
import type { Shape } from "$lib/types";

let pollTimer: ReturnType<typeof setTimeout> | null = null;

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
	const res = await fetch(`/api/${action}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...body, gameId: game.gameId }),
	});
	const data: ApiResponse = await res.json();
	if (data.gameId) game.setGameId(data.gameId);
	if (data.state) game.updateFromServer(data.state);
	if (data.poll_after_ms != null) schedulePoll(data.poll_after_ms);
	if (data.error) return data.error;
	return undefined;
}

async function poll() {
	if (!game.gameId) return;
	try {
		const res = await fetch(`/api/state?game=${game.gameId}`);
		const data: ApiResponse = await res.json();
		game.connectionOk = true;
		if (data.state) game.updateFromServer(data.state);
		if (data.poll_after_ms != null) {
			schedulePoll(data.poll_after_ms);
		}
	} catch (e) {
		console.error("Poll failed:", e);
		game.connectionOk = false;
		schedulePoll(5000);
	}
}

function schedulePoll(delayMs: number) {
	if (pollTimer) clearTimeout(pollTimer);
	pollTimer = setTimeout(poll, delayMs);
}

export function startPolling() {
	poll();
}

export function stopPolling() {
	if (pollTimer) {
		clearTimeout(pollTimer);
		pollTimer = null;
	}
}

// Re-poll immediately when tab becomes visible (recovers from backgrounded tabs)
if (typeof document !== "undefined") {
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && game.gameId) {
			poll();
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
