<script lang="ts">
  import type { User } from "./interfaces";
  import Avatar from "./Avatar.svelte";
  import TelegramLogin from "./TelegramLogin.svelte";
  import { socket } from "./Websocket";
  import Draw from "./Draw.svelte";
  import Guess from "./Guess.svelte";
  import { state, my_username, my_prompt } from "./stores";
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

  let img_src: string; // TODO maybe move to object store

  let guessComponent: Guess;

  // Called by <TelegramLogin/>
  async function handleLogin(event: CustomEvent) {
    let username = event.detail.username;
    img_src = event.detail.img_src;
    let prompt = event.detail.prompt.toUpperCase();
    try {
      await socket.login(username, img_src, prompt);
    } catch (error) {
      alert(error);
      return;
    }
    my_username.set(username);
    my_prompt.set(prompt);
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
        {#each user_list as user}
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
        {#each $state.drawings as drawing}
          <Avatar user={find_user(drawing.username)} />
        {/each}
      </div>
    {:else}
      <h1 class="has-text-centered">Let's draw!</h1>
      <Draw />
    {/if}
  {:else if $state.phase === "guess"}
    <Guess bind:this={guessComponent} />
  {:else}
    <h1 class="has-text-centered">UNKNOWN STATE AAAA!!!! {$state.phase}</h1>
  {/if}
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
