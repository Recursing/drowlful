import type { User } from './interfaces';
import { writable } from 'svelte/store';

let user_map: Map<string, User> = new Map();
export const users = writable(user_map);
export const my_username = writable("");
export const my_prompt = writable("");