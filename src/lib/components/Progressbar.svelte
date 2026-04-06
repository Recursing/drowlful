<script lang="ts">
	import { tweened } from 'svelte/motion';
	import { game } from '$lib/game-state.svelte';

	const DRAW_TIME = 181;
	const GUESS_TIME = 60;

	let voteTime = $derived(4 * game.current.users.length);
	let lolTime = $derived(3 * game.current.users.length);
	let leaderboardTime = $derived(2 * game.current.users.length);

	let myUser = $derived(game.current.users.find((u) => u.username === game.myUsername));
	let assignedPrompt = $derived(myUser ? myUser.assigned_prompt : '');
	let proposedPrompt = $derived(myUser ? myUser.proposed_prompt : '');

	let totTime = $state(0);
	const progress = tweened(0);
	let secLeft = $derived(Math.floor((1 - $progress) * totTime));

	function startTimer(duration: number, message = '', condition: () => boolean = () => false) {
		totTime = duration;
		progress
			.set(0, { duration: totTime ? 100 : 1000 })
			.then(() => progress.set(1, { duration: totTime * 1000 }))
			.then(() => {
				if (condition()) alert(message);
			});
	}

	function hasNotSentDrawing(): boolean {
		return !game.current.drawings.some((d) => d.username === game.myUsername);
	}

	function hasNotSentGuess(): boolean {
		return !(
			game.current.guesses.some(
				(g) =>
					g.guesser_username === game.myUsername &&
					g.real_prompt === game.current.current_prompt
			) ||
			game.current.current_prompt === proposedPrompt ||
			game.current.current_prompt === assignedPrompt
		);
	}

	function hasNotSentVote(): boolean {
		return !(
			game.current.votes.some(
				(v) =>
					v.voter_username === game.myUsername &&
					v.real_prompt === game.current.current_prompt
			) ||
			game.current.current_prompt === proposedPrompt ||
			game.current.current_prompt === assignedPrompt
		);
	}

	// Side effect: start timer when phase changes. previousPhase is not reactive state —
	// it's just a tracker for the effect to detect changes.
	let previousPhase = 'login';
	$effect(() => {
		const phase = game.current.phase;
		if (previousPhase === phase) return;
		previousPhase = phase;

		if (phase === 'draw') {
			startTimer(DRAW_TIME, 'Please send your drawing!', hasNotSentDrawing);
		} else if (phase === 'guess') {
			startTimer(GUESS_TIME, 'Please send your guess!', hasNotSentGuess);
		} else if (phase === 'vote') {
			startTimer(voteTime, 'Please send your vote!', hasNotSentVote);
		} else if (phase === 'lol vote') {
			// Use server remaining time if available (reconnect case), else client default
			const serverLolMs = game.current.lol_vote_remaining_ms;
			startTimer(serverLolMs != null ? serverLolMs / 1000 : lolTime);
		} else if (phase === 'leaderboard') {
			const serverLeaderMs = game.current.leaderboard_remaining_ms;
			startTimer(serverLeaderMs != null ? serverLeaderMs / 1000 : leaderboardTime);
		}
	});

	let showProgress = $derived(
		['draw', 'guess', 'vote', 'lol vote', 'leaderboard'].includes(game.current.phase)
	);

	let progressClass = $derived(
		$progress < 0.5 ? 'progress margin-bottom is-success'
		: $progress < 0.8 ? 'progress margin-bottom is-warning'
		: 'progress margin-bottom is-danger'
	);
</script>

{#if showProgress}
	<h1 class="has-text-centered">{secLeft}</h1>
	<progress
		class={progressClass}
		value={$progress}
	></progress>
{/if}

<style>
	h1 {
		font-size: 4em;
		color: red;
		font-weight: 100;
	}
	progress {
		width: 100%;
	}
</style>
