<script lang="ts">
  import type { Line } from "./interfaces";
  import Canvas from "./Canvas.svelte";
  import { tweened } from "svelte/motion";
  import { my_username, state } from "./stores";
  import { socket } from "./Websocket";

  const tot_time = 181;
  let prompt = $state.users.filter((u) => u.username === $my_username)[0]
    .assigned_prompt;
  let lines: Line[] = [];
  const progress = tweened(0, {
    duration: tot_time * 1000,
  });
  $: sec_left = Math.floor((1 - $progress) * tot_time);
  let already_sent = false;
  let onDone = async function () {
    if (already_sent || !confirm("Send Drawing?")) {
      return;
    }
    console.log("sendDrawing:", lines, prompt);
    try {
      await socket.sendDrawing({
        lines: lines,
        prompt: prompt,
        username: $my_username,
      });
    } catch (error) {
      alert(error);
    }
    already_sent = true;
    progress.set(1);
  };
  progress.set(1).then(onDone);
</script>

<h1 class="has-text-centered">{prompt}</h1>
<Canvas bind:lines />

<h1 class="has-text-centered">{sec_left}</h1>
<progress
  class="progress margin-bottom"
  class:is-success={$progress < 0.5}
  class:is-warning={$progress >= 0.5 && $progress < 0.8}
  class:is-danger={$progress >= 0.8}
  value={$progress}
/>
<button on:click|once={onDone} disabled={lines.length === 0}>Done!</button>

<style>
  h1 {
    font-size: 4em;
    color: red;
    font-weight: 100;
  }
  progress,
  button {
    width: 100%;
  }
</style>
