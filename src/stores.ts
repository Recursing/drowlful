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
