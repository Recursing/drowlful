import { json } from "@sveltejs/kit";
import {
	buildClientState,
	generateGameId,
	getPollDelay,
	lateLogin,
	login,
	relogin,
	resetGame,
	startGame,
	submitDrawing,
	submitGuess,
	submitLolVote,
	submitVote,
	withState,
	withStateAndDrawing,
} from "$lib/server/game";
import { kv } from "$lib/server/kv";
import {
	ValidationError,
	validateImgSrc,
	validatePrompt,
	validateShapes,
	validateUsername,
} from "$lib/server/validate";
import { normalizeGameId } from "$lib/types";
import type { RequestHandler } from "./$types";

async function handleAction(
	gameId: string,
	fn: (state: import("$lib/types").StoredState) => string | undefined,
	extraFields?: Record<string, unknown>,
) {
	const result = await withState(kv, gameId, fn);
	if (!result.ok) {
		const status = result.kind === "corrupt_reset" ? 410 : 400;
		return json({ error: result.error, kind: result.kind }, { status });
	}
	if (result.result) return json({ error: result.result }, { status: 400 });
	const clientState = await buildClientState(kv, gameId, result.state);
	return json({
		...extraFields,
		state: clientState,
		poll_after_ms: getPollDelay(result.state),
	});
}

export const POST: RequestHandler = async ({ params, request }) => {
	const { action } = params;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: "Invalid JSON body" }, { status: 400 });
	}
	if (body === null || typeof body !== "object") {
		return json({ error: "Body must be a JSON object" }, { status: 400 });
	}

	try {
		const rawGameId = body.gameId;
		const gameId: string | undefined =
			typeof rawGameId === "string" && rawGameId.length > 0
				? normalizeGameId(rawGameId)
				: undefined;

		// Login can create a new game
		if (action === "login" && !gameId) {
			const username = validateUsername(body.username);
			const img_src = validateImgSrc(body.img_src);
			const prompt = validatePrompt(body.prompt);
			const newGameId = generateGameId();
			return await handleAction(newGameId, (state) => login(state, username, img_src, prompt), {
				gameId: newGameId,
			});
		}

		if (!gameId) {
			return json({ error: "Missing gameId" }, { status: 400 });
		}

		switch (action) {
			case "login": {
				const username = validateUsername(body.username);
				const img_src = validateImgSrc(body.img_src);
				const prompt = validatePrompt(body.prompt);
				return await handleAction(
					gameId,
					(state) => {
						// Recycle: a finished game's KV entry should not block a fresh lobby
						// reusing the same code. Atomic with the login itself, so concurrent
						// logins all see the recycled phase on retry.
						if (state.phase === "end") resetGame(state);
						return login(state, username, img_src, prompt);
					},
					{ gameId },
				);
			}

			case "relogin": {
				const username = validateUsername(body.username);
				return await handleAction(gameId, (state) => relogin(state, username));
			}

			case "late-login": {
				const username = validateUsername(body.username);
				const img_src = validateImgSrc(body.img_src);
				return await handleAction(gameId, (state) => lateLogin(state, username, img_src));
			}

			case "start":
				return await handleAction(gameId, (state) => startGame(state));

			case "drawing": {
				const username = validateUsername(body.username);
				const prompt = validatePrompt(body.prompt);
				const shapes = validateShapes(body.shapes);
				const result = await withStateAndDrawing(kv, gameId, username, shapes, (state) =>
					submitDrawing(state, username, prompt),
				);
				if (!result.ok) {
					const status = result.kind === "corrupt_reset" ? 410 : 400;
					return json({ error: result.error, kind: result.kind }, { status });
				}
				const clientState = await buildClientState(kv, gameId, result.state);
				return json({
					state: clientState,
					poll_after_ms: getPollDelay(result.state),
				});
			}

			case "guess": {
				const username = validateUsername(body.username);
				const real_prompt = validatePrompt(body.real_prompt);
				const guessed_prompt = validatePrompt(body.guessed_prompt);
				return await handleAction(gameId, (state) =>
					submitGuess(state, {
						real_prompt,
						guessed_prompt,
						guesser_username: username,
					}),
				);
			}

			case "vote": {
				const username = validateUsername(body.username);
				const real_prompt = validatePrompt(body.real_prompt);
				const voted_prompt = validatePrompt(body.voted_prompt);
				return await handleAction(gameId, (state) =>
					submitVote(state, {
						real_prompt,
						voted_prompt,
						voter_username: username,
					}),
				);
			}

			case "lol-vote": {
				const username = validateUsername(body.username);
				const real_prompt = validatePrompt(body.real_prompt);
				const voted_prompt = validatePrompt(body.voted_prompt);
				return await handleAction(gameId, (state) =>
					submitLolVote(state, {
						real_prompt,
						voted_prompt,
						voter_username: username,
					}),
				);
			}

			case "reset":
				return await handleAction(gameId, (state) => {
					resetGame(state);
					return undefined;
				});

			default:
				return json({ error: `Unknown action: ${action}` }, { status: 400 });
		}
	} catch (e) {
		if (e instanceof ValidationError) {
			return json({ error: e.message }, { status: 400 });
		}
		throw e;
	}
};
