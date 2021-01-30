<script lang="ts">
  import type { Picture, WebSocketMessage } from "./interfaces";
  import Avatar from "./Avatar.svelte";
  import TelegramLogin from "./TelegramLogin.svelte";
  import { WebSocketConnection } from "./Websocket";
  import Draw from "./Draw.svelte";
  import Guess from "./Guess.svelte";
  import { users, my_username, my_prompt } from "./stores";
  $: user_list = [...$users];

  const states = {
    LOGIN: "login",
    WAIT_START: "wait_start",
    DRAW: "draw",
    WAIT_DRAWERS: "wait_drawers",
    GUESS: "guess",
  };

  let state = states.LOGIN;
  let img_src: string; // TODO maybe move to object store
  let assigned_prompt = "";

  let websocket = new WebSocketConnection();
  let guessComponent: Guess;

  let pictures: Picture[] = [];

  // Called by <TelegramLogin/>
  function handleLogin(event: CustomEvent) {
    state = states.WAIT_START;
    let username = event.detail.username;
    img_src = event.detail.img_src;
    let prompt = event.detail.prompt;
    my_username.set(username);
    my_prompt.set(prompt);
    users.update((users) => {
      users.set(username, {
        lol_score: 0,
        username: username,
        score: 0,
        img_src: img_src,
        proposed_prompt: prompt,
      });
      console.log([...users]);
      return users;
    });
    console.log("Logged in: ", event.detail);
    let tg_login = document.getElementById("telegram-login-minnybot");
    if (tg_login?.parentNode) tg_login.parentNode.removeChild(tg_login);
    websocket.setUp(username, img_src, prompt);
  }

  websocket.onMessage = (message: WebSocketMessage) => {
    // TODO decent dispatcher in separate component
    console.log(message.type);
    console.log(message);
    switch (message.type) {
      case "new_user":
        const new_user = {
          username: message.username,
          img_src: message.img_src,
          proposed_prompt: message.proposed_prompt,
        };
        users.update((users) => {
          users.set(new_user.username, {
            lol_score: 0,
            username: new_user.username,
            score: 0,
            img_src: new_user.img_src,
            proposed_prompt: new_user.proposed_prompt,
          });
          console.log([...users]);
          return users;
        });
        if (new_user.username === $my_username) {
          state = states.WAIT_START;
          console.log("Connected: ", message);
        }
        break;
      case "old_users":
        const old_users = Object.entries(message.users).map(
          (u: [string, [string, string]]) => {
            return {
              score: 0,
              lol_score: 0,
              username: u[0],
              img_src: u[1][0],
              proposed_prompt: u[1][1],
            };
          }
        );
        users.update((users) => {
          for (let u of old_users) {
            users.set(u.username, {
              score: 0,
              lol_score: 0,
              img_src: u.img_src,
              username: u.username,
              proposed_prompt: u.proposed_prompt,
            });
          }
          return users;
        });
        break;
      case "start_game":
        state = states.DRAW;
        assigned_prompt = message.assigned_prompt;
        break;
      case "picture":
        pictures = [
          ...pictures,
          {
            username: message.username,
            lines: message.lines,
            prompt: message.prompt,
          },
        ];
        pictures.sort();
        console.log(pictures);
        if (pictures.length === $users.size) {
          state = states.GUESS;
        }
        break;
      case "guessed_prompt":
        guessComponent.onGuess(message);
        break;
      case "voted_prompt":
        if (message.voted_username !== message.voter_username) {
          users.update((users) => {
            let user = users.get(message.voted_username);
            if (!user) {
              console.error("MISSING USER");
              alert("MISSING USER!!!!");
              return users;
            }
            user.score += 1;
            users.set(message.voted_username, user);
            console.log([...users]);
            return users;
          });
        }
        guessComponent.onVote(message);
        break;
      case "give_point":
        users.update((users) => {
          let user = users.get(message.receiver_username);
          if (!user) {
            console.error("MISSING USER");
            alert("MISSING USER!!!!");
            return users;
          }
          user.lol_score += 1;
          users.set(message.receiver_username, user);
          console.log([...users]);
          return users;
        });
        break;
      default:
        alert("Unknown type, see console");
        console.error(message);
    }
  };

  function startGame() {
    websocket?.sendObject({
      type: "start_game",
      assigned_prompt: "",
    });
  }

  // called by <Draw/>
  function sendPicture(message: CustomEvent) {
    console.log("sendPicture message", message);
    state = states.WAIT_DRAWERS;
    websocket?.sendObject({
      type: "picture",
      lines: message.detail.lines,
      prompt: message.detail.prompt,
      username: $my_username,
    });
  }

  // called by <Guess/>
  function sendVote(message: CustomEvent) {
    console.log("sendVote message", message);
    websocket?.sendObject({
      type: "voted_prompt",
      voted_username: message.detail,
      voter_username: $my_username,
    });
  }

  // called by <Guess/>
  function sendGuess(message: CustomEvent) {
    console.log("sendGuess message", message);
    websocket?.sendObject({
      type: "guessed_prompt",
      prompt: message.detail,
      guesser_username: $my_username,
    });
  }

  // called by <Guess/>
  function givePoint(message: CustomEvent) {
    console.log("givePoint message", message);
    websocket?.sendObject({
      type: "give_point",
      receiver_username: message.detail,
    });
  }
</script>

<div class="container">
  {#if state === states.LOGIN}
    <TelegramLogin on:login={handleLogin} />
  {:else if state === states.WAIT_START}
    <h1 class="title has-text-centered">Waiting for other players</h1>
    <ul>
      {#each user_list as user}
        <Avatar username={user[0]} />
      {/each}
    </ul>
    <button
      class="button"
      on:click|once={startGame}
      disabled={user_list.length < 2}
    >
      Everybody in!
    </button>
  {:else if state === states.DRAW}
    <h1 class="title has-text-centered">Let's draw!</h1>
    <Draw prompt={assigned_prompt} on:sendPicture={sendPicture} />
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
      on:sendGuess={sendGuess}
      on:givePoint={givePoint}
    />
  {:else}
    <h1 class="title has-text-centered">UNKNOWN STATE AAAA</h1>
  {/if}
  <iframe
    title="music"
    id="music-iframe"
    src="https://www.youtube.com/embed/D1RhfadVSXI"
  />
</div>

<style>
  .container {
    margin-left: auto;
    margin-right: auto;
    width: fit-content;
  }
</style>
