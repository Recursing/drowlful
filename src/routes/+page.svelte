<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import * as api from '$lib/api';
	import Avatar from '$lib/components/Avatar.svelte';
	import Draw from '$lib/components/Draw.svelte';
	import Guess from '$lib/components/Guess.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Login from '$lib/components/Login.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Progressbar from '$lib/components/Progressbar.svelte';
	import RenderState from '$lib/components/RenderState.svelte';
	import { game } from '$lib/game-state.svelte';
	import { modal } from '$lib/modal.svelte';
	import { generateGameId, normalizeGameId } from '$lib/types';

	let userList = $derived([...game.current.users]);

	async function startGame() {
		const error = await api.startGameAction();
		if (error) modal.alert(error);
	}

	function newGame() {
		api.stopPolling();
		game.clearSession();
	}

	async function leaveGame() {
		if (!(await modal.confirm('Leave the game?'))) return;
		newGame();
	}

	async function startNewGame() {
		api.stopPolling();
		game.clearSession();
		// Probe a few codes to avoid landing in an already-active lobby.
		// Best-effort: TOCTOU race is possible but harmless at party-game scale.
		// When the code maps to an already-finished game, the server recycles it
		// atomically on the first login (see [action]/+server.ts), so no client-side
		// reset POST is needed — avoiding a race with concurrent logins.
		let id = generateGameId();
		for (let attempt = 0; attempt < 10; attempt++) {
			if (await api.isGameAvailable(id)) break;
			id = generateGameId();
		}
		game.setGameId(id);
		api.startPolling();
	}

	onMount(() => {
		// URL is the source of truth for which game we're in.
		const urlGame = normalizeGameId(
			new URLSearchParams(window.location.search).get('game') ?? ''
		);
		if (!urlGame) {
			// No game in URL — drop any stale session and show the "game code required" screen.
			if (game.gameId || game.myUsername) game.clearSession();
			return;
		}
		if (urlGame !== game.gameId) {
			// URL game code wins over any stale localStorage session
			game.clearSession();
			game.setGameId(urlGame);
		}
		api.startPolling();
	});

	onDestroy(() => {
		api.stopPolling();
	});
</script>

<div class="container">
	<div>
	{#if !game.gameId}
		<div class="landing">
			<svg width="0" height="0" style="position:absolute" aria-hidden="true">
				<filter id="jaggedFilter">
					<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
					<feDisplacementMap in="SourceGraphic" scale="2.5" />
				</filter>
			</svg>
			<h1 class="landing-title">
				{#each 'Drowlful'.split('') as ch, i (i)}
					<span style="--i:{i}">{ch}</span>
				{/each}
			</h1>
			<div class="landing-card">
				<div class="landing-badge">Game code required</div>
				<p class="landing-hint">
					Drowlful games live at <code>?game=XXXX</code>. Open the link a friend shared with you,
					or start a brand-new game below.
				</p>
				<button class="landing-btn" onclick={startNewGame}>Start a new game</button>
			</div>
		</div>
	{:else if !game.connectionOk}
		<div class="reconnecting">Reconnecting...</div>
	{/if}
	{#if game.gameId}
		{#if game.myUsername === ''}
			<Login />
		{:else if game.current.phase === 'login'}
			<h1 class="has-text-centered">Waiting for other players</h1>
			<h2 class="has-text-centered">Game code: {game.gameId}</h2>
			<div class="centered-flex">
				{#each userList as user (user.username)}
					<Avatar {user} />
				{/each}
			</div>
			<button class="centered-flex" onclick={startGame} disabled={userList.length < 4}>
				Everybody in!
			</button>
			<button class="centered-flex leave-btn" onclick={newGame}>New Game</button>
		{:else if game.current.phase === 'draw'}
			{#if game.current.drawings.some((d) => d.username === game.myUsername)}
				<h1 class="has-text-centered">
					Waiting for other players to finish drawing, got:
				</h1>
				<div class="centered-flex">
					{#each game.current.drawings as drawing (drawing.username)}
						<Avatar user={game.current.users.find((u) => u.username === drawing.username)} />
					{/each}
				</div>
				<h1 class="has-text-centered">Waiting for:</h1>
				<div class="centered-flex">
					{#each game.current.users.filter((u) => !game.current.drawings.some((d) => d.username === u.username)) as user (user.username)}
						<Avatar {user} />
					{/each}
				</div>
			{:else}
				<h1 class="has-text-centered">Let's draw!</h1>
				<Draw />
			{/if}
		{:else if game.current.phase === 'guess' || game.current.phase === 'vote' || game.current.phase === 'lol vote'}
			<Guess />
		{:else if game.current.phase === 'leaderboard' || game.current.phase === 'end'}
			<Leaderboard />
			{#if game.current.phase === 'end'}
				<RenderState state={game.current} />
				<button class="centered-flex" onclick={newGame}>New Game</button>
			{/if}
		{:else}
			<h1 class="has-text-centered">Unknown phase: {game.current.phase}</h1>
		{/if}

		{#if game.myUsername !== ''}
			<Progressbar />
			{#if game.current.phase !== 'login' && game.current.phase !== 'end'}
				<button class="centered-flex leave-btn" onclick={leaveGame}>Leave Game</button>
			{/if}
		{/if}
	{/if}
	</div>
</div>
<Modal />

<style>
	.container {
		margin-left: auto;
		margin-right: auto;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.leave-btn {
		opacity: 0.5;
		font-size: 0.8em;
		margin-top: 2em;
	}
	.reconnecting {
		background: #ffe08a;
		text-align: center;
		padding: 0.5em;
		font-weight: bold;
		border-radius: 4px;
		margin-bottom: 0.5em;
	}

	.landing {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2em;
		padding: 2em 1em;
		text-align: center;
	}
	.landing-title {
		font-size: clamp(3rem, 10vw, 6rem);
		margin: 0;
		letter-spacing: -0.02em;
		transform: rotate(-2deg);
		filter: url(#jaggedFilter);
		display: inline-flex;
	}
	.landing-title span {
		display: inline-block;
		text-shadow:
			3px 3px 0 #ffd23f,
			5px 5px 0 #1f1f1f;
		transform: rotate(calc((var(--i) * 37deg - 110deg) * 0.02))
			translateY(calc(sin(var(--i) * 1.3) * 2px));
	}
	.landing-title span:nth-child(odd) {
		transform: rotate(calc((var(--i) * 53deg + 50deg) * -0.025))
			translateY(calc(sin(var(--i) * 1.7) * -1.5px));
	}
	/* The 'u' (index 6) was tilting too much — flatten it */
	.landing-title span:nth-child(7) {
		transform: rotate(0.5deg) translateY(1px);
	}
	.landing-card {
		max-width: 32rem;
		width: 100%;
		padding: 2em 1.75em;
		background: #fffdf7;
		border: 2px solid #1f1f1f;
		border-radius: 6px;
		box-shadow: 6px 6px 0 #1f1f1f;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25em;
	}
	.landing-badge {
		display: inline-block;
		padding: 0.4em 0.9em;
		background: #ff595e;
		color: #fff;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		border-radius: 999px;
		transform: rotate(-1.5deg);
		box-shadow: 2px 2px 0 #1f1f1f;
	}
	.landing-hint {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.55;
		color: #333;
	}
	.landing-hint code {
		background: #fff3a3;
		padding: 0.1em 0.4em;
		border-radius: 3px;
		font-size: 0.95em;
	}
	.landing-btn {
		margin: 0;
		font-weight: 700;
	}
</style>
