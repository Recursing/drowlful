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
import type { Shape } from "$lib/types";
import type { RequestHandler } from "./$types";

async function handleAction(
	gameId: string,
	fn: (state: import("$lib/types").StoredState) => string | undefined,
	extraFields?: Record<string, unknown>,
) {
	const result = await withState(kv, gameId, fn);
	if (!result.ok) return json({ error: result.error }, { status: 400 });
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
	const body = await request.json();
	const gameId: string | undefined = body.gameId;

	// Login can create a new game
	if (action === "login" && !gameId) {
		const newGameId = generateGameId();
		return handleAction(
			newGameId,
			(state) => login(state, body.username, body.img_src, body.prompt),
			{ gameId: newGameId },
		);
	}

	if (!gameId) {
		return json({ error: "Missing gameId" }, { status: 400 });
	}

	switch (action) {
		case "login":
			return handleAction(
				gameId,
				(state) => login(state, body.username, body.img_src, body.prompt),
				{ gameId },
			);

		case "relogin":
			return handleAction(gameId, (state) => relogin(state, body.username));

		case "late-login":
			return handleAction(gameId, (state) => lateLogin(state, body.username, body.img_src));

		case "start":
			return handleAction(gameId, (state) => startGame(state));

		case "drawing": {
			const shapes: Shape[] = body.shapes;
			const result = await withStateAndDrawing(kv, gameId, body.username, shapes, (state) =>
				submitDrawing(state, body.username, body.prompt),
			);
			if (!result.ok) return json({ error: result.error }, { status: 400 });
			const clientState = await buildClientState(kv, gameId, result.state);
			return json({
				state: clientState,
				poll_after_ms: getPollDelay(result.state),
			});
		}

		case "guess":
			return handleAction(gameId, (state) =>
				submitGuess(state, {
					real_prompt: body.real_prompt,
					guessed_prompt: body.guessed_prompt,
					guesser_username: body.username,
				}),
			);

		case "vote":
			return handleAction(gameId, (state) =>
				submitVote(state, {
					real_prompt: body.real_prompt,
					voted_prompt: body.voted_prompt,
					voter_username: body.username,
				}),
			);

		case "lol-vote":
			return handleAction(gameId, (state) =>
				submitLolVote(state, {
					real_prompt: body.real_prompt,
					voted_prompt: body.voted_prompt,
					voter_username: body.username,
				}),
			);

		case "reset":
			return handleAction(gameId, (state) => {
				resetGame(state);
				return undefined;
			});

		default:
			return json({ error: `Unknown action: ${action}` }, { status: 400 });
	}
};
