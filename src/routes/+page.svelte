<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
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

	let userList = $derived([...game.current.users]);

	async function startGame() {
		const error = await api.startGameAction();
		if (error) modal.alert(error);
	}

	function newGame() {
		api.stopPolling();
		game.clearSession();
		replaceState('/', {});
	}

	async function leaveGame() {
		if (!(await modal.confirm('Leave the game?'))) return;
		newGame();
	}

	onMount(() => {
		// Read game ID from URL query param (e.g. ?game=XKCD from a shared link)
		const urlGame = new URLSearchParams(window.location.search).get('game');
		if (urlGame && !game.gameId) {
			game.setGameId(urlGame);
		}

		// Resume polling if we have a saved session, or start polling to discover
		// game state for the rejoin UI (e.g. navigating to ?game=XKCD as a new player)
		if (game.gameId) {
			api.startPolling();
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
</style>
