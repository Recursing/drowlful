export type User = {
  img_src: string;
  username: string;
  score: number;
  lol_score: number;
  proposed_prompt: string;
  assigned_prompt: string;
};

export interface State {
  users: User[];
  drawings: Drawing[];
  guesses: Guess[];
  votes: Vote[];
  lol_votes: Vote[];
  phase:
    | "login"
    | "draw"
    | "guess"
    | "vote"
    | "lol vote"
    | "leaderboard"
    | "end";
  current_prompt: string;
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
