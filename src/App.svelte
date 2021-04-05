<script lang="ts">
  import type { User } from "./interfaces";
  import Avatar from "./Avatar.svelte";
  import TelegramLogin from "./TelegramLogin.svelte";
  import { socket } from "./Websocket";
  import Draw from "./Draw.svelte";
  import Guess from "./Guess.svelte";
  import Progressbar from "./Progressbar.svelte";
  import { state, my_username } from "./stores";
  $: user_list = [...$state.users];

  // TODO move to store, maybe add map
  function find_user(username: string): User {
    for (let user of user_list) {
      if (user.username === username) {
        return user;
      }
    }
    throw Error("User " + username + " not found");
  }

  let guessComponent: Guess;

  // Called by <TelegramLogin/>
  async function handleLogin(event: CustomEvent) {
    const username = event.detail.username;
    const img_src = event.detail.img_src;
    const prompt = event.detail.prompt.toUpperCase().trim();
    try {
      await socket.login(username, img_src, prompt);
    } catch (error) {
      alert(error);
      return;
    }
    my_username.set(username);
    console.log("Logged in: ", event.detail);
    let tg_login = document.getElementById("telegram-login-minnybot");
    if (tg_login?.parentNode) tg_login.parentNode.removeChild(tg_login);
  }

  async function startGame() {
    try {
      await socket.startGame();
    } catch (error) {
      alert(error);
    }
  }
</script>

<div class="container">
  {#if $state.phase === "login"}
    {#if $my_username === ""}
      <TelegramLogin on:login={handleLogin} />
    {:else}
      <h1 class="has-text-centered">Waiting for other players</h1>
      <div class="centered-flex">
        {#each user_list as user (user.username)}
          <Avatar {user} />
        {/each}
      </div>
      <button
        class="button centered-flex"
        on:click={startGame}
        disabled={user_list.length < 4}
      >
        Everybody in!
      </button>
    {/if}
  {:else if $state.phase === "draw"}
    {#if $state.drawings.some((d) => d.username === $my_username)}
      <h1 class="has-text-centered">
        Waiting for other players to finish drawing, got:
      </h1>
      <div class="centered-flex">
        {#each $state.drawings as drawing (drawing.username)}
          <Avatar user={find_user(drawing.username)} />
        {/each}
      </div>
    {:else}
      <h1 class="has-text-centered">Let's draw!</h1>
      <Draw />
    {/if}
  {:else if $state.phase === "guess" || $state.phase === "vote" || $state.phase === "lol vote" || $state.phase === "leaderboard"}
    <Guess bind:this={guessComponent} />
  {:else if $state.phase === "end"}
    <h1 class="has-text-centered">THE END!</h1>
  {:else}
    <h1 class="has-text-centered">UNKNOWN STATE AAAA!!!! {$state.phase}</h1>
  {/if}

  <Progressbar />
  <!-- <iframe
    title="music"
    id="music-iframe"
    src="https://www.youtube.com/embed/D1RhfadVSXI"
  /> -->
</div>

<style>
  .container {
    margin-left: auto;
    margin-right: auto;
  }
</style>
