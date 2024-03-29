<script lang="ts">
  import type { User, Shape } from "./interfaces";
  import { shape_length, interpolated_shape } from "./shapes";
  import { tweened } from "svelte/motion";
  import { my_username, state } from "./stores";
  import { socket } from "./Websocket";
  import Avatar from "./Avatar.svelte";
  import Canvas from "./Canvas.svelte";

  function find_user(username: string): User {
    const user = $state.users.find((u) => u.username === username);
    if (user) return user;
    console.error("Error: user " + username + " not found");
    return {
      username: "",
      score: 0,
      img_src: "",
      lol_score: 0,
      proposed_prompt: "",
      assigned_prompt: "",
    };
  }

  $: my_user = find_user($my_username);

  const current_drawing = $state.drawings.find(
    (d) => d.prompt === $state.current_prompt
  ) ?? { shapes: [], username: "", prompt: "" };

  // TODO split in 3 small components for guess/vote/lol

  let guessed_prompt = "";
  let voted_prompt = "";

  $: sent_guess =
    $state.guesses.some(
      (g) =>
        g.guesser_username === $my_username &&
        g.real_prompt === $state.current_prompt
    ) ||
    $state.current_prompt == my_user.proposed_prompt ||
    $state.current_prompt == my_user.assigned_prompt;

  $: sent_vote =
    $state.votes.some(
      (v) =>
        v.voter_username === $my_username &&
        v.real_prompt === $state.current_prompt
    ) ||
    $state.current_prompt == my_user.proposed_prompt ||
    $state.current_prompt == my_user.assigned_prompt;

  async function sendGuess() {
    try {
      await socket.sendGuess({
        guessed_prompt: guessed_prompt,
        real_prompt: $state.current_prompt,
        guesser_username: $my_username,
      });
    } catch (error) {
      alert(error);
      return;
    }
    guessed_prompt = "";
  }

  async function sendVote() {
    try {
      await socket.sendVote({
        real_prompt: $state.current_prompt,
        voted_prompt: voted_prompt,
        voter_username: $my_username,
      });
    } catch (error) {
      alert(error);
      return;
    }
    voted_prompt = "";
  }

  async function sendLOL(voted_prompt: string) {
    try {
      await socket.sendLOL({
        real_prompt: $state.current_prompt,
        voted_prompt: voted_prompt,
        voter_username: $my_username,
      });
    } catch (error) {
      alert(error);
      return;
    }
  }

  function possiblePrompts(): string[] {
    let guesses = $state.guesses.filter(
      (g) =>
        g.real_prompt === $state.current_prompt &&
        g.guesser_username !== $my_username
    );
    const prompts = guesses.map((g) => g.guessed_prompt);
    if ($state.current_prompt !== my_user.proposed_prompt) {
      prompts.push($state.current_prompt);
    }
    prompts.sort();
    return prompts;
  }

  $: users_without_guess = $state.users.filter(
    (u) =>
      u.proposed_prompt !== $state.current_prompt &&
      u.username !== current_drawing.username &&
      !$state.guesses.some(
        (g) =>
          g.guesser_username === u.username &&
          g.real_prompt === $state.current_prompt
      )
  );

  $: users_without_vote = $state.users.filter(
    (u) =>
      u.proposed_prompt !== $state.current_prompt &&
      u.username !== current_drawing.username &&
      !$state.votes.some(
        (g) =>
          g.voter_username === u.username &&
          g.real_prompt === $state.current_prompt
      )
  );

  const tween_value = tweened(0);
  tween_value.set(1, { duration: 10000 });

  let tweened_shapes: Shape[] = [];

  const sum = (arr: number[]): number => {
    let t = 0;
    for (let n of arr) t += n;
    return t;
  };

  const total_length = sum(current_drawing.shapes.map(shape_length));

  function updateTweenedShapes(value: number, shapes: Shape[]) {
    tweened_shapes = [];
    let length_left = Math.floor(value * total_length);
    for (let shape of shapes) {
      let s_length = shape_length(shape);
      if (s_length <= length_left) {
        tweened_shapes.push(shape);
        length_left -= s_length;
      } else {
        shape = interpolated_shape(shape, length_left);
        tweened_shapes.push(shape);
        break;
      }
    }
    tweened_shapes = tweened_shapes;
  }

  $: updateTweenedShapes($tween_value, current_drawing.shapes);
</script>

{#if $state.phase === "guess"}
  {#if sent_guess}
    <h1 class="has-text-centered">Wait for everybody to guess</h1>
  {:else}
    <h1 class="has-text-centered">Type your guess for:</h1>
  {/if}
{:else if $state.phase === "vote"}
  {#if sent_vote}
    <h1 class="has-text-centered">Wait for everybody to pick</h1>
  {:else}
    <h1 class="has-text-centered">Pick one!</h1>
  {/if}
{:else if $state.phase === "lol vote"}
  <h1 class="has-text-centered">Give LOLs!</h1>
{:else}
  <h1 class="has-text-centered">UNKNOWN PHASE</h1>
{/if}

<Canvas shapes={tweened_shapes} editable={false} />

{#if $state.phase === "guess"}
  {#if sent_guess}
    <h2 class="has-text-centered">Got guesses:</h2>
    <div class="centered-flex">
      <Avatar user={find_user(current_drawing.username)} />
      <Avatar
        user={$state.users.find(
          (u) => u.proposed_prompt === $state.current_prompt
        )}
      />
      {#each $state.guesses.filter((g) => g.real_prompt === $state.current_prompt) as guess (guess.guesser_username)}
        <Avatar user={find_user(guess.guesser_username)} />
      {/each}
    </div>
    <h2 class="has-text-centered">Waiting for:</h2>
    <div class="centered-flex">
      {#each users_without_guess as user (user.username)}
        <Avatar {user} />
      {/each}
    </div>
  {:else}
    <div class="row">
      <div class="col sm-10">
        <div class="form-group">
          <input
            bind:value={guessed_prompt}
            on:keyup={async (key) => {
              key.code === "Enter" ? await sendGuess() : null;
            }}
            class="input-block"
            type="text"
            placeholder="Your guess"
            required
          />
        </div>
      </div>
      <div class="col sm-2">
        <button on:click={sendGuess} disabled={guessed_prompt.length === 0}>
          Send!
        </button>
      </div>
    </div>
  {/if}
{:else if $state.phase === "vote"}
  {#if sent_vote}
    <h2 class="has-text-centered">Got votes:</h2>
    <div class="centered-flex">
      <Avatar user={find_user(current_drawing.username)} />
      <Avatar
        user={$state.users.find(
          (u) => u.proposed_prompt === $state.current_prompt
        )}
      />
      {#each $state.votes.filter((v) => v.real_prompt === $state.current_prompt) as vote (vote.voter_username)}
        <Avatar user={find_user(vote.voter_username)} />
      {/each}
    </div>
    <h2 class="has-text-centered">Waiting for:</h2>
    <div class="centered-flex">
      {#each users_without_vote as user (user.username)}
        <Avatar {user} />
      {/each}
    </div>
  {:else}
    <div class="row">
      <div class="col sm-10 center-text">
        {#each possiblePrompts() as prompt}
          <div
            class="row voterow"
            on:click={() => (voted_prompt = prompt)}
            class:row-selected={voted_prompt === prompt}
          >
            <div class="col sm-1">
              <input
                id={prompt}
                type="radio"
                bind:group={voted_prompt}
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
        <button on:click={sendVote} disabled={!voted_prompt}> Send! </button>
      </div>
    </div>
  {/if}
{:else if $state.phase === "lol vote"}
  {#each possiblePrompts() as prompt}
    <div class="row">
      <div class="col sm-6 center-text">{prompt}</div>
      <div class="col sm-6 center-text">
        <button
          on:click|once={async () => await sendLOL(prompt)}
          disabled={$state.lol_votes.some(
            (v) =>
              v.voter_username === $my_username &&
              v.real_prompt === $state.current_prompt &&
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
