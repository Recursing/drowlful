<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import * as api from '$lib/api';
	import Avatar from '$lib/components/Avatar.svelte';
	import Draw from '$lib/components/Draw.svelte';
	import Guess from '$lib/components/Guess.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Progressbar from '$lib/components/Progressbar.svelte';
	import RenderState from '$lib/components/RenderState.svelte';
	import Login from '$lib/components/Login.svelte';
	import { game } from '$lib/game-state.svelte';

	let userList = $derived([...game.current.users]);

	async function startGame() {
		const error = await api.startGameAction();
		if (error) alert(error);
	}

	function newGame() {
		api.stopPolling();
		game.clearSession();
		replaceState('/', {});
	}

	onMount(() => {
		// Read game ID from URL query param (e.g. ?game=XKCD from a shared link)
		const urlGame = new URLSearchParams(window.location.search).get('game');
		if (urlGame && !game.gameId) {
			game.setGameId(urlGame.toUpperCase());
		}

		// Resume polling if we have a saved session (page refresh or URL join)
		if (game.gameId && game.myUsername) {
			api.startPolling();
		}
	});

	// Keep URL in sync with game ID
	$effect(() => {
		if (game.gameId) {
			const url = new URL(window.location.href);
			if (url.searchParams.get('game') !== game.gameId) {
				url.searchParams.set('game', game.gameId);
				replaceState(url.toString(), {});
			}
		}
	});

	onDestroy(() => {
		api.stopPolling();
	});
</script>

<div class="container">
	<div>
	{#if !game.connectionOk}
		<div class="reconnecting">Reconnecting...</div>
	{/if}
	{#if game.myUsername === ''}
		<Login />
	{:else if game.current.phase === 'login'}
		<h1 class="has-text-centered">Waiting for other players</h1>
		{#if game.gameId}
			<h2 class="has-text-centered">Game code: {game.gameId}</h2>
		{/if}
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
		{#key game.current.current_prompt}
			<Guess />
		{/key}
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
	{/if}
	</div>
</div>

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
	}
	.reconnecting {
		background: #ffe08a;
		text-align: center;
		padding: 0.5em;
		font-weight: bold;
		border-radius: 4px;
		margin-bottom: 0.5em;
	}
</style>
