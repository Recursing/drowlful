<script lang="ts">
  import type { Shape } from "./interfaces";
  import Canvas from "./Canvas.svelte";
  import { my_username, state } from "./stores";
  import { socket } from "./Websocket";

  // TODO move my_user to stores
  $: my_user = $state.users.find((u) => u.username === $my_username);
  $: prompt = my_user ? my_user.assigned_prompt : "";

  $: sent_drawing = $state.drawings.some((d) => d.username === $my_username);
  let shapes: Shape[] = [];

  let onDone = async function () {
    if (sent_drawing || !confirm("Send Drawing?")) {
      return;
    }
    console.log("sendDrawing:", shapes, prompt);
    try {
      await socket.sendDrawing({
        shapes: shapes,
        prompt: prompt,
        username: $my_username,
      });
    } catch (error) {
      alert(error);
    }
    sent_drawing = true;
  };
</script>

<h1 class="has-text-centered">{prompt}</h1>
<Canvas bind:shapes />

<button on:click|once={onDone} disabled={shapes.length === 0}>Done!</button>

<style>
  h1 {
    font-size: 4em;
    color: red;
    font-weight: 100;
  }
  button {
    width: 100%;
  }
</style>
