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
		'https://img.pokemondb.net/artwork/large/mudkip.jpg',
		'https://img.pokemondb.net/artwork/large/snorlax.jpg',
		'https://img.pokemondb.net/artwork/large/mew.jpg',
		'https://img.pokemondb.net/artwork/large/mewtwo.jpg',
		'https://img.pokemondb.net/artwork/large/gengar.jpg',
		'https://img.pokemondb.net/artwork/large/dragonite.jpg',
		'https://img.pokemondb.net/artwork/large/lucario.jpg',
		'https://img.pokemondb.net/artwork/large/cubone.jpg',
		'https://img.pokemondb.net/artwork/large/psyduck.jpg',
		'https://img.pokemondb.net/artwork/large/vulpix.jpg',
		'https://img.pokemondb.net/artwork/large/ditto.jpg',
		'https://img.pokemondb.net/artwork/large/slowpoke.jpg',
		'https://img.pokemondb.net/artwork/large/magikarp.jpg',
		'https://img.pokemondb.net/artwork/large/gyarados.jpg',
		'https://img.pokemondb.net/artwork/large/articuno.jpg',
		'https://img.pokemondb.net/artwork/large/zapdos.jpg',
		'https://img.pokemondb.net/artwork/large/moltres.jpg',
		'https://img.pokemondb.net/artwork/large/lugia.jpg',
		'https://img.pokemondb.net/artwork/large/treecko.jpg',
		'https://img.pokemondb.net/artwork/large/torchic.jpg',
		'https://img.pokemondb.net/artwork/large/cyndaquil.jpg',
		'https://img.pokemondb.net/artwork/large/totodile.jpg',
		'https://img.pokemondb.net/artwork/large/marill.jpg',
		'https://img.pokemondb.net/artwork/large/wooper.jpg',
		'https://img.pokemondb.net/artwork/large/snubbull.jpg',
		'https://img.pokemondb.net/artwork/large/ralts.jpg'
	];

	/** Prefer a Pokémon nobody else in this lobby has. Falls back to fully
	 * random if all are taken (more players than Pokémon, which would need 37+). */
	function pickRandomImage(): string {
		const taken = new Set(game.current.users.map((u) => u.img_src));
		const available = default_images.filter((img) => !taken.has(img));
		const pool = available.length > 0 ? available : default_images;
		return pool[Math.floor(Math.random() * pool.length)] ?? '';
	}

	let img_src = $state(pickRandomImage());

	async function onLogin() {
		if (!prompt || !username) return;
		if (game.current.users.some((u) => u.img_src === img_src)) img_src = pickRandomImage();
		if (!img_src) return;
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
		if (!username || !game.gameId) return;
		if (game.current.users.some((u) => u.img_src === img_src)) img_src = pickRandomImage();
		if (!img_src) return;
		const error = await api.lateLogin(username, img_src, game.gameId);
		if (error) { modal.alert(error); return; }
		api.startPolling();
	}

	let login_type = $state<'login' | 'relogin' | 'late login'>('login');
</script>

<!-- 'end' is treated like 'login': the server recycles a finished game on the
     next login (see [action]/+server.ts), so the joining player gets the
     fresh-lobby form instead of the rejoin-an-active-game choice. -->
{#if game.current.phase === 'login' || game.current.phase === 'end'}
	<h2 class="has-text-centered game-code-heading">Game code: {game.gameId}</h2>
	<div class="row top-row">
		<div class="col sm-6">
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
	<h2 class="has-text-centered game-code-heading">Game code: {game.gameId}</h2>
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
	.game-code-heading {
		margin-bottom: 1em;
	}
</style>
