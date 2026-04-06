import type { State } from "$lib/types";

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

	updateFromServer(newState: State) {
		if (this.current.phase !== "guess" && newState.phase === "guess") {
			this.previousScores = new Map(newState.users.map((u) => [u.username, u.score]));
			this.previousLOLScores = new Map(newState.users.map((u) => [u.username, u.lol_score]));
		}
		this.current = newState;
		if (!newState.users.some((u) => u.username === this.myUsername)) {
			this.myUsername = "";
			saveToStorage("drowlful_username", "");
		}
	}

	setUsername(username: string) {
		this.myUsername = username;
		saveToStorage("drowlful_username", username);
	}

	setGameId(id: string) {
		this.gameId = id;
		saveToStorage("drowlful_gameId", id);
	}

	clearSession() {
		this.current = emptyState;
		this.myUsername = "";
		this.gameId = "";
		this.previousScores = new Map();
		this.previousLOLScores = new Map();
		saveToStorage("drowlful_username", "");
		saveToStorage("drowlful_gameId", "");
	}
}

export const game = new GameState();
