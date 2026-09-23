// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

import Raven from "raven";

/*============================================================================*/

/** Turns the `cause` chain of an error (e.g. Node's `TypeError: fetch failed`) into a readable trail. */
function causeTrail(error: Error): string | undefined {
	const causes: string[] = [];

	let cause: unknown = (error as { cause?: unknown }).cause;
	while (cause !== undefined) {
		causes.push(String(cause));
		cause = cause instanceof Error ? (cause as { cause?: unknown }).cause : undefined;
	}

	return causes.length > 0 ? causes.join(" -> caused by -> ") : undefined;
}

/**
 * Reports an exception to Sentry, attaching whatever context is available so a bare
 * message like "TypeError: fetch failed" is still actionable in the Sentry report.
 * @param error The error (or thrown value) to report.
 * @param extra Extra context describing what the app was doing, e.g. `{ route: "/create", teamID: hook.team.id }`.
 */
export function captureException(error: unknown, extra?: Record<string, unknown>): void {
	const err = error instanceof Error ? error : new Error(String(error));
	const cause = causeTrail(err);

	Raven.captureException(err, {
		extra: {
			...(cause !== undefined ? { cause } : {}),
			...extra,
		},
	});
}
