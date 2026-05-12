import { game } from "$lib/game-state.svelte";
import { modal } from "$lib/modal.svelte";
import type { Shape } from "$lib/types";

let pollAbort: AbortController | null = null;
let pollWakeup: (() => void) | null = null; // resolve the sleep early on stop/visibility
let consecutiveErrors = 0;
// Monotonic timestamp: tracks when state was last updated from a POST.
// GETs that started before this timestamp are stale and their state is discarded,
// preventing an in-flight GET from overwriting a fresher POST response.
let lastPostStateAt = 0;
// Guard so concurrent POSTs/polls only show the corruption modal once.
let corruptResetHandled = false;

type ApiResponse = {
	state?: import("$lib/types").State;
	poll_after_ms?: number | null;
	gameId?: string;
	error?: string;
	/** SvelteKit's `handleError` returns this in App.Error responses. */
	message?: string;
	kind?: "corrupt_reset";
};

/** Server detected corrupt state and reset. Show one modal, wipe local
 * session, stop polling. Idempotent across concurrent requests. */
function handleCorruptReset(message: string) {
	if (corruptResetHandled) return;
	corruptResetHandled = true;
	stopPolling();
	game.clearSession();
	modal.alert(message);
}

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

// Exponential backoff in ms: 500, 1000, 2000, 4000, 8000 ≈ 15s total over 6 attempts.
// Plus up to 200ms jitter per delay to avoid all clients retrying in lockstep.
const POST_RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000] as const;

function sleepWithJitter(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms + Math.random() * 200));
}

async function safeJson(res: Response): Promise<ApiResponse> {
	try {
		return (await res.json()) as ApiResponse;
	} catch (e) {
		console.error(`Failed to parse JSON from ${res.url} (status ${res.status}):`, e);
		return {};
	}
}

/** Treat any of the conventional error fields as the surfaced message. */
function errorMessageOf(data: ApiResponse): string | undefined {
	return data.error ?? data.message;
}

async function post(action: Action, body: Record<string, unknown>): Promise<string | undefined> {
	const payload = JSON.stringify({ ...body, gameId: game.gameId });
	const totalAttempts = POST_RETRY_DELAYS_MS.length + 1;
	let lastUserMessage = "Network error, please try again";

	for (let attempt = 0; attempt < totalAttempts; attempt++) {
		let res: Response;
		try {
			res = await fetch(`/api/${action}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: payload,
			});
		} catch (e) {
			// Network failure (offline, DNS, TLS, connection reset). Retry.
			console.error(
				`POST /api/${action} failed (network, attempt ${attempt + 1}/${totalAttempts}):`,
				e,
			);
			if (attempt < totalAttempts - 1) {
				await sleepWithJitter(POST_RETRY_DELAYS_MS[attempt] ?? 8000);
				continue;
			}
			return lastUserMessage;
		}

		// 410: server told us state was corrupted and has been reset. Don't retry.
		if (res.status === 410) {
			const data = await safeJson(res);
			if (data.kind === "corrupt_reset") {
				handleCorruptReset(errorMessageOf(data) ?? "The game was reset due to an internal error.");
				return undefined; // modal already shown; don't double-surface to caller
			}
			return errorMessageOf(data) ?? "The game was reset.";
		}

		// 5xx: transient (or persistent) server error. Retry with backoff.
		if (res.status >= 500) {
			lastUserMessage = `Server error (${res.status}), please try again`;
			console.error(
				`POST /api/${action} returned ${res.status} (attempt ${attempt + 1}/${totalAttempts})`,
			);
			if (attempt < totalAttempts - 1) {
				await sleepWithJitter(POST_RETRY_DELAYS_MS[attempt] ?? 8000);
				continue;
			}
			const data = await safeJson(res);
			return errorMessageOf(data) ?? lastUserMessage;
		}

		// 2xx / 4xx: definitive response (success or business-rule error). Parse.
		const data = await safeJson(res);
		if (data.kind === "corrupt_reset") {
			handleCorruptReset(errorMessageOf(data) ?? "The game was reset due to an internal error.");
			return undefined;
		}
		if (data.gameId) game.setGameId(data.gameId);
		if (data.state) {
			lastPostStateAt = Date.now();
			game.updateFromServer(data.state);
		}
		return errorMessageOf(data);
	}
	return lastUserMessage;
}

// Visible banner ("Reconnecting...") after this many consecutive poll failures.
const POLL_FAILURES_BEFORE_BANNER = 3;
// Modal explaining the connection is broken after this many. ~30–60s of pure failures.
const POLL_FAILURES_BEFORE_MODAL = 10;
// Once the modal fires we don't keep showing it on every additional failure.
let pollOutageModalShown = false;

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
				// 410 = corrupt-state reset (handled specially below); not a transport error
				if (!res.ok && res.status !== 410) throw new Error(`HTTP ${res.status}`);
				const data: ApiResponse = await res.json();
				if (data.kind === "corrupt_reset") {
					handleCorruptReset(
						errorMessageOf(data) ?? "The game was reset due to an internal error.",
					);
					break; // stopPolling already aborted the signal
				}
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
				game.connectionOk = consecutiveErrors < POLL_FAILURES_BEFORE_BANNER;
				if (consecutiveErrors >= POLL_FAILURES_BEFORE_BANNER) {
					delay = Math.min(delay * 2, 5000);
				}
				if (consecutiveErrors >= POLL_FAILURES_BEFORE_MODAL && !pollOutageModalShown) {
					pollOutageModalShown = true;
					// Fire-and-forget; the loop keeps trying behind the modal so a
					// recovering connection clears the banner as soon as it lands.
					modal.alert(
						"Can't reach the server. Check your connection — the page will keep retrying. Reload if it doesn't recover.",
					);
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
	corruptResetHandled = false;
	pollOutageModalShown = false;
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

/** Returns true if the game code is free to claim: either unused, or its
 * previous game has already ended (in which case the caller should reset it
 * before joining). Used by "Start a new game" to avoid landing strangers in
 * an active lobby. */
export async function isGameAvailable(gameId: string): Promise<boolean> {
	try {
		const res = await fetch(`/api/state?game=${gameId}`);
		if (!res.ok) {
			console.warn(`isGameAvailable(${gameId}): HTTP ${res.status} — assuming free`);
			return true; // transient — assume free
		}
		const data: ApiResponse = await res.json();
		if (!data.state) return true;
		return data.state.users.length === 0 || data.state.phase === "end";
	} catch (e) {
		console.warn(`isGameAvailable(${gameId}) failed — assuming free:`, e);
		return true;
	}
}
