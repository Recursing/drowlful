<script lang="ts">
  import { state, my_username } from "./stores";

  import { tweened } from "svelte/motion";

  const DRAW_TIME = 181;

  const GUESS_TIME = 60;
  $: VOTE_TIME = 4 * $state.users.length;
  $: LOL_TIME = 3 * $state.users.length;
  $: LEADERBOARD_TIME = 2 * $state.users.length;
  let current_phase = "login";

  $: my_user = $state.users.find((u) => u.username === $my_username);
  $: assigned_prompt = my_user ? my_user.assigned_prompt : "";
  $: proposed_prompt = my_user ? my_user.proposed_prompt : "";

  let tot_time = 0;
  const progress = tweened(0);
  $: sec_left = Math.floor((1 - $progress) * tot_time);

  function startTimer(duration: number, message = "", condition = () => false) {
    tot_time = duration;
    console.log("TOT TIME IS", tot_time);
    progress
      .set(0, { duration: tot_time ? 100 : 1000 })
      .then(() => progress.set(1, { duration: tot_time * 1000 }))
      .then(() => (condition() ? alert(message) : null));
  }

  function hasNotSentDrawing(): boolean {
    return !$state.drawings.some((d) => d.username === $my_username);
  }

  function hasNotSentGuess(): boolean {
    return !(
      $state.guesses.some(
        (g) =>
          g.guesser_username === $my_username &&
          g.real_prompt === $state.current_prompt
      ) ||
      $state.current_prompt == proposed_prompt ||
      $state.current_prompt == assigned_prompt
    );
  }

  function hasNotSentVote(): boolean {
    return !(
      $state.votes.some(
        (v) =>
          v.voter_username === $my_username &&
          v.real_prompt === $state.current_prompt
      ) ||
      $state.current_prompt == proposed_prompt ||
      $state.current_prompt == assigned_prompt
    );
  }

  state.subscribe((new_state) => {
    if (current_phase === new_state.phase) {
      return;
    }
    if (new_state.phase === "draw") {
      startTimer(DRAW_TIME, "Please send your drawing!", hasNotSentDrawing);
    } else if (new_state.phase === "guess") {
      startTimer(GUESS_TIME, "Please send your guess!", hasNotSentGuess);
    } else if (new_state.phase === "vote") {
      startTimer(VOTE_TIME, "Please send your vote!", hasNotSentVote);
    } else if (new_state.phase === "lol vote") {
      startTimer(LOL_TIME);
    } else if (
      new_state.phase === "leaderboard" &&
      current_phase !== "leaderboard"
    ) {
      startTimer(LEADERBOARD_TIME);
    }
    current_phase = new_state.phase;
  });
</script>

{#if ["draw", "guess", "vote", "lol vote", "leaderboard"].includes(current_phase)}
  <h1 class="has-text-centered">{sec_left}</h1>
  <progress
    class="progress margin-bottom"
    class:is-success={$progress < 0.5}
    class:is-warning={$progress >= 0.5 && $progress < 0.8}
    class:is-danger={$progress >= 0.8}
    value={$progress}
  />
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
