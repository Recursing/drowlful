import type { State } from "./interfaces";
import { writable } from "svelte/store";
import type { Writable } from "svelte/store";

export const state: Writable<State> = writable({
  users: [],
  phase: "login",
  drawings: [],
  guesses: [],
  votes: [],
  lol_votes: [],
  current_prompt: "",
});

export let my_username = writable("");

state.subscribe((new_state) => {
  if (new_state.phase === "guess") {
    const previousScores: Map<string, number> = new Map();
    const previousLOLScores: Map<string, number> = new Map();
    for (let user of new_state.users) {
      previousScores.set(user.username, user.score);
      previousLOLScores.set(user.username, user.lol_score);
    }
    previousScore.set(previousScores);
    previousLOLScore.set(previousScores);
  }
});

export let previousScore: Writable<Map<string, number>> = writable(new Map());
export let previousLOLScore: Writable<Map<string, number>> = writable(
  new Map()
);
