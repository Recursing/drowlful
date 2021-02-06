import type { User } from './interfaces';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

let user_map: Map<string, User> = new Map();
export const users = writable(user_map);
export const my_username = writable("");
export const my_prompt = writable("");

type states = "login" | "wait_start" | "draw" | "wait_drawers" | "guess"
export const game_state: Writable<states> = writable("login");