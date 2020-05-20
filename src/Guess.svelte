<script>
  import { users, my_username } from "./stores.js";
  import Avatar from "./Avatar.svelte";
  import Canvas from "./Canvas.svelte";
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();
  import { tweened } from "svelte/motion";
  export let pictures;
  const states = {
    WRITE_GUESS: "write_guess",
    PICK_GUESS: "pick_guess",
    SCORE: "scoring"
  };
  const tot_time = 31;

  let picture = pictures[0];
  let state = states.WRITE_GUESS;
  let guess = "";
  let sent_guess = false;
  let vote = "";
  let sent_vote = false;

  let guesses = [];
  let votes = [];

  function startGuessing() {
    picture = pictures.pop();
    guesses = [{ prompt: picture.prompt, username: picture.username }];
    votes = [];
    state = states.WRITE_GUESS;
    sent_guess = picture.username === $my_username;
    guess = "";
    progress
      .set(0, { duration: 500 })
      .then(() => progress.set(1))
      .then(() => alert("Please send a guess!"));
  }

  function startVoting() {
    sent_vote = $my_username === picture.username;
    state = states.PICK_GUESS;
    vote = "";
    progress
      .set(0, { duration: 500 })
      .then(() => progress.set(1))
      .then(() => alert("Please send a vote!"));
  }

  let sendGuess = function() {
    dispatch("sendGuess", guess.toUpperCase());
    sent_guess = true;
    progress.set(1);
  };

  export const onGuess = guess => {
    console.log(guess);
    guesses = [...guesses, guess];
    console.log(guesses);
    if (guesses.length === $users.size) {
      startVoting();
    }
  };

  let sendVote = function() {
    dispatch("sendVote", vote);
    sent_vote = true;
    progress.set(1);
  };

  export const onVote = vote => {
    console.log(vote);
    votes = [...votes, vote];
    console.log(votes);
    if (votes.length === $users.size - 1) {
      alert("Everybody voted!");
      state = states.SCORE;
    }
  };

  const progress = tweened(0, {
    duration: tot_time * 1000
  });

  $: sec_left = Math.floor((1 - $progress) * tot_time);

  startGuessing();
</script>

<style>
  h1 {
    font-size: 4em;
    color: red;
    font-weight: 100;
  }
  progress {
    width: 100%;
  }
  .field {
    margin: 2em;
  }
</style>

{#if state === states.WRITE_GUESS}
  <h1 class="is-title has-text-centered">Type your guess for:</h1>
{:else if state === states.PICK_GUESS}
  <h1 class="is-title has-text-centered">Pick your guess for:</h1>
{:else}
  <h1 class="is-title has-text-centered">Scores:</h1>
{/if}

<Canvas lines={picture.lines} editable={false} />

{#if state === states.WRITE_GUESS}
  {#if sent_guess}
    <h2 class="has-text-centered">Got guesses:</h2>
    {#each guesses as guess}
      <Avatar username={guess.username} />
    {/each}
  {:else}
    <div class="field has-addons has-addons-centered">
      <div class="control is-expanded">
        <input
          bind:value={guess}
          class="input is-large"
          type="text"
          placeholder="Your guess"
          required />
      </div>
      <div class="control">
        <button
          class="button is-info is-large"
          on:click={sendGuess}
          disabled={guess.length === 0}>
          Send!
        </button>
      </div>
    </div>
  {/if}
{:else if state === states.PICK_GUESS}
  {#if sent_vote}
    <h2 class="has-text-centered">Got votes:</h2>
    {#each votes as vote}
      <Avatar username={vote.username} />
    {/each}
  {:else}
    <select bind:value={vote}>
      {#each guesses as t_guess}
        <option>{t_guess.prompt}</option>
      {/each}
    </select>
    <button class="button is-info is-large" on:click={sendVote}>Send!</button>
  {/if}
{:else if state === states.SCORE}
  <ul>
    {#each votes as vote}
      <li>{JSON.stringify(vote)}</li>
    {/each}
  </ul>
{/if}
<progress
  class="progress"
  class:is-success={$progress < 0.5}
  class:is-warning={$progress >= 0.5 && $progress < 0.8}
  class:is-danger={$progress >= 0.8}
  value={$progress} />
<h1 class="has-text-centered">{sec_left}</h1>
