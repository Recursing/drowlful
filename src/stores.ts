import type { State } from "./interfaces";
import { writable } from "svelte/store";
import type { Writable } from "svelte/store";

export const my_username = writable("");
export const my_prompt = writable("");
export const state: Writable<State> = writable({
  users: [],
  phase: "login",
  drawings: [],
  guesses: [],
  votes: [],
});
