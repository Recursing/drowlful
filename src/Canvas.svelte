<script lang="ts">
  import type { Line } from "./interfaces";
  export let lines: Line[] = [];
  export let editable = true;
  let cur_line: Line = { stroke: "#ff0000", width: 2, points: "" };
  let is_drawing = false;

  function onMouseup() {
    if (!is_drawing) {
      return;
    }
    is_drawing = false;
    if (cur_line.points.split(" ").length < 2) {
      return;
    }
    lines.push({
      stroke: cur_line.stroke,
      width: cur_line.width,
      points: cur_line.points,
    });
    lines = lines;
    cur_line.points = "";
  }

  function onMousedown() {
    if (!editable) {
      return;
    }
    is_drawing = true;
  }

  function onMousemove(ev: MouseEvent) {
    if (!is_drawing) {
      return;
    }
    cur_line.points += " " + ev.offsetX + "," + ev.offsetY;
  }
</script>

<svg
  on:mousemove={onMousemove}
  on:mouseup={onMouseup}
  on:mousedown={onMousedown}
  on:mouseleave={onMouseup}
  width="800"
  height="600"
>
  {#each lines as { stroke, width, points }}
    <polyline
      style="fill: none; stroke: {stroke}; stroke-width: {width}"
      {points}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {/each}
  <polyline
    style="fill: none; stroke: {cur_line.stroke}; stroke-width: {cur_line.width}"
    points={cur_line.points}
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>

{#if editable}
  <div class="controls centered-flex">
    <label>
      Size: {cur_line.width}
      <input type="range" bind:value={cur_line.width} min="1" max="80" />
    </label>
    <input type="color" bind:value={cur_line.stroke} />
    <button
      on:click={() => {
        lines.length > 0 ? (lines = lines.slice(0, lines.length - 1)) : "";
      }}
    >
      UNDO
    </button>
  </div>
{/if}

<style>
  svg {
    overflow: visible;
    margin: 0 auto;
    border-style: solid;
    display: block;
  }
  polyline {
    pointer-events: none;
  }
  .controls > * {
    margin: 1em;
  }

  input[type="color"] {
    padding: 0.2rem;
    height: 3rem;
    width: 5rem;
  }
</style>
