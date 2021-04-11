<script lang="ts">
  import { state, previousLOLScore, previousScore } from "./stores";
  import Canvas from "./Canvas.svelte";
  import Avatar from "./Avatar.svelte";
  $: current_drawing = $state.drawings.find(
    (d) => d.prompt === $state.current_prompt
  ) ?? { lines: [], username: "", prompt: "" };

  $: userVotes = new Map(
    $state.votes
      .filter((v) => v.real_prompt === $state.current_prompt)
      .map((v) => [v.voter_username, v.voted_prompt])
  );

  $: userGuesses = new Map(
    $state.guesses
      .filter((g) => g.real_prompt === $state.current_prompt)
      .map((g) => [g.guesser_username, g.guessed_prompt])
  );

  $: sortedUsers = [...$state.users].sort(
    (u1, u2) => u2.score + u2.lol_score - u1.score - u1.lol_score
  );
</script>

{#if $state.phase === "end"}
  <h1 class="has-text-centered">THE END!</h1>
{:else}
  <Canvas lines={current_drawing.lines} editable={false} />
  <h1 class="has-text-centered">{$state.current_prompt}</h1>
{/if}

<div class="row">
  <div class="col sm-2 center-text"><strong>User</strong></div>
  <div class="col sm-2 center-text"><strong>Score</strong></div>
  <div class="col sm-2 center-text"><strong>LOLs</strong></div>
  <div class="col sm-3 center-text">
    {#if $state.phase === "leaderboard"}<strong>Guessed</strong>{/if}
  </div>
  <div class="col sm-3 center-text">
    {#if $state.phase === "leaderboard"}<strong>Voted</strong>{/if}
  </div>
  {#each sortedUsers as user (user.username)}
    <div class="col sm-2">
      <div class="centered-flex">
        <Avatar {user} />
      </div>
    </div>
    <div class="col sm-2 center-text">
      {user.score}
      {#if user.score > ($previousScore.get(user.username) ?? 0) && $state.phase === "leaderboard"}
        <span>+{user.score - ($previousScore.get(user.username) ?? 0)}</span>
      {/if}
    </div>
    <div class="col sm-2 center-text">
      {user.lol_score}
      {#if user.lol_score > ($previousLOLScore.get(user.username) ?? 0) && $state.phase === "leaderboard"}
        <span>
          +{user.lol_score - ($previousLOLScore.get(user.username) ?? 0)}
        </span>
      {/if}
    </div>
    <div class="col sm-3 center-text">
      {#if $state.phase === "leaderboard"}
        {#if $state.current_prompt === user.assigned_prompt}
          <span>ARTIST</span>
        {:else if $state.current_prompt === user.proposed_prompt}
          <span>WRITER</span>
        {:else}
          {userGuesses.get(user.username) ?? ""}
        {/if}
      {/if}
    </div>
    <div class="col sm-3 center-text">
      {#if $state.phase === "leaderboard"}
        {userVotes.get(user.username) ?? ""}
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
