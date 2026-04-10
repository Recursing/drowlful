<script lang="ts">
	import type { Shape } from '$lib/types';

	let { shapes = $bindable<Shape[]>([]), editable = true }: { shapes?: Shape[]; editable?: boolean } = $props();

	let cur_shape = $state<Shape>({
		type: 'polyline',
		stroke: '#ff0000',
		width: 2,
		points: [],
		fill: false
	});
	let is_drawing = $state(false);
	let slider_value = $state(2);

	let cur_width = $derived(
		slider_value +
			Math.max(0, slider_value - 10) +
			Math.max(0, slider_value - 20) +
			Math.max(0, slider_value - 30)
	);

	function svgPoint(ev: PointerEvent): [number, number] {
		const ctm = (ev.currentTarget as SVGSVGElement).getScreenCTM()!;
		return [(ev.clientX - ctm.e) / ctm.a, (ev.clientY - ctm.f) / ctm.d];
	}

	function onPointerup() {
		if (!is_drawing) return;
		is_drawing = false;
		switch (cur_shape.type) {
			case 'polyline':
				if (cur_shape.points.length < 2) return;
				break;
			case 'ellipse':
				if (cur_shape.y1 === cur_shape.y2 || cur_shape.x1 === cur_shape.x2) return;
				break;
		}
		shapes = [...shapes, { ...cur_shape }];
	}

	function onPointerdown(ev: PointerEvent) {
		if (!editable) return;
		(ev.currentTarget as Element).setPointerCapture(ev.pointerId);
		is_drawing = true;
		cur_shape.width = cur_width;
		const [x, y] = svgPoint(ev);
		switch (cur_shape.type) {
			case 'polyline':
				cur_shape = { ...cur_shape, points: [[x, y]] };
				break;
			case 'ellipse':
				cur_shape = {
					...cur_shape,
					y1: y,
					y2: y,
					x1: x,
					x2: x
				};
				break;
		}
	}

	function onPointermove(ev: PointerEvent) {
		if (!is_drawing) return;
		const [x, y] = svgPoint(ev);
		switch (cur_shape.type) {
			case 'polyline':
				if (ev.shiftKey) {
					const first = cur_shape.points[0];
					if (!first) break;
					cur_shape = { ...cur_shape, points: [first, [x, y]] };
				} else {
					const last = cur_shape.points[cur_shape.points.length - 1];
					if (!last) break;
					const dx = x - last[0], dy = y - last[1];
					if (dx * dx + dy * dy < 9) return; // skip if < 3px moved
					cur_shape = { ...cur_shape, points: [...cur_shape.points, [x, y]] };
				}
				break;
			case 'ellipse':
				cur_shape = { ...cur_shape, y2: y, x2: x };
				break;
		}
	}

	function onKeydown(ev: KeyboardEvent) {
		if (ev.key === 'Alt') {
			cur_shape = { ...cur_shape, fill: true };
		}
	}

	function onKeyup(ev: KeyboardEvent) {
		if (ev.key === 'Alt') {
			cur_shape = { ...cur_shape, fill: false };
		}
	}
</script>

<svelte:window onkeydown={onKeydown} onkeyup={onKeyup} />

<svg
	onpointermove={onPointermove}
	onpointerup={onPointerup}
	onpointerdown={onPointerdown}
	onpointerleave={onPointerup}
	viewBox="0 0 800 600"
	width="100%"
	style="max-width: 800px;"
	role="img"
>
	{#each is_drawing ? [...shapes, cur_shape] : shapes as shape}
		{#if shape.type === 'polyline'}
			<polyline
				style="fill: {shape.fill ? shape.stroke : 'none'}; stroke: {shape.stroke}; stroke-width: {shape.width}"
				points={shape.points.map(([x, y]) => `${x},${y}`).join(' ')}
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		{:else if shape.type === 'ellipse'}
			<ellipse
				style="fill: {shape.fill ? shape.stroke : 'none'}; stroke: {shape.stroke}; stroke-width: {shape.width}"
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
				Size: {cur_width}
				<input type="range" bind:value={slider_value} min="1" max="40" />
			</label>
			<label>
				<input id="fill_checkbox" type="checkbox" bind:checked={cur_shape.fill} />
				<span>Fill: {cur_shape.fill}</span>
			</label>
			<div>
				<input id="polyline" type="radio" bind:group={cur_shape.type} value="polyline" />
				<label for="polyline">Line</label>
				<input id="ellipse" type="radio" bind:group={cur_shape.type} value="ellipse" />
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
			onclick={() => {
				if (shapes.length > 0) shapes = shapes.slice(0, shapes.length - 1);
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
		touch-action: none;
	}
	polyline,
	ellipse {
		pointer-events: none;
	}

	.controls > :global(*) {
		margin: 1em;
	}

	input[type='color'] {
		padding: 0.2rem;
		height: 3rem;
		width: 5rem;
	}
	input[type='checkbox'],
	input[type='radio'] {
		display: inline;
	}

	input[type='range'] {
		box-shadow: none;
		width: min(300px, 100%);
	}
</style>
