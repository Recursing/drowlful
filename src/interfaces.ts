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
  phase: "login" | "draw" | "guess";
}

export type Line = {
  stroke: string;
  width: number;
  points: string;
};

export type Drawing = {
  prompt: string;
  username: string;
  lines: Line[];
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
