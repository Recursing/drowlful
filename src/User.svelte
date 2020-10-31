<script lang="ts">
  import type { Picture } from "./interfaces";
  import Avatar from "./Avatar.svelte";
  import TelegramLogin from "./TelegramLogin.svelte";
  import WebRTCConnection from "./WebRTCConnection.svelte";
  import Draw from "./Draw.svelte";
  import Guess from "./Guess.svelte";
  import { users, my_username } from "./stores";
  $: user_list = [...$users];

  const states = {
    LOGIN: "login",
    CONNECT: "connect",
    WAIT_START: "wait_start",
    DRAW: "draw",
    WAIT_DRAWERS: "wait_drawers",
    GUESS: "guess",
  };

  let state = states.LOGIN;
  let img_src: string; // TODO maybe move to object store

  let connectionComponent: WebRTCConnection | null = null;
  let guessComponent: Guess;

  let pictures: Picture[] = [];

  // Called by <TelegramLogin/>
  function handleLogin(event: CustomEvent) {
    state = states.CONNECT;
    let username = event.detail.username;
    img_src = event.detail.img_src;
    my_username.set(username);
    console.log("Logged in: ", event.detail);
    let tg_login = document.getElementById("telegram-login-minnybot");
    if (tg_login?.parentNode) tg_login.parentNode.removeChild(tg_login);
  }

  // Called by <WebRTCConnection/>
  function onMessage(message: CustomEvent) {
    // TODO decent dispatcher in separate component
    console.log(message.detail.type);
    console.log(message);
    switch (message.detail.type) {
      case "new_user":
        const new_user = {
          username: message.detail.username,
          img_src: message.detail.img_src,
        };
        users.update((users) => {
          users.set(new_user.username, { score: 0, img_src: new_user.img_src });
          console.log([...users]);
          return users;
        });
        if (new_user.username === $my_username) {
          state = states.WAIT_START;
          console.log("Connected: ", message.detail);
        }
        break;
      case "old_users":
        const old_users = message.detail.users.map((u: [string, string]) => {
          return { score: 0, username: u[0], img_src: u[1] };
        });
        users.update((users) => {
          for (let u of old_users) {
            users.set(u.username, { score: 0, img_src: u.img_src });
          }
          return users;
        });
        break;
      case "start_game":
        state = states.DRAW;
        break;
      case "picture":
        pictures = [
          ...pictures,
          {
            username: message.detail.username,
            lines: message.detail.lines,
            prompt: message.detail.prompt,
          },
        ];
        pictures.sort();
        console.log(pictures);
        if (pictures.length === $users.size) {
          state = states.GUESS;
        }
        break;
      default:
        alert("Unknown type, see console");
      case "guessed_prompt":
        guessComponent.onGuess(message.detail);
        break;
      case "voted_prompt":
        guessComponent.onVote(message.detail);
        break;
    }
  }

  // called by <Draw/>
  function sendPicture(message: CustomEvent) {
    console.log("sendPicture message", message);
    state = states.WAIT_DRAWERS;
    connectionComponent?.sendObject({
      type: "picture",
      lines: message.detail.lines,
      prompt: message.detail.prompt,
    });
  }

  // called by <Guess/>
  function sendVote(message: CustomEvent) {
    console.log("sendVote message", message);
    connectionComponent?.sendObject({
      type: "voted_prompt",
      prompt: message.detail,
    });
  }

  // called by <Guess/>
  function sendGuess(message: CustomEvent) {
    console.log("sendGuess message", message);
    connectionComponent?.sendObject({
      type: "guessed_prompt",
      prompt: message.detail,
    });
  }
</script>

<style>
  .container {
    margin-left: 1em;
    margin-right: 1em;
  }
</style>

<div class="container">
  {#if state === states.LOGIN}
    <TelegramLogin on:login={handleLogin} />
  {:else if state === states.CONNECT}
    <h1 class="title has-text-centered">Hello {$my_username}! Send me this!</h1>
    <WebRTCConnection
      bind:this={connectionComponent}
      username={$my_username}
      {img_src}
      on:onMessage={onMessage} />
  {:else if state === states.WAIT_START}
    <h1 class="title has-text-centered">Waiting for other players</h1>
    <ul>
      {#each user_list as user}
        <Avatar username={user[0]} />
      {/each}
    </ul>
  {:else if state === states.DRAW}
    <h1 class="title has-text-centered">Let's draw!</h1>
    <Draw on:sendPicture={sendPicture} />
  {:else if state === states.WAIT_DRAWERS}
    <h1 class="title has-text-centered">
      Waiting for other players to finish drawing, got:
    </h1>
    {#each pictures as picture}
      <Avatar username={picture.username} />
    {/each}
  {:else if state === states.GUESS}
    <Guess
      bind:this={guessComponent}
      {pictures}
      on:sendVote={sendVote}
      on:sendGuess={sendGuess} />
  {:else}
    <h1 class="title has-text-centered">UNKNOWN STATE AAAA</h1>
  {/if}
</div>
