<script lang="ts">
  import type { Shape } from "./interfaces";
  export let shapes: Shape[] = [];
  export let editable = true;
  let cur_shape: Shape = {
    type: "polyline",
    stroke: "#ff0000",
    width: 2,
    points: [],
    fill: false,
  };
  let is_drawing = false;

  function onMouseup() {
    if (!is_drawing) {
      return;
    }
    is_drawing = false;
    switch (cur_shape.type) {
      case "polyline":
        if (cur_shape.points.length < 2) {
          return;
        }
        break;
      case "ellipse":
        if (cur_shape.y1 === cur_shape.y2 || cur_shape.x1 === cur_shape.x2) {
          return;
        }
        break;
    }
    shapes.push({ ...cur_shape });
    shapes = shapes;
  }

  function onMousedown(ev: MouseEvent) {
    if (!editable) {
      return;
    }
    is_drawing = true;
    switch (cur_shape.type) {
      case "polyline":
        cur_shape.points = [[ev.offsetX, ev.offsetY]];
        break;
      case "ellipse":
        cur_shape.y1 = cur_shape.y2 = ev.offsetY;
        cur_shape.x1 = cur_shape.x2 = ev.offsetX;
        break;
    }
  }

  function onMousemove(ev: MouseEvent) {
    if (!is_drawing) {
      return;
    }
    switch (cur_shape.type) {
      case "polyline":
        if (ev.shiftKey) {
          cur_shape.points = [cur_shape.points[0], [ev.offsetX, ev.offsetY]];
        } else {
          cur_shape.points.push([ev.offsetX, ev.offsetY]);
          cur_shape.points = cur_shape.points;
        }
        break;
      case "ellipse":
        cur_shape.y2 = ev.offsetY;
        cur_shape.x2 = ev.offsetX;
        break;
    }
  }

  function onKeydown(ev: KeyboardEvent) {
    if (ev.key === "Alt") {
      cur_shape.fill = true;
    }
  }

  function onKeyup(ev: KeyboardEvent) {
    if (ev.key === "Alt") {
      cur_shape.fill = false;
    }
  }

  function calcWidth(width: number) {
    return (
      width +
      Math.max(0, width - 10) +
      Math.max(0, width - 20) +
      Math.max(0, width - 30)
    );
  }
  let slider_value = 2;
  $: cur_shape.width = calcWidth(slider_value);
</script>

<svelte:window on:keydown={onKeydown} on:keyup={onKeyup} />

<svg
  on:mousemove={onMousemove}
  on:mouseup={onMouseup}
  on:mousedown={onMousedown}
  on:mouseleave={onMouseup}
  width="800"
  height="600"
>
  {#each is_drawing ? [...shapes, cur_shape] : shapes as shape}
    {#if shape.type === "polyline"}
      <polyline
        style="fill: {shape.fill
          ? shape.stroke
          : 'none'}; stroke: {shape.stroke}; stroke-width: {shape.width}"
        points={shape.points.map(([x, y]) => `${x},${y}`).join(" ")}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {:else if shape.type === "ellipse"}
      <ellipse
        style="fill: {shape.fill
          ? shape.stroke
          : 'none'}; stroke: {shape.stroke}; stroke-width: {shape.width}"
        cx={(shape.x1 + shape.x2) / 2}
        cy={(shape.y1 + shape.y2) / 2}
        rx={Math.abs(shape.x1 - shape.x2) / 2}
        ry={Math.abs(shape.y1 - shape.y2) / 2}
      />
    {/if}
  {/each}
</svg>

{#if editable}
  <div class="controls centered-flex">
    <div>
      <label>
        Size: {cur_shape.width}
        <input type="range" bind:value={slider_value} min="1" max="40" />
      </label>
      <label>
        <input
          id="fill_checkbox"
          type="checkbox"
          bind:checked={cur_shape.fill}
        />
        <span>Fill: {cur_shape.fill}</span>
      </label>
      <div>
        <input
          id="polyline"
          type="radio"
          bind:group={cur_shape.type}
          value="polyline"
        />
        <label for="polyline">Line</label>
        <input
          id="ellipse"
          type="radio"
          bind:group={cur_shape.type}
          value="ellipse"
        />
        <label for="ellipse">Ellipse</label>
      </div>
    </div>
    <label>
      Color: {cur_shape.stroke}
      <input type="color" bind:value={cur_shape.stroke} />
      <select bind:value={cur_shape.stroke}>
        <option value="#FF0000">red</option>
        <option value="#FFA500">orange</option>
        <option value="#ffff00">yellow</option>
        <option value="#008000">green</option>
        <option value="#00ffff">cyan</option>
        <option value="#0000ff">blue</option>
        <option value="#800080">purple</option>
        <option value="#ffc0cb">pink</option>
        <option value="#ffffff">white</option>
        <option value="#000000">black</option>
        <option value="#808080">gray</option>
        <option value="#8b4513">saddlebrown</option>
      </select>
    </label>
    <button
      on:click={() => {
        shapes.length > 0 ? (shapes = shapes.slice(0, shapes.length - 1)) : "";
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
  polyline,
  ellipse {
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
  input[type="checkbox"],
  input[type="radio"] {
    display: inline;
  }

  input[type="range"] {
    box-shadow: none;
    width: 300px;
  }
</style>
