import type { HandleServerError } from "@sveltejs/kit";

const FRIENDLY_MESSAGE = "Something went wrong on the server. Please try again.";

export const handleError: HandleServerError = ({ error, event }) => {
	const errorId = crypto.randomUUID();
	const stack = error instanceof Error ? error.stack : undefined;
	console.error(
		`[${errorId}] ${event.request.method} ${event.url.pathname}${event.url.search} →`,
		error,
		stack ?? "",
	);
	// `message` is required by App.Error; `error` mirrors it so clients can read
	// the same field name across all error responses (4xx/410/5xx).
	return {
		message: FRIENDLY_MESSAGE,
		error: FRIENDLY_MESSAGE,
		errorId,
	};
};
