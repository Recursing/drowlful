export type User = {
	img_src: string;
	username: string;
	score: number;
	lol_score: number;
	proposed_prompt: string;
	assigned_prompt: string;
};

export type Phase = "login" | "draw" | "guess" | "vote" | "lol vote" | "leaderboard" | "end";

export interface State {
	readonly users: readonly User[];
	readonly drawings: readonly Drawing[];
	readonly guesses: readonly Guess[];
	readonly votes: readonly Vote[];
	readonly lol_votes: readonly Vote[];
	readonly phase: Phase;
	readonly current_prompt: string;
	readonly lol_vote_remaining_ms?: number;
	readonly leaderboard_remaining_ms?: number;
}

export type Polyline = {
	type: "polyline";
	stroke: string;
	width: number;
	points: [number, number][];
	fill: boolean;
};

export type Ellipse = {
	type: "ellipse";
	stroke: string;
	width: number;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	fill: boolean;
};

export type Shape = Polyline | Ellipse;

export type Drawing = {
	prompt: string;
	username: string;
	shapes: Shape[];
};

export type Guess = {
	real_prompt: string;
	guessed_prompt: string;
	guesser_username: string;
};

export type Vote = {
	real_prompt: string;
	voted_prompt: string;
	voter_username: string;
};

/** State stored in KV — drawings hold only metadata, shapes stored separately */
export interface StoredState {
	users: User[];
	drawings: { prompt: string; username: string }[];
	guesses: Guess[];
	votes: Vote[];
	lol_votes: Vote[];
	phase: Phase;
	current_prompt: string;
	lol_vote_ends_at?: number;
	leaderboard_ends_at?: number;
}

export function normalizePrompt(text: string): string {
	return text
		.trim()
		.toUpperCase()
		.replace(/[.!?]$/, "");
}
