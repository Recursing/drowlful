<script lang="ts">
	import * as api from '$lib/api';
	import { game } from '$lib/game-state.svelte';
	import { modal } from '$lib/modal.svelte';
	import { normalizePrompt } from '$lib/types';

	let username = $state('');
	let prompt = $state('');

	const default_images = [
		'https://upload.wikimedia.org/wikipedia/en/a/a6/Pok%C3%A9mon_Pikachu_art.png',
		'https://upload.wikimedia.org/wikipedia/en/2/28/Pok%C3%A9mon_Bulbasaur_art.png',
		'https://upload.wikimedia.org/wikipedia/en/5/59/Pok%C3%A9mon_Squirtle_art.png',
		'https://img.pokemondb.net/artwork/large/charmander.jpg',
		'https://upload.wikimedia.org/wikipedia/en/2/22/Pok%C3%A9mon_Jigglypuff_art.png',
		'https://img.pokemondb.net/artwork/large/meowth.jpg',
		'https://upload.wikimedia.org/wikipedia/en/a/a9/Pok%C3%A9mon_Eevee_art.png',
		'https://img.pokemondb.net/artwork/large/lapras.jpg',
		'https://img.pokemondb.net/artwork/large/chikorita.jpg',
		'https://img.pokemondb.net/artwork/large/pichu.jpg',
		'https://img.pokemondb.net/artwork/large/togepi.jpg',
		'https://img.pokemondb.net/artwork/large/mudkip.jpg'
	];

	function pickRandomImage() {
		return default_images[Math.floor(Math.random() * default_images.length)] ?? '';
	}

	let img_src = pickRandomImage();

	async function onLogin() {
		if (!prompt || !username || !img_src) return;
		const error = await api.login(username, img_src, normalizePrompt(prompt), game.gameId || undefined);
		if (error) { modal.alert(error); return; }
		api.startPolling();
	}

	async function doRelogin() {
		if (!username || !game.gameId) return;
		const error = await api.relogin(username, game.gameId);
		if (error) { modal.alert(error); return; }
		api.startPolling();
	}

	async function doLateLogin() {
		if (!username || !img_src || !game.gameId) return;
		const error = await api.lateLogin(username, img_src, game.gameId);
		if (error) { modal.alert(error); return; }
		api.startPolling();
	}

	let login_type = $state<'login' | 'relogin' | 'late login'>('login');
</script>

{#if game.current.phase === 'login'}
	<div class="row top-row">
		<div class="col sm-4">
			<div class="form-group">
				<label for="game-code-input">Game Code (empty = new game)</label>
				<input
					id="game-code-input"
					bind:value={game.gameId}
					class="input-block"
					type="text"
					placeholder="ABCD"
					maxlength="4"
				/>
			</div>
		</div>
		<div class="col sm-4">
			<div class="form-group">
				<label for="username-input">Name</label>
				<input
					id="username-input"
					bind:value={username}
					class="input-block"
					type="text"
					required
				/>
			</div>
		</div>
	</div>
	<div class="form-group has-text-centered">
		<label for="prompt-input">Prompt (someone else will draw this)</label>
		<textarea
			id="prompt-input"
			bind:value={prompt}
			class="prompt-input"
			placeholder="e.g. A cat riding a bicycle"
			rows="4"
			onkeydown={(key: KeyboardEvent) => { if (key.code === 'Enter' && !key.shiftKey) { key.preventDefault(); onLogin(); } }}
			required
		></textarea>
	</div>
	<button onclick={onLogin} class="ready-btn btn-block" disabled={!username || !prompt}>Ready!</button>
{:else if login_type === 'login'}
	<div class="row">
		<div class="col sm-4">
			<div class="form-group">
				<label for="game-code-rejoin">Game Code</label>
				<input
					id="game-code-rejoin"
					bind:value={game.gameId}
					class="input-block"
					type="text"
					placeholder="ABCD"
					maxlength="4"
				/>
			</div>
		</div>
	</div>
	<div class="centered-flex">
		<button onclick={() => (login_type = 'late login')}> Login as new player </button>
		<button onclick={() => (login_type = 'relogin')}> Login as existing player </button>
	</div>
{:else if login_type === 'late login'}
	<button onclick={() => (login_type = 'relogin')}> Login as existing player </button>
	<div class="row">
		<div class="form-group">
			<label for="username-input">Name</label>
			<input
				id="username-input"
				bind:value={username}
				class="input-block"
				type="text"
				required
			/>
		</div>
	</div>
	<div class="col">
		<button onclick={doLateLogin}>Login as new player</button>
	</div>
{:else}
	<button onclick={() => (login_type = 'late login')}> Login as new player </button>
	<div class="row">
		<div class="col sm-6">
			<select bind:value={username}>
				<option disabled={true} selected={true} value=""> Select username </option>
				{#each game.current.users as user (user.username)}
					<option value={user.username}>
						{user.username}
					</option>
				{/each}
			</select>
		</div>
		<div class="col sm-6">
			<button onclick={doRelogin} disabled={!username} class="btn-block">
				Login as {username}
			</button>
		</div>
	</div>
{/if}

<style>
	button {
		margin: 1em;
	}
	select {
		margin: 1em;
		width: 100%;
	}

	.top-row {
		justify-content: center;
	}
	.prompt-input {
		width: 64ch;
		max-width: 100%;
		box-sizing: border-box;
		margin: 0 auto;
		display: block;
	}

	.ready-btn {
		max-width: 40%;
		margin: 2em auto 0;
	}
</style>
