<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { modal } from '$lib/modal.svelte';

	let dialogRef: HTMLDialogElement;

	onMount(() => {
		modal.registerDialog(dialogRef);
	});
</script>

<dialog
	class="modal"
	bind:this={dialogRef}
	oncancel={(e) => {
		e.preventDefault();
		modal.close();
	}}
	onclick={(e) => {
		if (e.target === dialogRef) modal.close();
	}}
>
	{#if modal.current.type !== 'closed'}
		<div
			class="modal-body"
			in:fly={{ y: -window.innerHeight / 2, duration: 300 }}
		>
			<button class="btn-close" onclick={() => modal.close()} aria-label="Close">X</button>
			<p class="modal-text">{modal.current.message}</p>
			{#if modal.current.type === 'alert'}
				<button class="paper-btn" onclick={() => modal.close()}>OK</button>
			{:else}
				<div class="modal-buttons">
					<button class="paper-btn" onclick={() => modal.close(true)}>Yes</button>
					<button class="paper-btn" onclick={() => modal.close(false)}>No</button>
				</div>
			{/if}
		</div>
	{/if}
</dialog>

<style>
	dialog {
		border: none;
		padding: 0;
		background: transparent;
		max-width: 480px;
		width: 90%;
		/* Override PaperCSS .modal fixed positioning */
		position: relative;
		visibility: visible;
		opacity: 1;
		overflow: visible;
	}
	dialog::backdrop {
		background: transparent;
	}
	dialog :global(.modal-body) {
		box-shadow:
			20px 35px 70px -10px rgb(0 0 0 / 0.55),
			0 0 0 100vmax rgb(0 0 0 / 0.3);
		position: relative;
		/* Override PaperCSS absolute centering — dialog handles it */
		transform: none;
		left: auto;
		top: auto;
		text-align: center;
		border-bottom-left-radius: 15px 255px;
		border-bottom-right-radius: 225px 15px;
		border-top-left-radius: 255px 15px;
		border-top-right-radius: 15px 225px;
	}
	.modal-buttons {
		display: flex;
		gap: 1em;
		justify-content: center;
	}
	.modal-text {
		font-size: 1.1em;
		margin-bottom: 1.5em;
	}
	button.paper-btn {
		min-width: 5em;
	}
	dialog :global(button.btn-close) {
		all: unset;
		cursor: pointer;
		position: absolute;
		right: 1.5rem;
		top: 1rem;
		font-size: 30px;
		line-height: 1;
	}
</style>
