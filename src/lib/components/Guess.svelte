<script lang="ts">
	import { tweened } from 'svelte/motion';
	import * as api from '$lib/api';
	import { game } from '$lib/game-state.svelte';
	import { interpolated_shape, shape_length } from '$lib/shapes';
	import type { Shape, User } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import Canvas from './Canvas.svelte';

	function findUser(username: string): User {
		const user = game.current.users.find((u) => u.username === username);
		if (user) return user;
		console.error(`Error: user ${username} not found`);
		return {
			username: '',
			score: 0,
			img_src: '',
			lol_score: 0,
			proposed_prompt: '',
			assigned_prompt: ''
		};
	}

	let myUser = $derived(findUser(game.myUsername));

	let currentDrawing = $derived(
		game.current.drawings.find(
			(d) => d.prompt === game.current.current_prompt
		) ?? { shapes: [], username: '', prompt: '' }
	);

	let guessedPrompt = $state('');
	let votedPrompt = $state('');

	let sentGuess = $derived(
		game.current.guesses.some(
			(g) =>
				g.guesser_username === game.myUsername &&
				g.real_prompt === game.current.current_prompt
		) ||
			game.current.current_prompt === myUser.proposed_prompt ||
			game.current.current_prompt === myUser.assigned_prompt
	);

	let sentVote = $derived(
		game.current.votes.some(
			(v) =>
				v.voter_username === game.myUsername &&
				v.real_prompt === game.current.current_prompt
		) ||
			game.current.current_prompt === myUser.proposed_prompt ||
			game.current.current_prompt === myUser.assigned_prompt
	);

	async function doSendGuess() {
		const error = await api.sendGuess(game.current.current_prompt, guessedPrompt);
		if (error) { alert(error); return; }
		guessedPrompt = '';
	}

	async function doSendVote() {
		const error = await api.sendVote(game.current.current_prompt, votedPrompt);
		if (error) { alert(error); return; }
		votedPrompt = '';
	}

	async function doSendLOL(prompt: string) {
		const error = await api.sendLolVote(game.current.current_prompt, prompt);
		if (error) alert(error);
	}

	let possiblePrompts = $derived.by(() => {
		const guesses = game.current.guesses.filter(
			(g) =>
				g.real_prompt === game.current.current_prompt &&
				g.guesser_username !== game.myUsername
		);
		const prompts = guesses.map((g) => g.guessed_prompt);
		if (game.current.current_prompt !== myUser.proposed_prompt) {
			prompts.push(game.current.current_prompt);
		}
		prompts.sort();
		return prompts;
	});

	let usersWithoutGuess = $derived(
		game.current.users.filter(
			(u) =>
				u.proposed_prompt !== game.current.current_prompt &&
				u.username !== currentDrawing.username &&
				!game.current.guesses.some(
					(g) =>
						g.guesser_username === u.username &&
						g.real_prompt === game.current.current_prompt
				)
		)
	);

	let usersWithoutVote = $derived(
		game.current.users.filter(
			(u) =>
				u.proposed_prompt !== game.current.current_prompt &&
				u.username !== currentDrawing.username &&
				!game.current.votes.some(
					(v) =>
						v.voter_username === u.username &&
						v.real_prompt === game.current.current_prompt
				)
		)
	);

	// Drawing animation
	const tweenValue = tweened(0);
	tweenValue.set(1, { duration: 10000 });

	const sum = (arr: number[]): number => {
		let t = 0;
		for (const n of arr) t += n;
		return t;
	};

	let totalLength = $derived(sum(currentDrawing.shapes.map(shape_length)));

	let tweenedShapes = $derived.by(() => {
		const result: Shape[] = [];
		let lengthLeft = Math.floor($tweenValue * totalLength);
		for (const shape of currentDrawing.shapes) {
			const sLength = shape_length(shape);
			if (sLength <= lengthLeft) {
				result.push(shape);
				lengthLeft -= sLength;
			} else {
				result.push(interpolated_shape(shape, lengthLeft));
				break;
			}
		}
		return result;
	});
</script>

{#if game.current.phase === 'guess'}
	{#if sentGuess}
		<h1 class="has-text-centered">Wait for everybody to guess</h1>
	{:else}
		<h1 class="has-text-centered">Type your guess for:</h1>
	{/if}
{:else if game.current.phase === 'vote'}
	{#if sentVote}
		<h1 class="has-text-centered">Wait for everybody to pick</h1>
	{:else}
		<h1 class="has-text-centered">Pick one!</h1>
	{/if}
{:else if game.current.phase === 'lol vote'}
	<h1 class="has-text-centered">Give LOLs!</h1>
{:else}
	<h1 class="has-text-centered">Unknown phase: {game.current.phase}</h1>
{/if}

<Canvas shapes={tweenedShapes} editable={false} />

{#if game.current.phase === 'guess'}
	{#if sentGuess}
		<h2 class="has-text-centered">Got guesses:</h2>
		<div class="centered-flex">
			<Avatar user={findUser(currentDrawing.username)} />
			<Avatar
				user={game.current.users.find(
					(u) => u.proposed_prompt === game.current.current_prompt
				)}
			/>
			{#each game.current.guesses.filter((g) => g.real_prompt === game.current.current_prompt) as guess (guess.guesser_username)}
				<Avatar user={findUser(guess.guesser_username)} />
			{/each}
		</div>
		<h2 class="has-text-centered">Waiting for:</h2>
		<div class="centered-flex">
			{#each usersWithoutGuess as user (user.username)}
				<Avatar {user} />
			{/each}
		</div>
	{:else}
		<div class="row">
			<div class="col sm-10">
				<div class="form-group">
					<input
						bind:value={guessedPrompt}
						onkeyup={async (key: KeyboardEvent) => {
							if (key.code === 'Enter') await doSendGuess();
						}}
						class="input-block"
						type="text"
						placeholder="Your guess"
						required
					/>
				</div>
			</div>
			<div class="col sm-2">
				<button onclick={doSendGuess} disabled={guessedPrompt.length === 0}> Send! </button>
			</div>
		</div>
	{/if}
{:else if game.current.phase === 'vote'}
	{#if sentVote}
		<h2 class="has-text-centered">Got votes:</h2>
		<div class="centered-flex">
			<Avatar user={findUser(currentDrawing.username)} />
			<Avatar
				user={game.current.users.find(
					(u) => u.proposed_prompt === game.current.current_prompt
				)}
			/>
			{#each game.current.votes.filter((v) => v.real_prompt === game.current.current_prompt) as vote (vote.voter_username)}
				<Avatar user={findUser(vote.voter_username)} />
			{/each}
		</div>
		<h2 class="has-text-centered">Waiting for:</h2>
		<div class="centered-flex">
			{#each usersWithoutVote as user (user.username)}
				<Avatar {user} />
			{/each}
		</div>
	{:else}
		<div class="row">
			<div class="col sm-10 center-text">
				{#each possiblePrompts as prompt (prompt)}
					<div
						class={['row voterow', votedPrompt === prompt && 'row-selected']}
						onclick={() => (votedPrompt = prompt)}
						role="radio"
						aria-checked={votedPrompt === prompt}
						tabindex="0"
						onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') votedPrompt = prompt; }}
					>
						<div class="col sm-1">
							<input
								id={prompt}
								type="radio"
								bind:group={votedPrompt}
								value={prompt}
							/>
						</div>
						<div class="col sm-11">
							<label for={prompt}>
								{prompt}
							</label>
						</div>
					</div>
				{/each}
			</div>
			<div class="col sm-2 center-text">
				<button onclick={doSendVote} disabled={!votedPrompt}> Send! </button>
			</div>
		</div>
	{/if}
{:else if game.current.phase === 'lol vote'}
	{#each possiblePrompts as prompt (prompt)}
		<div class="row">
			<div class="col sm-6 center-text">{prompt}</div>
			<div class="col sm-6 center-text">
				<button
					onclick={async () => await doSendLOL(prompt)}
					disabled={game.current.lol_votes.some(
						(v) =>
							v.voter_username === game.myUsername &&
							v.real_prompt === game.current.current_prompt &&
							v.voted_prompt === prompt
					)}
				>
					LOL point
				</button>
			</div>
		</div>
	{/each}
{/if}

<style>
	h1 {
		font-size: 4em;
		color: red;
		font-weight: 100;
	}

	h2 {
		margin: 0;
	}
	.center-text {
		text-align: center;
		margin: auto;
	}
	.row {
		padding-top: 1em;
		max-width: 800px;
	}

	.voterow {
		padding-top: 0.3em;
		border-bottom-left-radius: 515px 1255px;
		border-bottom-right-radius: 1225px 515px;
		border-top-left-radius: 1255px 515px;
		border-top-right-radius: 515px 1225px;
		border: 2px solid #41403e;
		background-color: white;
		box-shadow: 15px 28px 25px -13px rgb(0 0 0 / 20%);
		transition: all 235ms ease-in-out 0ms;
	}

	.voterow:hover {
		transform: translate3d(0, 2px, 0);
		box-shadow: 2px 8px 8px -5px rgb(0 0 0 / 30%);
		background-color: rgba(0, 0, 0, 0.05);
		border-color: black;
	}

	.row-selected,
	.row-selected:hover {
		transform: translate3d(0, 4px, 0);
		background-color: rgba(220, 220, 255, 0.1);
		box-shadow: 0px 2px 3px 1px rgb(0 0 0 / 40%);
		border-color: black;
	}
	label {
		overflow-wrap: break-word;
	}
</style>
