import { replaceState } from "$app/navigation";
import { normalizeGameId, type State } from "$lib/types";

const emptyState: State = {
	users: [],
	drawings: [],
	guesses: [],
	votes: [],
	lol_votes: [],
	phase: "login",
	current_prompt: "",
};

function loadFromStorage(key: string): string {
	try {
		return localStorage.getItem(key) ?? "";
	} catch {
		return "";
	}
}

function saveToStorage(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// localStorage unavailable (SSR, private browsing quota)
	}
}

class GameState {
	current = $state.raw<State>(emptyState);
	myUsername = $state(loadFromStorage("drowlful_username"));
	gameId = $state(loadFromStorage("drowlful_gameId"));
	previousScores = $state.raw(new Map<string, number>());
	previousLOLScores = $state.raw(new Map<string, number>());
	connectionOk = $state(true);

	private lastStateJson = "";

	updateFromServer(newState: State) {
		const json = JSON.stringify(newState);
		if (json === this.lastStateJson) return;
		this.lastStateJson = json;
		if (this.current.phase !== "guess" && newState.phase === "guess") {
			this.previousScores = new Map(newState.users.map((u) => [u.username, u.score]));
			this.previousLOLScores = new Map(newState.users.map((u) => [u.username, u.lol_score]));
		}
		this.current = newState;
		if (this.myUsername && !newState.users.some((u) => u.username === this.myUsername)) {
			// User was removed or game expired — clear the whole session
			this.myUsername = "";
			this.gameId = "";
			saveToStorage("drowlful_username", "");
			saveToStorage("drowlful_gameId", "");
		}
	}

	setUsername(username: string) {
		this.myUsername = username;
		saveToStorage("drowlful_username", username);
	}

	setGameId(id: string) {
		id = normalizeGameId(id);
		if (this.gameId === id) return;
		this.gameId = id;
		saveToStorage("drowlful_gameId", id);
		try {
			const url = new URL(window.location.href);
			if (id) {
				if (url.searchParams.get("game") !== id) {
					url.searchParams.set("game", id);
					replaceState(url.toString(), {});
				}
			} else if (url.searchParams.has("game")) {
				url.searchParams.delete("game");
				replaceState(url.toString(), {});
			}
		} catch {
			// Router not ready during initial hydration
		}
	}

	clearSession() {
		this.current = emptyState;
		this.lastStateJson = "";
		this.myUsername = "";
		this.gameId = "";
		this.previousScores = new Map();
		this.previousLOLScores = new Map();
		saveToStorage("drowlful_username", "");
		saveToStorage("drowlful_gameId", "");
	}
}

export const game = new GameState();
