<script lang="ts">
  import type { Picture, Guess } from "./interfaces";
  import { users, my_username } from "./stores";
  import Avatar from "./Avatar.svelte";
  import Canvas from "./Canvas.svelte";
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();
  import { tweened } from "svelte/motion";
  export let pictures: Picture[];
  const states = {
    WRITE_GUESS: "write_guess",
    PICK_GUESS: "pick_guess",
    SCORE: "scoring",
  };
  const tot_time = 31;

  let picture = pictures[0];
  let state = states.WRITE_GUESS;
  let guess = "";
  let sent_guess = false;
  let vote = "";
  let give_point_to = "";
  let sent_vote = false;

  let guesses: Guess[] = [];
  let votes: Guess[] = [];

  function startGuessing() {
    if (pictures.length == 0) {
      alert("Oh noes! No pictures!");
      return;
    }
    picture = pictures.pop()!;
    guesses = [{ prompt: picture.prompt, username: picture.username }];
    votes = [];
    state = states.WRITE_GUESS;
    sent_guess = picture.username === $my_username;
    guess = "";
    progress
      .set(0, { duration: 500 })
      .then(() => progress.set(1))
      .then(() => {if (!sent_guess) {alert("Please send a guess!")}});
  }

  function startVoting() {
    state = states.PICK_GUESS;
    vote = "";
    if ($my_username === picture.username){
      vote = picture.prompt;
      sendVote();
    }
    progress
      .set(0, { duration: 500 })
      .then(() => progress.set(1))
      .then(() => {if (!sent_vote) {alert("Please send a vote!")}});
  }

  let sendGuess = function () {
    dispatch("sendGuess", guess.toUpperCase());
    sent_guess = true;
  };

  export const onGuess = (new_guess: Guess) => {
    // TODO guess shadows global
    guesses = [...guesses, new_guess];
    if (guesses.length === $users.size) {
      startVoting();
    }
  };

  let sendVote = function () {
    dispatch("sendVote", vote);
    sent_vote = true;
  };

  let givePoint = function (username: string) {
    dispatch("givePoint", username);
  };

  export const onVote = (vote: Guess) => {
    console.log(vote);
    votes = [...votes, vote];
    console.log(votes);
    if (votes.length === $users.size) {
      alert("Everybody voted!");
      state = states.SCORE;
    }
  };

  const progress = tweened(0, {
    duration: tot_time * 1000,
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
  <select bind:value={give_point_to}>
    {#each votes as vote}
      {#if vote.username !== $my_username}
      <option value="{vote.username}">{vote.prompt}</option>
      {/if}
    {/each}
  </select>
  <button class="button"
    on:click|once={() => givePoint(give_point_to)}
    disabled={give_point_to === ""}>
    Vote!</button>
{/if}
<progress
  class="progress"
  class:is-success={$progress < 0.5}
  class:is-warning={$progress >= 0.5 && $progress < 0.8}
  class:is-danger={$progress >= 0.8}
  value={$progress} />
<h1 class="has-text-centered">{sec_left}</h1>
