import { json } from "@sveltejs/kit";
import {
	buildClientState,
	CORRUPT_RESET_ERROR,
	checkDeadlines,
	GAME_TTL,
	getPollDelay,
	loadOrRecoverState,
	validateState,
} from "$lib/server/game";
import { kv } from "$lib/server/kv";
import { normalizeGameId } from "$lib/types";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const rawGameId = url.searchParams.get("game");
	const gameId = rawGameId ? normalizeGameId(rawGameId) : null;
	if (!gameId) {
		return json({ error: "Missing game parameter" }, { status: 400 });
	}

	for (let attempt = 0; attempt < 10; attempt++) {
		const loaded = await loadOrRecoverState(kv, gameId);
		if (loaded.kind === "corrupt_reset") {
			return json(
				{ error: CORRUPT_RESET_ERROR.message, kind: CORRUPT_RESET_ERROR.kind },
				{ status: 410 },
			);
		}
		const { entry, state } = loaded;
		const phaseBefore = state.phase;
		checkDeadlines(state);

		if (state.phase !== phaseBefore) {
			const invariantError = validateState(state);
			if (invariantError) {
				// checkDeadlines must produce valid state — firing here is a bug.
				console.error(
					`[GET /state] checkDeadlines produced invalid state for game=${gameId}: ${invariantError}`,
				);
				return json({ error: `Internal state error: ${invariantError}` }, { status: 500 });
			}
			const res = await kv
				.atomic()
				.check(entry)
				.set(["game", gameId, "state"], state, { expireIn: GAME_TTL })
				.commit();
			if (!res.ok) continue;
		}

		const clientState = await buildClientState(kv, gameId, state);
		return json({
			state: clientState,
			poll_after_ms: getPollDelay(state),
		});
	}

	return json({ error: "Too many conflicts" }, { status: 409 });
};
