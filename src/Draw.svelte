<script>
  import Canvas from "./Canvas.svelte";
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();
  import { tweened } from "svelte/motion";
  const tot_time = 101;
  import prompts from "./prompts.json";
  const prompt = prompts[
    Math.floor(Math.random() * prompts.length)
  ].toUpperCase();
  export let lines = [];
  const progress = tweened(0, {
    duration: tot_time * 1000
  });
  $: sec_left = Math.floor((1 - $progress) * tot_time);
  let already_sent = false;
  let onDone = function() {
    if (already_sent) {
      return;
    }
    progress.set(1);
    if (confirm("Send picture?")) {
      dispatch("sendPicture", { lines: lines, prompt: prompt });
      already_sent = true;
    }
  };
  progress.set(1).then(onDone);
</script>

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

<h1 class="is-title has-text-centered">{prompt}</h1>
<Canvas bind:lines />

<h1 class="has-text-centered">{sec_left}</h1>
<progress
  class="progress"
  class:is-success={$progress < 0.5}
  class:is-warning={$progress >= 0.5 && $progress < 0.8}
  class:is-danger={$progress >= 0.8}
  value={$progress} />
<button on:click={onDone} disabled={lines.length === 0}>Done!</button>
