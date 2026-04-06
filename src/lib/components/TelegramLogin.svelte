<script lang="ts">
	import { onMount } from 'svelte';
	import * as api from '$lib/api';
	import { game } from '$lib/game-state.svelte';
	import { normalizePrompt } from '$lib/types';

	let username = $state('');
	let prompt = $state('');

	interface TelegramUser {
		username?: string;
		first_name?: string;
		last_name?: string;
		photo_url?: string;
		id?: string;
	}

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

	let img_src = $state(default_images[Math.floor(Math.random() * default_images.length)] ?? '');

	// Pick a non-taken image
	$effect(() => {
		const taken = new Set(game.current.users.map((u) => u.img_src));
		if (taken.has(img_src)) {
			const available = default_images.filter((img) => !taken.has(img));
			const pick = available[Math.floor(Math.random() * available.length)];
			if (pick) img_src = pick;
		}
	});

	function removeTelegramWidget() {
		const el = document.getElementById('telegram-login-minnybot');
		el?.remove();
	}

	function onTelegramAuth(user: TelegramUser) {
		username = user.username || `${user.first_name} ${user.last_name}`;
		img_src = user.photo_url || img_src;
		onManualAuth();
	}

	async function onManualAuth() {
		if (!prompt) { alert('Write prompt first!'); return; }
		if (!username) { alert('Empty username'); return; }
		if (!img_src) { alert('Empty image'); return; }
		const error = await api.login(username, img_src, normalizePrompt(prompt), game.gameId || undefined);
		if (error) { alert(error); return; }
		api.startPolling();
		removeTelegramWidget();
	}

	async function doRelogin() {
		if (!username) { alert('Empty username'); return; }
		if (!game.gameId) { alert('Enter a game code first'); return; }
		const error = await api.relogin(username, game.gameId);
		if (error) { alert(error); return; }
		api.startPolling();
		removeTelegramWidget();
	}

	async function doLateLogin() {
		if (!username) { alert('Empty username'); return; }
		if (!img_src) { alert('Empty image'); return; }
		if (!game.gameId) { alert('Enter a game code first'); return; }
		const error = await api.lateLogin(username, img_src, game.gameId);
		if (error) { alert(error); return; }
		api.startPolling();
		removeTelegramWidget();
	}

	let login_type = $state<'login' | 'relogin' | 'late login'>('login');

	onMount(() => {
		// @ts-ignore: Telegram widget callback
		window.onTelegramAuth = onTelegramAuth;
	});
</script>

{#if game.current.phase === 'login'}
	<div class="row">
		<div class="col sm-4">
			<div class="form-group">
				<label for="game-code-input">Game Code (leave empty to create new)</label>
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
	</div>
	<div class="row">
		<div class="col sm-4">
			<div class="form-group">
				<label for="username-input">Username</label>
				<input
					id="username-input"
					bind:value={username}
					class="input-block"
					type="text"
					placeholder="Username"
					required
				/>
			</div>
		</div>
		<div class="col sm-8">
			<div class="form-group">
				<label for="image-url-input">Image url</label>
				<input
					id="image-url-input"
					bind:value={img_src}
					class="input-block"
					type="url"
					required
				/>
			</div>
		</div>
	</div>
	<div class="row">
		<input
			bind:value={prompt}
			class="width-100 input-block"
			type="text"
			placeholder="Your prompt"
			onkeyup={(key: KeyboardEvent) => (key.code === 'Enter' ? onManualAuth() : null)}
			required
		/>
	</div>
	<button onclick={onManualAuth} class="width-60 btn-block">Login</button>
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
		<div class="col sm-4">
			<div class="form-group">
				<label for="username-input">Username</label>
				<input
					id="username-input"
					bind:value={username}
					class="input-block"
					type="text"
					placeholder="Username"
					required
				/>
			</div>
		</div>
		<div class="col sm-8">
			<div class="form-group">
				<label for="image-url-input">Image url</label>
				<input
					id="image-url-input"
					bind:value={img_src}
					class="input-block"
					type="url"
					required
				/>
			</div>
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

	.width-60 {
		max-width: 60%;
		margin: auto;
	}

	.width-100 {
		width: 100%;
		margin: auto;
	}
</style>
