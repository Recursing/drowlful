<script lang="ts">
  import type { Drawing, Guess, User } from "./interfaces";
  import { my_username, my_prompt, state } from "./stores";
  import { socket } from "./Websocket";
  import Avatar from "./Avatar.svelte";
  import Canvas from "./Canvas.svelte";
  import { tweened } from "svelte/motion";

  $: user_list = [...$state.users];
  function find_user(username: string): User {
    for (let user of user_list) {
      if (user.username === username) {
        return user;
      }
    }
    throw Error("User " + username + " not found");
  }

  let drawings: Drawing[] = [...$state.drawings];
  const phases = {
    WRITE_GUESS: "write_guess",
    PICK_GUESS: "pick_guess",
    SCORE: "scoring",
    LEADERBOARD: "leaderboard",
  };
  const tot_time = 60;

  let drawing = drawings[0];
  let guess_phase = phases.WRITE_GUESS;
  let guess = "";
  let sent_guess = false;
  let voted_for: string;
  let sent_vote = false;
  let sent_points: string[] = [];
  let sorted_users: User[] = [];

  let guesses: Guess[] = [];
  let votes: unknown[] = [];

  function startGuessing() {
    if (drawings.length == 0) {
      alert("The end!");
      return;
    }
    drawing = drawings.shift()!;
    guesses.push({
      real_prompt: drawing.prompt,
      guessed_prompt: drawing.prompt,
      guesser_username: drawing.username,
    });
    votes = [];
    guess_phase = phases.WRITE_GUESS;
    sent_guess = drawing.username === $my_username;
    guess = "";
    sent_points = [];
    progress
      .set(0, { duration: 1000 })
      .then(() => progress.set(1))
      .then(() => {
        if (!sent_guess) {
          alert("Please send a guess!");
        }
      });
    if (drawing.prompt === $my_prompt) {
      guess = "-----";
      // TODO this causes problems, check you're receiving guesses while in the
      // right state, otherwise queue them
      sendGuess();
    }
  }

  function startVoting() {
    guess_phase = phases.PICK_GUESS;
    sent_vote = false;
    if ($my_username === drawing.username) {
      voted_for = drawing.username;
      sendVote();
    }
    if ($my_prompt === drawing.prompt) {
      voted_for = $my_username;
      sendVote();
    }
    progress
      .set(0, { duration: 1000 })
      .then(() => progress.set(1))
      .then(() => {
        if (!sent_vote) {
          alert("Please send a vote!");
        }
      });
  }

  let sendGuess = function () {
    /*websocket.sendObject({
      type: "guessed_prompt",
      prompt: guess.toUpperCase(),
      guesser_username: $my_username,
    });*/
    sent_guess = true;
  };

  export const onGuess = (new_guess: Guess) => {
    guesses.push(new_guess);
    guesses.sort((a, b) => a.guessed_prompt.localeCompare(b.guessed_prompt));
    guesses = guesses;
    if (guesses.length === user_list.length) {
      startVoting();
    }
  };

  let sendVote = function () {
    console.log("sendVote message", voted_for);
    /*websocket.sendObject({
      type: "voted_prompt",
      voted_username: voted_for,
      voter_username: $my_username,
    });*/
    sent_vote = true;
  };

  let givePoint = function (username: string) {
    sent_points = [...sent_points, username];
    console.log("givePoint to username", username);
    /*websocket.sendObject({
      type: "give_point",
      receiver_username: username,
    });*/
  };

  export const onVote = (vote: unknown) => {
    console.log(vote);
    votes = [...votes, vote];
    console.log(votes);
    if (votes.length === user_list.length) {
      guess_phase = phases.SCORE;
      progress
        .set(0.7, { duration: 1000 })
        .then(() => progress.set(1, { duration: tot_time * 1000 * 0.3 }))
        .then(startLeaderboard);
    }
  };

  function startLeaderboard() {
    guesses = [];
    guess_phase = phases.LEADERBOARD;
    sorted_users = [...user_list];
    sorted_users.sort(
      (u1, u2) => (u2.score - u1.score) * 100 + u2.lol_score - u1.lol_score
    );
    sorted_users = sorted_users;
    progress
      .set(0.7, { duration: 1000 })
      .then(() => progress.set(1, { duration: tot_time * 1000 * 0.3 }))
      .then(startGuessing);
  }

  const progress = tweened(0, {
    duration: tot_time * 1000,
  });

  $: sec_left = Math.floor((1 - $progress) * tot_time);

  startGuessing();
</script>

{#if guess_phase === phases.WRITE_GUESS}
  <h1 class="has-text-centered">Type your guess for:</h1>
{:else if guess_phase === phases.PICK_GUESS}
  <h1 class="has-text-centered">Pick your guess for:</h1>
{:else}
  <h1 class="has-text-centered">Scores:</h1>
{/if}

<Canvas lines={drawing.lines} editable={false} />

{#if guess_phase === phases.WRITE_GUESS}
  {#if sent_guess}
    <h2 class="has-text-centered">Got guesses:</h2>
    <div class="centered-flex">
      {#each guesses as guess}
        <Avatar user={find_user(guess.guesser_username)} />
      {/each}
    </div>
  {:else}
    <div class="row">
      <div class="col sm-10">
        <div class="form-group">
          <input
            bind:value={guess}
            class="input-block"
            type="text"
            placeholder="Your guess"
            required
          />
        </div>
      </div>
      <div class="col sm-2">
        <button
          class="button is-info is-large"
          on:click={sendGuess}
          disabled={guess.length === 0}
        >
          Send!
        </button>
      </div>
    </div>
  {/if}
{:else if guess_phase === phases.PICK_GUESS}
  {#if sent_vote}
    <h2 class="has-text-centered">Got votes:</h2>
    <div class="centered-flex">
      {#each votes as vote}
        <Avatar user={find_user(vote.voter_username)} />
      {/each}
    </div>
  {:else}
    <div class="row">
      <div class="col sm-10">
        <div class="form-group">
          <select bind:value={voted_for} class="input-block">
            {#each guesses as t_guess}
              {#if t_guess.guesser_username !== $my_username}
                <option value={t_guess.guesser_username}
                  >{t_guess.guessed_prompt}</option
                >
              {/if}
            {/each}
          </select>
        </div>
      </div>
      <div class="col sm-2">
        <button class="button" on:click={sendVote}>Send!</button>
      </div>
    </div>
  {/if}
{:else if guess_phase === phases.SCORE}
  {#each guesses as t_guess}
    <div class="row">
      {#if t_guess.guesser_username !== $my_username && t_guess.guessed_prompt !== $my_prompt && t_guess.guessed_prompt !== drawing.prompt && t_guess.guessed_prompt !== "-----"}
        <div class="col sm-6 center-text">{t_guess.guessed_prompt}</div>
        <div class="col sm-6 center-text">
          <button
            class="button"
            on:click|once={() => givePoint(t_guess.guesser_username)}
            disabled={sent_points.includes(t_guess.guesser_username)}
            >LOL point</button
          >
        </div>
      {/if}
    </div>
  {/each}
{:else if guess_phase === phases.LEADERBOARD}
  <h1 class="has-text-centered">{drawing.prompt}</h1>
  <div class="row">
    <div class="col sm-6 center-text"><strong>User</strong></div>
    <div class="col sm-3 center-text"><strong>Score</strong></div>
    <div class="col sm-3 center-text"><strong>LOLs</strong></div>
    {#each sorted_users as user}
      <div class="col sm-6">
        <div class="centered-flex">
          <Avatar {user} />
        </div>
      </div>
      <div class="col sm-3 center-text">{user.score}</div>
      <div class="col sm-3 center-text">{user.lol_score}</div>
    {/each}
  </div>
{/if}
<progress
  class="progress margin-bottom"
  class:success={$progress < 0.5}
  class:warning={$progress >= 0.5 && $progress < 0.8}
  class:danger={$progress >= 0.8}
  value={$progress}
/>
<h1 class="has-text-centered">{sec_left}</h1>

<style>
  h1 {
    font-size: 4em;
    color: red;
    font-weight: 100;
  }
  progress {
    width: 100%;
  }
  .center-text {
    text-align: center;
    margin: auto;
  }
  .row {
    padding-top: 1em;
  }
</style>
