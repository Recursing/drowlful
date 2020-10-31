<script lang="ts">
  import type { Line } from "./interfaces";
  export let lines: Line[] = [];
  export let editable = true;
  let cur_line: Line = { stroke: "red", width: 2, points: "" };
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
  .controls {
    margin-left: 3em;
    width: 50%;
    margin: 0 auto;
  }
</style>

<svg
  on:mousemove={onMousemove}
  on:mouseup={onMouseup}
  on:mousedown={onMousedown}
  on:mouseleave={onMouseup}
  width="800"
  height="600">
  {#each lines as { stroke, width, points }}
    <polyline
      style="fill: none; stroke: {stroke}; stroke-width: {width}"
      {points}
      stroke-linecap="round"
      stroke-linejoin="round" />
  {/each}
  <polyline
    style="fill: none; stroke: {cur_line.stroke}; stroke-width: {cur_line.width}"
    points={cur_line.points}
    stroke-linecap="round"
    stroke-linejoin="round" />
</svg>

{#if editable}
  <div class="controls">
    <label>
      Width:
      <input type="number" bind:value={cur_line.width} min="1" max="30" />
      <input type="range" bind:value={cur_line.width} min="1" max="30" />
      Color:
      <select bind:value={cur_line.stroke}>
        <option>red</option>
        <option>orange</option>
        <option>yellow</option>
        <option>green</option>
        <option>cyan</option>
        <option>blue</option>
        <option>purple</option>
        <option>pink</option>
        <option>white</option>
        <option>black</option>
        <option>gray</option>
        <option>brown</option>
      </select>
      <button
        on:click={() => {
          lines.length > 0 ? (lines = lines.slice(0, lines.length - 1)) : '';
        }}>
        undo
      </button>
    </label>
  </div>
{/if}
