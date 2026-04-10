type ModalState =
	| { type: "closed" }
	| { type: "alert"; message: string; resolve: () => void }
	| { type: "confirm"; message: string; resolve: (ok: boolean) => void };

let dialogEl: HTMLDialogElement | null = null;

class ModalStore {
	current = $state.raw<ModalState>({ type: "closed" });

	registerDialog(el: HTMLDialogElement) {
		dialogEl = el;
	}

	alert(message: string): Promise<void> {
		return new Promise((resolve) => {
			this.current = { type: "alert", message, resolve };
			dialogEl?.showModal();
		});
	}

	confirm(message: string): Promise<boolean> {
		return new Promise((resolve) => {
			this.current = { type: "confirm", message, resolve };
			dialogEl?.showModal();
		});
	}

	close(result?: boolean) {
		const c = this.current;
		this.current = { type: "closed" };
		dialogEl?.close();
		if (c.type === "alert") {
			c.resolve();
		} else if (c.type === "confirm") {
			c.resolve(result ?? false);
		}
	}
}

export const modal = new ModalStore();
