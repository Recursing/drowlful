<script lang="ts">
  import type { State } from "./interfaces";
  import SmallAvatar from "./SmallAvatar.svelte";
  import Canvas from "./Canvas.svelte";
  export let state: State;

  function findGuess(prompt: string, username: string): string {
    return (
      state.guesses.find(
        (g) => g.real_prompt === prompt && g.guesser_username === username
      )?.guessed_prompt || ""
    );
  }

  function findVote(prompt: string, username: string): string {
    return (
      state.votes.find(
        (v) => v.real_prompt === prompt && v.voter_username === username
      )?.voted_prompt || ""
    );
  }

  function findScore(prompt: string, guess: string): number {
    return (
      state.votes.filter(
        (v) => v.real_prompt === prompt && v.voted_prompt === guess
      ).length * 100
    );
  }

  function findLOLScore(prompt: string, guess: string): number {
    return state.lol_votes.filter(
      (v) => v.real_prompt === prompt && v.voted_prompt === guess
    ).length;
  }
  state.users.sort((u1, u2) =>
    u1.username.toUpperCase() > u2.username.toUpperCase() ? 1 : -1
  );
</script>

<div class="container">
  {#each state.drawings as drawing}
    <div class="stack">
      <div class="col2">
        <Canvas lines={drawing.lines} editable={false} />
        <h1 class="has-text-centered">{drawing.prompt}</h1>
      </div>
      <div class="col2">
        <div class="row">
          <div class="col sm-2 center-text"><strong>User</strong></div>
          <div class="col sm-5 center-text">
            <strong>Guessed</strong>
          </div>
          <div class="col sm-5 center-text">
            <strong>Voted</strong>
          </div>
          {#each state.users as user (user.username)}
            <div class="col sm-2">
              <div class="centered-flex">
                <SmallAvatar {user} />
              </div>
            </div>
            <div class="col sm-5 center-text">
              {#if user.proposed_prompt === drawing.prompt}
                WRITER
                {#if findLOLScore(drawing.prompt, drawing.prompt)}
                  <div class="green">
                    +{findLOLScore(drawing.prompt, drawing.prompt)} LOL
                  </div>
                {/if}
              {:else if drawing.username === user.username}
                ARTIST
                {#if findScore(drawing.prompt, drawing.prompt)}
                  <div class="green">
                    +{findScore(drawing.prompt, drawing.prompt)}
                  </div>
                {/if}
              {:else}
                {findGuess(drawing.prompt, user.username)}
                {#if findScore(drawing.prompt, findGuess(drawing.prompt, user.username))}
                  <div class="green">
                    +{findScore(
                      drawing.prompt,
                      findGuess(drawing.prompt, user.username)
                    )}
                  </div>
                {/if}
                {#if findLOLScore(drawing.prompt, findGuess(drawing.prompt, user.username))}
                  <div class="green">
                    +{findLOLScore(
                      drawing.prompt,
                      findGuess(drawing.prompt, user.username)
                    )} LOL
                  </div>
                {/if}
              {/if}
            </div>
            <div class="col sm-5 center-text">
              {findVote(drawing.prompt, user.username)}
              {#if findVote(drawing.prompt, user.username) === drawing.prompt}
                <div class="green">+100</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .stack {
    display: flex;
  }
  h1 {
    font-size: 4em;
    color: red;
    font-weight: 100;
  }
  .container {
    max-width: none;
    margin-left: auto;
    margin-right: auto;
  }
  .center-text {
    text-align: center;
    margin: auto;
  }
  .green {
    color: rgb(22, 212, 22);
  }
</style>
