# Drowlful on Deno Deploy — Architecture

## Overview

Rewrite Drowlful (multiplayer drawing party game) from Node.js/Express/Socket.IO/Svelte 3
to **SvelteKit on Deno Deploy** with **Svelte 5 runes**, **Deno KV** for persistence,
and **HTTP polling** for real-time sync.

### Why these choices

- **SvelteKit**: Since we're migrating to Svelte 5 anyway (killing the Rollup config),
  SvelteKit gives us Vite + Svelte 5 + server routes + static serving preconfigured.
  One `deno task dev`, one `deno task build`. First-class Deno Deploy support.
- **Polling over WebSocket/SSE**: The game is turn-based with human-speed interactions.
  2s latency is imperceptible in a party game. Polling means zero persistent connections,
  truly stateless server, no isolate kept alive during the 1-5 minute draw phase.
- **Deno KV**: Replaces in-memory state + JSON log files. Globally consistent,
  available across isolates, supports atomic operations for concurrent safety.

---

## Project Structure

```
drowlful/
├── deno.json                           # Deno Deploy config, unstable flags, tasks
├── package.json                        # SvelteKit + Svelte 5 deps
├── svelte.config.js                    # SvelteKit adapter config
├── vite.config.ts
├── tsconfig.json
├── static/
│   ├── favicon.png
│   └── global.css                      # Existing global styles (PaperCSS loaded via CDN in app.html)
├── src/
│   ├── app.html                        # Shell (PaperCSS CDN, global styles)
│   ├── lib/
│   │   ├── types.ts                    # Shared types (from src/interfaces.ts)
│   │   ├── game-state.svelte.ts        # Client state: $state.raw class (replaces stores.ts)
│   │   ├── api.ts                      # Client polling + fetch POST helpers
│   │   ├── shapes.ts                   # Drawing interpolation math (unchanged logic)
│   │   ├── components/
│   │   │   ├── Canvas.svelte           # All components migrated to Svelte 5 runes
│   │   │   ├── Draw.svelte
│   │   │   ├── Guess.svelte
│   │   │   ├── Leaderboard.svelte
│   │   │   ├── Progressbar.svelte
│   │   │   ├── Avatar.svelte
│   │   │   ├── SmallAvatar.svelte
│   │   │   ├── Login.svelte
│   │   │   └── RenderState.svelte
│   │   └── server/
│   │       ├── kv.ts                   # export const kv = await Deno.openKv()
│   │       ├── deno-kv.d.ts            # Ambient Deno KV type declarations for SvelteKit
│   │       └── game.ts                 # Pure game logic + KV operations + brotli compression
│   └── routes/
│       ├── +layout.ts                  # export const ssr = false (game is client-only)
│       ├── +layout.svelte              # Global CSS imports
│       ├── +page.svelte                # The game UI (replaces App.svelte)
│       └── api/
│           ├── state/+server.ts        # GET  → load state, check deadlines, respond
│           └── [action]/+server.ts     # POST → process action, save state, respond
```

### Key file mapping (old → new)

| Old file | New location | Notes |
|----------|-------------|-------|
| `src/interfaces.ts` | `src/lib/types.ts` | Add game ID, keep all existing types |
| `src/stores.ts` | `src/lib/game-state.svelte.ts` | Writable stores → `$state.raw` class |
| `src/Websocket.ts` | `src/lib/api.ts` | Socket.IO → fetch + polling |
| `src/App.svelte` | `src/routes/+page.svelte` | Svelte 5 migration |
| `src/Canvas.svelte` | `src/lib/components/Canvas.svelte` | Svelte 5 migration |
| `server/src/index.ts` | `src/routes/api/` | Express+Socket.IO → SvelteKit API routes |
| `server/src/game.ts` | `src/lib/server/game.ts` | Class singleton → pure functions |
| `public/index.html` | `src/app.html` | Remove Socket.IO CDN and Telegram widget |
| `public/global.css` | `static/global.css` | Unchanged |
| `rollup.config.js` | Deleted | Vite via SvelteKit replaces Rollup |

---

## Deno KV Schema

### Key namespacing for multiple games

Every key is prefixed with `["game", gameId]` so multiple concurrent games are isolated.
Game IDs are short uppercase codes (e.g. `"XKCD"`) for easy sharing over video call.
The game ID is also stored in the URL as `?game=XKCD` so players can share a direct link.

```
["game", gameId, "state"]                → StoredState (everything except drawing shapes)
["game", gameId, "drawing", username]    → Shape[]     (one entry per player's drawing)
```

### Why drawings are stored separately

A complex freehand drawing (15 polylines, 200 points each) can be ~40KB of JSON.
With 10 players in one state object, that's 400KB — far over KV's **64KB value limit**.

The main state stores only drawing metadata (`{ prompt, username }` per drawing).
The server fetches only the **current** drawing's shapes when building the client response —
one extra KV read. At the "end" phase, ALL drawings are loaded for the full recap
(using `kv.getMany`, max 10 drawings).

### Brotli compression for drawings

Drawing shapes are **brotli-compressed** before storage in KV using the built-in
`CompressionStream`/`DecompressionStream` APIs (Deno supports `"brotli"` as a format).
This brings typical drawings well under the 64KB KV value limit. A hard limit of
**60KB compressed** is enforced — if a drawing exceeds this, the player gets an error
asking them to simplify (remove strokes with Undo).

### StoredState (KV value at `["game", gameId, "state"]`)

```ts
interface StoredState {
  users: User[];
  drawings: { prompt: string; username: string }[];  // no shapes!
  guesses: Guess[];
  votes: Vote[];
  lol_votes: Vote[];
  phase: "login" | "draw" | "guess" | "vote" | "lol vote" | "leaderboard" | "end";
  current_prompt: string;
  lol_vote_ends_at?: number;       // absolute deadline timestamp (ms), server-only
  leaderboard_ends_at?: number;    // absolute deadline timestamp (ms), server-only
}
```

The **client-facing** `State` type (returned by `buildClientState`) replaces these with
**relative** fields: `lol_vote_remaining_ms` and `leaderboard_remaining_ms`, converted
at response time to avoid clock-skew issues.

```ts
interface State {
  // ... same fields as StoredState, but with full Drawing (including shapes) ...
  lol_vote_remaining_ms?: number;    // ms remaining, computed from server deadline
  leaderboard_remaining_ms?: number;
```

### TTL for automatic cleanup

Use KV's `expireIn` option when saving game state to auto-delete stale games after 24 hours:

```ts
const compressed = await compressShapes(shapes); // brotli via CompressionStream
await kv.atomic()
  .check(entry)
  .set(["game", gameId, "state"], state, { expireIn: 86_400_000 })
  .set(["game", gameId, "drawing", username], compressed, { expireIn: 86_400_000 })
  .commit();
```

### KV limits to keep in mind

| Limit | Value |
|-------|-------|
| Max value size | 64 KiB |
| Max key size | 2 KiB |
| Max mutations per atomic | 1000 |
| Max total atomic size | 800 KiB |
| Max keys per `getMany` | 10 |

---

## API Design

Every endpoint returns the same response shape:

```ts
{ state: State, poll_after_ms: number | null }
```

The client `State` uses **relative** remaining times (`lol_vote_remaining_ms`,
`leaderboard_remaining_ms`) rather than absolute server timestamps — this avoids
clock-skew issues between server and client. The server converts at response time
via `buildClientState()`.

On error: `{ error: string }` with HTTP 400.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/state?game=XKCD` | Poll for current state |
| `POST` | `/api/login` | Join lobby (creates game if needed) |
| `POST` | `/api/relogin` | Reconnect to existing game |
| `POST` | `/api/late-login` | Join mid-game |
| `POST` | `/api/start` | Start game (shuffle prompts) |
| `POST` | `/api/drawing` | Submit completed drawing |
| `POST` | `/api/guess` | Submit guess |
| `POST` | `/api/vote` | Vote on prompt |
| `POST` | `/api/lol-vote` | Funny vote |
| `POST` | `/api/reset` | Clear game state |

All POST bodies include `gameId`. Implemented as a single dynamic route
`src/routes/api/[action]/+server.ts` that dispatches to pure functions in `$lib/server/game.ts`.

### Request lifecycle

```
POST: withState() → Load state from KV → Check deadlines → Process action
      → Atomic save (retry on conflict, max 5) → buildClientState() → Return

GET:  Load state → Check deadlines → Save only if phase changed
      → buildClientState() → Return
```

The `withState(kv, gameId, fn)` helper encapsulates the atomic retry loop for POSTs.
A separate `withStateAndDrawing()` variant saves compressed drawing shapes in the same
atomic operation. The GET endpoint is optimized to skip the KV write if `checkDeadlines`
didn't change the phase.

### Server-controlled poll intervals

The server calculates `poll_after_ms` based on game phase and deadline proximity:

| Phase | Interval | Logic |
|-------|----------|-------|
| login | 3s | Waiting for players |
| draw (most still drawing) | 5s | Long idle period |
| draw (one player left) | 1s | Almost done |
| guess, vote | 2s | Active submissions |
| lol vote | `max(300, deadline - now)` | Poll at exact deadline |
| leaderboard | `max(300, deadline - now)` | Poll at exact deadline |
| end | `null` | Stop polling |

**Tab visibility**: When the browser tab becomes visible again (`visibilitychange` event),
an immediate poll is triggered to recover from backgrounded tabs where timers may have been throttled.

### Timer-driven phases without timers

When the last vote comes in, instead of `setTimeout`:

```ts
state.phase = "lol vote";
state.lol_vote_ends_at = Date.now() + state.users.length * LOL_VOTE_MS_PER_PLAYER;
```

#### Server vs client timer durations (grace period)

Server deadlines are intentionally **longer** than client-displayed timers.
The client timer hits 0, but the server still accepts actions for a few more seconds
(important with variable network latency).

| Phase | Client display | Server deadline |
|-------|---------------|-----------------|
| LOL vote | 3s/player | 5s/player |
| Leaderboard | 2s/player | 3s/player |

In test mode (`DROWLFUL_FAST_TIMERS=1`), these shrink to 1.2s and 0.8s/player respectively.

On the next poll after the deadline, `checkDeadlines()` advances the phase:

```ts
function checkDeadlines(state: StoredState): void {
  const now = Date.now();
  if (state.phase === "lol vote" && state.lol_vote_ends_at && now >= state.lol_vote_ends_at) {
    state.phase = "leaderboard";
    state.leaderboard_ends_at = now + state.users.length * LEADERBOARD_MS_PER_PLAYER;
    state.lol_vote_ends_at = undefined;
  }
  else if (state.phase === "leaderboard" && state.leaderboard_ends_at && now >= state.leaderboard_ends_at) {
    const idx = state.drawings.findIndex(d => d.prompt === state.current_prompt);
    const next = state.drawings[idx + 1];
    state.phase = next ? "guess" : "end";
    if (next) state.current_prompt = next.prompt;
    state.leaderboard_ends_at = undefined;
  }
}
```

`checkDeadlines` is idempotent and runs on **every** request (GET and POST).
If a GET triggers a phase change, it's saved atomically — if the save fails
(concurrent modification), no problem: the next request recalculates.

---

## Client State Management (Svelte 5)

### Shared state via `$state.raw` class

```ts
// src/lib/game-state.svelte.ts
class GameState {
  current = $state.raw<State>(emptyState);
  myUsername = $state(loadFromStorage("drowlful_username"));
  gameId = $state(loadFromStorage("drowlful_gameId"));
  previousScores = $state.raw(new Map<string, number>());
  previousLOLScores = $state.raw(new Map<string, number>());
  connectionOk = $state(true);           // tracks polling health

  updateFromServer(newState: State) { /* snapshot scores on guess transition */ }
  setUsername(username: string) { /* persists to localStorage */ }
  setGameId(id: string) { /* persists to localStorage */ }
  clearSession() { /* resets all state + localStorage */ }
}
export const game = new GameState();
```

**localStorage persistence**: `myUsername` and `gameId` are persisted to localStorage
so refreshing the page or reopening the tab can auto-reconnect (via relogin).
Wrapped in try/catch for SSR and private browsing safety.

**`connectionOk`**: Set to `false` when a poll fails (network error), `true` on success.
Used by the UI to show a connection warning.

**Why `$state.raw`**: We always replace the entire state object from the API response,
never mutate it. `$state.raw` skips deep proxying — better performance for large
objects that are only reassigned.
(See: [Svelte 5 best practices](https://svelte.dev/docs/svelte/best-practices/llms.txt))

### Components use `$derived` for computed values

```svelte
<script lang="ts">
  import { game } from '$lib/game-state.svelte';
  let myUser = $derived(game.current.users.find(u => u.username === game.myUsername));
  let sortedUsers = $derived([...game.current.users].sort((a, b) =>
    (b.score + b.lol_score) - (a.score + a.lol_score)));
</script>
```

---

## Svelte 3 → 5 Migration Cheatsheet

| Svelte 3 | Svelte 5 | Notes |
|----------|----------|-------|
| `export let prop` | `let { prop }: Props = $props()` | |
| `export let prop` (with `bind:`) | `let { prop = $bindable() } = $props()` | Canvas `shapes` prop |
| `$: x = expr` | `let x = $derived(expr)` | Use `$derived.by(() => { ... })` for complex logic |
| `on:click={fn}` | `onclick={fn}` | All `on:` directives |
| `on:click\|once` | Manual boolean guard in handler | No event modifiers in Svelte 5 |
| `on:keyup={fn}` | `onkeyup={fn}` | |
| `<svelte:window on:keydown>` | `<svelte:window onkeydown>` | |
| `writable(val)` / `$store` | `$state(val)` in `.svelte.ts` / direct access | |
| `onMount(() => {...})` | Still works, or use `$effect` | |
| `tweened()` from svelte/motion | Still works (returns store-compatible object) | `$tween_value` still works |
| `class:name={cond}` | Still works | Best practice prefers clsx-style, but directive is fine |

### Key gotchas

- **`$state` only works in `.svelte` and `.svelte.ts` files** (processed by Svelte compiler).
- **`$derived` takes an expression, not a function**. Use `$derived.by(fn)` for multi-line.
- **Stores still work** in Svelte 5. `tweened()` returns a store; the `$` prefix auto-subscribes.
- **No `|once` modifier** — use a boolean flag or `{ once: true }` on addEventListener.

---

## Game Logic Considerations

### Concurrency (atomic operations)

Two players might vote simultaneously. Both read the same state, modify it, try to save.
Use KV atomic operations with `check()` for optimistic concurrency.
This is encapsulated in the `withState()` helper:

```ts
async function withState<T>(kv, gameId, fn: (state) => T) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const entry = await kv.get(["game", gameId, "state"]);
    const state = entry.value ?? createInitialState();
    checkDeadlines(state);
    const result = fn(state);  // mutates state in place
    const res = await kv.atomic()
      .check(entry)  // fails if state was modified since read
      .set(["game", gameId, "state"], state, { expireIn: GAME_TTL })
      .commit();
    if (res.ok) return { ok: true, result, state };
  }
  return { ok: false, error: "Too many conflicts" };
}
```

A `withStateAndDrawing()` variant saves brotli-compressed drawing shapes
in the same atomic operation (state + drawing in one commit).

### No disconnect detection

With polling, there's no "disconnect" event. A player who closes their tab during
login phase becomes a ghost. The host can use the **reset endpoint** to clear the lobby.

**Late login** is restricted to `leaderboard` or `end` phases only — joining mid-round
(during guess/vote/lol vote) would inflate `users.length` and break phase transitions
that depend on it (e.g. `guesses.length === users.length - 2`).

### Drawing robustness

- **3px distance filter**: `Canvas.svelte` skips mouse points within 3px of the last,
  reducing data size by 5-10x with no visual impact.
- **Brotli compression**: Drawings are compressed before KV storage (see above).
- **Idempotent submission**: Re-submitting the same drawing (e.g. network timeout on
  first attempt) returns success instead of "already submitted" error.
- **Size limit**: Compressed drawings over 60KB are rejected with a clear error.

### Prompt normalization

All prompts are normalized (trim, uppercase, strip trailing punctuation) via `normalizePrompt()`
in `$lib/types.ts`. This prevents near-duplicate prompts and guesses from slipping through
(e.g. "A Cat" vs "a cat!" are treated as the same prompt).

### Sattolo shuffle

The existing shuffle (assigns prompts so no one draws their own) is correct and should
be preserved exactly. Reference: `server/src/game.ts:61-69`.

### Scoring logic

Preserve exactly from `server/src/index.ts:192-224` (vote scoring) and
`server/src/index.ts:260-303` (LOL vote scoring). The logic is subtle
(self-vote prevention, drawer vs guesser scoring).

### Game ID generation

Short uppercase codes for in-person sharing. 4 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ`
(no I/O to avoid confusion) gives 234,256 combinations — plenty for a party game.

```ts
function generateGameId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
```

---

## Testing Strategy

### E2E tests (`tests/e2e/game.spec.ts`)

Two Playwright tests, run with `npx playwright test` (or `--headed` to watch):

1. **Full game with 5 players** — login, draw, 5 rounds of guess/vote/lol/leaderboard, end.
   Verifies score consistency across all browsers.
2. **Player reconnects after page refresh** — player 2 reloads mid-guess, auto-reconnects
   via localStorage, participates in the round.

**`Promise.race` pattern** (no flaky retries): Each page races between "I see my action
input" (I'm a participant) and "I see the next phase" (I was excluded). Excluded players
resolve instantly. Tight timeouts (5s for phase UI, 15s for deadline transitions) catch
regressions. `retries: 0` in config — if a test fails, it's a real bug.

**Fast timers** (`DROWLFUL_FAST_TIMERS=1`): Server deadlines and poll intervals shrink
so tests complete in ~1 minute instead of 10+ minutes.

### Play with bots (`tests/play-with-bots.ts`)

Interactive script: you play in your browser while 4 headless Playwright bots join.
Run `npx tsx tests/play-with-bots.ts`, paste your game code, and the bots auto-play.

### Visual regression fixtures

`tests/fixtures/game-states.json` — game states for every phase with 4 players and
realistic Shape arrays. Can be injected to screenshot each phase for visual comparison.

---

## Build & Deploy

### SvelteKit scaffolding

```sh
deno run -A npm:sv create drowlful   # skeleton project, TypeScript
deno install
```

### deno.json

```jsonc
{
  "unstable": ["kv"],
  "deploy": {
    "framework": "sveltekit"
  }
}
```

### SSR disabled

```ts
// src/routes/+layout.ts
export const ssr = false;
```

The game is a client-only SPA. No SEO, no server-rendered content.

### Deno types in server code

Server-only files (`src/lib/server/*.ts`, `src/routes/api/**/*.ts`) use `Deno.openKv()`.
Deno's global types are provided via an ambient declaration file at
`src/lib/server/deno-kv.d.ts` which declares the `Deno` namespace with KV types,
avoiding conflicts with SvelteKit's TypeScript config.

---

## External Documentation

| Topic | URL |
|-------|-----|
| Svelte 5 best practices | https://svelte.dev/docs/svelte/best-practices/llms.txt |
| SvelteKit on Deno tutorial | https://docs.deno.com/examples/svelte_tutorial/ |
| Deno KV API | https://docs.deno.com/deploy/kv/ |
| KV operations reference | https://docs.deno.com/deploy/kv/operations |
| KV transactions (atomic) | https://docs.deno.com/deploy/kv/transactions |
| KV key expiration (TTL) | https://docs.deno.com/deploy/kv/key_expiration |
| Deno Deploy runtime | https://docs.deno.com/deploy/reference/runtime |
| Deno Deploy builds | https://docs.deno.com/deploy/reference/builds |
| Deno.serve HTTP server | https://docs.deno.com/runtime/fundamentals/http_server |
