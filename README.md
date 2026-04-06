# Drowlful

A multiplayer drawing party game for friends on a video call. One player draws a secret prompt, everyone else guesses what it is, then votes on the funniest fake answer.

Inspired by Drawful. Free and open source. Play at **https://drowlful.recursing.deno.net/**

## How to play

1. One player creates a game and shares the link (or 4-letter code)
2. Everyone joins, picks a name, and writes a secret prompt
3. Each player draws someone else's prompt
4. For each drawing, players guess what the prompt was
5. Everyone votes on which answer they think is real (or funniest)
6. Points for fooling others and guessing correctly

Works on any device with a browser — phones, tablets, laptops.

## Tech stack

- **SvelteKit** with **Svelte 5** runes
- **Deno Deploy** with **Deno KV** for persistence
- **HTTP polling** with server-controlled intervals
- **Brotli compression** for drawings (via built-in CompressionStream)
- **PaperCSS** for the hand-drawn aesthetic

## Development

```sh
deno install
deno task dev
```

Open http://localhost:5173

## Testing

```sh
# E2E tests (5 browsers play a full game)
npx playwright test

# Watch the browsers
npx playwright test --headed

# Play against 4 bots
deno task dev  # in one terminal
npx tsx tests/play-with-bots.ts  # in another
```

## Deploy

Push to GitHub. Deno Deploy auto-builds via the `deploy.framework: "sveltekit"` config in `deno.json`.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full technical design.
