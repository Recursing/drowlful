import { json } from "@sveltejs/kit";
import {
	buildClientState,
	checkDeadlines,
	createInitialState,
	GAME_TTL,
	getPollDelay,
} from "$lib/server/game";
import { kv } from "$lib/server/kv";
import type { StoredState } from "$lib/types";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const gameId = url.searchParams.get("game");
	if (!gameId) {
		return json({ error: "Missing game parameter" }, { status: 400 });
	}

	// Load state, check deadlines, save if changed
	for (let attempt = 0; attempt < 5; attempt++) {
		const entry = await kv.get<StoredState>(["game", gameId, "state"]);
		const state = entry.value ?? createInitialState();

		const phaseBefore = state.phase;
		checkDeadlines(state);

		// If deadlines changed the phase, save atomically
		if (state.phase !== phaseBefore) {
			const res = await kv
				.atomic()
				.check(entry)
				.set(["game", gameId, "state"], state, { expireIn: GAME_TTL })
				.commit();
			if (!res.ok) continue; // Conflict, retry
		}

		const clientState = await buildClientState(kv, gameId, state);
		return json({
			state: clientState,
			poll_after_ms: getPollDelay(state),
		});
	}

	return json({ error: "Too many conflicts" }, { status: 409 });
};
