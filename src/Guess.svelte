<script lang="ts">
  import type { Picture, Guess, VotePrompt, User } from "./interfaces";
  import { users, my_username, my_prompt } from "./stores";
  import { websocket } from "./Websocket";
  import Avatar from "./Avatar.svelte";
  import Canvas from "./Canvas.svelte";
  import { tweened } from "svelte/motion";
  export let pictures: Picture[];
  const states = {
    WRITE_GUESS: "write_guess",
    PICK_GUESS: "pick_guess",
    SCORE: "scoring",
    LEADERBOARD: "leaderboard",
  };
  const tot_time = 60;

  let picture = pictures[0];
  let state = states.WRITE_GUESS;
  let guess = "";
  let sent_guess = false;
  let voted_for: string;
  let sent_vote = false;
  let sent_points: string[] = [];
  let sorted_users: User[] = [];

  let guesses: Guess[] = [];
  let votes: VotePrompt[] = [];

  function startGuessing() {
    if (pictures.length == 0) {
      alert("The end!");
      return;
    }
    picture = pictures.shift()!;
    guesses.push({
      prompt: picture.prompt,
      guesser_username: picture.username,
    });
    votes = [];
    state = states.WRITE_GUESS;
    sent_guess = picture.username === $my_username;
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
    if (picture.prompt === $my_prompt) {
      guess = "-----";
      // TODO this causes problems, check you're receiving guesses while in the
      // right state, otherwise queue them
      sendGuess();
    }
  }

  function startVoting() {
    state = states.PICK_GUESS;
    sent_vote = false;
    if ($my_username === picture.username) {
      voted_for = picture.username;
      sendVote();
    }
    if ($my_prompt === picture.prompt) {
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
    websocket.sendObject({
      type: "guessed_prompt",
      prompt: guess.toUpperCase(),
      guesser_username: $my_username,
    });
    sent_guess = true;
  };

  export const onGuess = (new_guess: Guess) => {
    guesses.push(new_guess);
    guesses.sort((a, b) => a.prompt.localeCompare(b.prompt));
    guesses = guesses;
    if (guesses.length === $users.size) {
      startVoting();
    }
  };

  let sendVote = function () {
    if (picture.username === voted_for && voted_for !== $my_username) {
      users.update((users) => {
        let user = users.get($my_username);
        if (!user) {
          console.error("MISSING USER");
          alert("MISSING USER!!!!");
          return users;
        }
        user.score += 1;
        users.set($my_username, user);
        console.log([...users]);
        return users;
      });
    }
    console.log("sendVote message", voted_for);
    websocket.sendObject({
      type: "voted_prompt",
      voted_username: voted_for,
      voter_username: $my_username,
    });
    sent_vote = true;
  };

  let givePoint = function (username: string) {
    sent_points = [...sent_points, username];
    console.log("givePoint to username", username);
    websocket.sendObject({
      type: "give_point",
      receiver_username: username,
    });
  };

  export const onVote = (vote: VotePrompt) => {
    console.log(vote);
    votes = [...votes, vote];
    console.log(votes);
    if (votes.length === $users.size) {
      state = states.SCORE;
      progress
        .set(0.7, { duration: 1000 })
        .then(() => progress.set(1, { duration: tot_time * 1000 * 0.3 }))
        .then(startLeaderboard);
    }
  };

  function startLeaderboard() {
    guesses = [];
    state = states.LEADERBOARD;
    sorted_users = [...$users.values()];
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

{#if state === states.WRITE_GUESS}
  <h1 class="has-text-centered">Type your guess for:</h1>
{:else if state === states.PICK_GUESS}
  <h1 class="has-text-centered">Pick your guess for:</h1>
{:else}
  <h1 class="has-text-centered">Scores:</h1>
{/if}

<Canvas lines={picture.lines} editable={false} />

{#if state === states.WRITE_GUESS}
  {#if sent_guess}
    <h2 class="has-text-centered">Got guesses:</h2>
    <div class="centered-flex">
      {#each guesses as guess}
        <Avatar username={guess.guesser_username} />
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
{:else if state === states.PICK_GUESS}
  {#if sent_vote}
    <h2 class="has-text-centered">Got votes:</h2>
    <div class="centered-flex">
      {#each votes as vote}
        <Avatar username={vote.voter_username} />
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
                  >{t_guess.prompt}</option
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
{:else if state === states.SCORE}
  {#each guesses as t_guess}
    <div class="row">
      {#if t_guess.guesser_username !== $my_username && t_guess.prompt !== $my_prompt && t_guess.prompt !== picture.prompt && t_guess.prompt !== "-----"}
        <div class="col sm-6 center-text">{t_guess.prompt}</div>
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
{:else if state === states.LEADERBOARD}
  <h1 class="has-text-centered">{picture.prompt}</h1>
  <div class="row">
    <div class="col sm-6 center-text"><strong>User</strong></div>
    <div class="col sm-3 center-text"><strong>Score</strong></div>
    <div class="col sm-3 center-text"><strong>LOLs</strong></div>
    {#each sorted_users as user}
      <div class="col sm-6">
        <div class="centered-flex">
          <Avatar username={user.username} />
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
