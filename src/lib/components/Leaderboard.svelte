<script lang="ts">
	import { game } from '$lib/game-state.svelte';
	import Avatar from './Avatar.svelte';
	import Canvas from './Canvas.svelte';

	let currentDrawing = $derived(
		game.current.drawings.find((d) => d.prompt === game.current.current_prompt) ?? {
			shapes: [],
			username: '',
			prompt: ''
		}
	);

	let userVotes = $derived(
		new Map(
			game.current.votes
				.filter((v) => v.real_prompt === game.current.current_prompt)
				.map((v) => [v.voter_username, v.voted_prompt])
		)
	);

	let userGuesses = $derived(
		new Map(
			game.current.guesses
				.filter((g) => g.real_prompt === game.current.current_prompt)
				.map((g) => [g.guesser_username, g.guessed_prompt])
		)
	);

	let sortedUsers = $derived(
		[...game.current.users].sort(
			(u1, u2) => u2.score + u2.lol_score - u1.score - u1.lol_score
		)
	);
</script>

{#if game.current.phase === 'end'}
	<h1 class="has-text-centered">THE END!</h1>
{:else}
	<Canvas shapes={currentDrawing.shapes} editable={false} />
	<h1 class="has-text-centered">{game.current.current_prompt}</h1>
{/if}

<div class="row">
	<div class="col sm-2 center-text"><strong>User</strong></div>
	<div class="col sm-2 center-text"><strong>Score</strong></div>
	<div class="col sm-2 center-text"><strong>LOLs</strong></div>
	<div class="col sm-3 center-text">
		{#if game.current.phase === 'leaderboard'}<strong>Guessed</strong>{/if}
	</div>
	<div class="col sm-3 center-text">
		{#if game.current.phase === 'leaderboard'}<strong>Voted</strong>{/if}
	</div>
	{#each sortedUsers as user (user.username)}
		<div class="col sm-2">
			<div class="centered-flex">
				<Avatar {user} />
			</div>
		</div>
		<div class="col sm-2 center-text">
			{user.score}
			{#if user.score > (game.previousScores.get(user.username) ?? 0) && game.current.phase === 'leaderboard'}
				<span>+{user.score - (game.previousScores.get(user.username) ?? 0)}</span>
			{/if}
		</div>
		<div class="col sm-2 center-text">
			{user.lol_score}
			{#if user.lol_score > (game.previousLOLScores.get(user.username) ?? 0) && game.current.phase === 'leaderboard'}
				<span>
					+{user.lol_score - (game.previousLOLScores.get(user.username) ?? 0)}
				</span>
			{/if}
		</div>
		<div class="col sm-3 center-text">
			{#if game.current.phase === 'leaderboard'}
				{#if game.current.current_prompt === user.assigned_prompt}
					<span>ARTIST</span>
				{:else if game.current.current_prompt === user.proposed_prompt}
					<span>WRITER</span>
				{:else}
					{userGuesses.get(user.username) ?? ''}
				{/if}
			{/if}
		</div>
		<div class="col sm-3 center-text">
			{#if game.current.phase === 'leaderboard'}
				{userVotes.get(user.username) ?? ''}
			{/if}
		</div>
	{/each}
</div>

<style>
	h1 {
		font-size: 4em;
		color: red;
		font-weight: 100;
	}
	span {
		color: rgb(22, 212, 22);
	}
	.center-text {
		text-align: center;
		margin: auto;
	}
	.row {
		padding-top: 1em;
	}
</style>
