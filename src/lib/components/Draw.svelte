<script lang="ts">
	import { sendDrawing } from '$lib/api';
	import { game } from '$lib/game-state.svelte';
	import { modal } from '$lib/modal.svelte';
	import type { Shape } from '$lib/types';
	import Canvas from './Canvas.svelte';

	let myUser = $derived(game.current.users.find((u) => u.username === game.myUsername));
	let prompt = $derived(myUser ? myUser.assigned_prompt : '');
	let sentDrawing = $derived(game.current.drawings.some((d) => d.username === game.myUsername));

	let shapes = $state<Shape[]>([]);

	async function onDone() {
		if (sentDrawing) return;
		if (!(await modal.confirm('Send drawing?'))) return;
		const error = await sendDrawing(prompt, shapes);
		if (error) modal.alert(error);
	}
</script>

<h1 class="has-text-centered">{prompt}</h1>
<Canvas bind:shapes />

<button onclick={onDone} disabled={shapes.length === 0 || sentDrawing}>Done!</button>

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
