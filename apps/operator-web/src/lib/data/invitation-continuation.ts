import type { EnsureQueryDataOptions } from "@tanstack/react-query";

import type { AppClient } from "@/lib/client";
import type { AppQueryOptions } from "@/lib/query";

/**
 * Masked continuation state mirrored from the public challenge seam. The app
 * never receives the raw token or address — only these presentational shapes.
 */
export type InvitationChallengeState =
	| {
			status: "eligible";
			companyName: string;
			maskedEmail: string;
			roleLabel: string;
			expectedVersion: number;
	  }
	| { status: "expired" | "revoked" | "already-used"; companyName: string; maskedEmail: string }
	| { status: "invalid" };

/**
 * Invitation-continuation query factory: reads the masked challenge state via
 * the public route (the request-scoped client forwards the challenge cookie on
 * the server). Cast bridges the workspace's duplicated @tanstack/react-query
 * identity (see lib/data/session.ts); the builder's queryFn ignores its context.
 */
export function createInvitationChallengeQuery(q: AppQueryOptions, client: AppClient) {
	return (): EnsureQueryDataOptions<InvitationChallengeState> =>
		q.custom.query({
			key: ["invitation", "challenge"],
			queryFn: async (): Promise<InvitationChallengeState> => {
				try {
					return (await client.routes.invitations.challenge.post({})) as InvitationChallengeState;
				} catch {
					// A missing/invalid cookie or transport failure reads as "couldn't
					// load the invitation" — never a thrown loader error.
					return { status: "invalid" };
				}
			},
		}) as unknown as EnsureQueryDataOptions<InvitationChallengeState>;
}

export type InvitationChallengeQuery = ReturnType<typeof createInvitationChallengeQuery>;

export type InvitationExchange = (token: string) => Promise<{ ok: boolean }>;

/**
 * Exchange transport for the public invite entry: posts the raw token and lets
 * the browser apply the continuation Set-Cookie from the 303 (redirect:'manual'
 * keeps the client from following it). Lives in the data layer so route files
 * never call fetch directly.
 */
export function createInvitationExchange(
	baseURL: string,
	fetchImpl?: typeof fetch,
): InvitationExchange {
	const doFetch = fetchImpl ?? fetch;
	return async (token) => {
		const response = await doFetch(`${baseURL}/api/invitations/exchange`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token }),
			redirect: "manual",
			credentials: "same-origin",
		});
		return {
			ok: response.type === "opaqueredirect" || (response.status >= 200 && response.status < 400),
		};
	};
}
