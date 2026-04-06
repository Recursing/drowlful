<script lang="ts">
	import type { State } from '$lib/types';
	import Canvas from './Canvas.svelte';
	import SmallAvatar from './SmallAvatar.svelte';

	let { state }: { state: State } = $props();

	function findGuess(prompt: string, username: string): string {
		return (
			state.guesses.find(
				(g) => g.real_prompt === prompt && g.guesser_username === username
			)?.guessed_prompt || ''
		);
	}

	function findVote(prompt: string, username: string): string {
		return (
			state.votes.find(
				(v) => v.real_prompt === prompt && v.voter_username === username
			)?.voted_prompt || ''
		);
	}

	function voteCount(prompt: string, guessedPrompt: string): number {
		return state.votes.filter(
			(v) => v.real_prompt === prompt && v.voted_prompt === guessedPrompt
		).length;
	}

	function lolCount(prompt: string, guessedPrompt: string): number {
		return state.lol_votes.filter(
			(v) => v.real_prompt === prompt && v.voted_prompt === guessedPrompt
		).length;
	}

	let sortedUsers = $derived(
		[...state.users].sort((u1, u2) =>
			u1.username.toUpperCase() > u2.username.toUpperCase() ? 1 : -1
		)
	);
</script>

<div class="recap">
	{#each state.drawings as drawing (drawing.username)}
		<div class="round-section">
			<div class="round-layout">
				<div class="round-drawing">
					<Canvas shapes={drawing.shapes} editable={false} />
					<div class="prompt-reveal">{drawing.prompt}</div>
				</div>
				<div class="round-details">
					<table class="round-table">
						<thead>
							<tr>
								<th>Player</th>
								<th>Guess</th>
								<th>Voted for</th>
							</tr>
						</thead>
						<tbody>
							{#each sortedUsers as user (user.username)}
								{@const isArtist = user.username === drawing.username}
								{@const isWriter = user.proposed_prompt === drawing.prompt}
								<tr>
									<td class="player-cell-td">
										<div class="player-cell">
											<SmallAvatar {user} />
										</div>
									</td>
									<td>
										{#if isArtist}
											<span class="role-tag role-artist">ARTIST</span>
											{#if voteCount(drawing.prompt, drawing.prompt) > 0}
												<span class="green">+{voteCount(drawing.prompt, drawing.prompt) * 100}</span>
											{/if}
										{:else if isWriter}
											<span class="role-tag role-writer">WRITER</span>
											{#if lolCount(drawing.prompt, drawing.prompt) > 0}
												<span class="lol-badge">{lolCount(drawing.prompt, drawing.prompt)} LOL</span>
											{/if}
										{:else}
											{@const guess = findGuess(drawing.prompt, user.username)}
											{guess}
											{#if voteCount(drawing.prompt, guess) > 0}
												<span class="green">+{voteCount(drawing.prompt, guess) * 100}</span>
											{/if}
											{#if lolCount(drawing.prompt, guess) > 0}
												<span class="lol-badge">{lolCount(drawing.prompt, guess)} LOL</span>
											{/if}
										{/if}
									</td>
									<td>
										{#if isArtist || isWriter}
											<span class="no-vote">&mdash;</span>
										{:else}
											{@const vote = findVote(drawing.prompt, user.username)}
											{#if vote === drawing.prompt}
												<span class="correct-vote">{vote} +100</span>
											{:else}
												<span class="wrong-vote">{vote}</span>
											{/if}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	.recap {
		max-width: 1100px;
		margin: 0 auto;
	}
	.round-section {
		padding: 2.5em 0;
	}
	.round-section + .round-section {
		border-top: 1px solid #e0e0e0;
	}
	.round-layout {
		display: flex;
		gap: 3em;
		align-items: center;
	}
	.round-drawing {
		flex: 0 0 340px;
		text-align: center;
	}
	.prompt-reveal {
		font-size: 1.8em;
		color: red;
		font-weight: 100;
		margin: 0.5em 0 0;
		overflow-wrap: break-word;
	}
	.round-details {
		flex: 1;
		min-width: 0;
	}
	.round-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0 6px;
	}
	.round-table th {
		text-align: left;
		padding: 0.4em 0.8em;
		font-size: 0.85em;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #888;
		border-bottom: 1px solid #e0e0e0;
	}
	.round-table th:not(:first-child) {
		text-align: center;
	}
	.round-table td {
		text-align: center;
		padding: 0.6em 0.8em;
		vertical-align: middle;
		overflow-wrap: break-word;
		max-width: 240px;
	}
	.player-cell-td {
		text-align: left;
	}
	.player-cell {
		display: inline-flex;
		align-items: center;
	}
	.role-tag {
		display: inline-block;
		padding: 0.2em 0.6em;
		border-radius: 4px;
		font-size: 0.8em;
		font-weight: 600;
	}
	.role-artist {
		background: #ffe08a;
		color: #946c00;
	}
	.role-writer {
		background: #c8e6ff;
		color: #1a5276;
	}
	.green {
		color: rgb(22, 212, 22);
		font-weight: bold;
	}
	.wrong-vote {
		color: #999;
	}
	.correct-vote {
		color: rgb(22, 212, 22);
		font-weight: bold;
	}
	.no-vote {
		color: #ccc;
		font-style: italic;
	}
	.lol-badge {
		display: inline-block;
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 10px;
		padding: 0.05em 0.5em;
		font-size: 0.8em;
		margin-left: 0.3em;
	}
	@media (max-width: 768px) {
		.round-layout {
			flex-direction: column;
		}
		.round-drawing {
			flex: none;
			width: 100%;
		}
	}
</style>
