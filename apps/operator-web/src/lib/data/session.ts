import type { EnsureQueryDataOptions } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { createQueryKeys } from "@/lib/data/query-keys";
import type { AppQueryOptions } from "@/lib/query";

/** Transport facts the session query needs; mirrors the data-context options. */
export type SessionTransport = {
	baseURL: string;
	headers?: Record<string, string>;
	fetch?: typeof fetch;
};

export type SessionSnapshot = typeof authClient.$Infer.Session | null;

/**
 * Session query factory — the app's first `authClient` consumer.
 *
 * Server-side the request's identity headers (cookie) are forwarded to
 * `/api/auth/get-session` on the request's own origin; browser-side the
 * session cookie travels with the request automatically. Built through
 * `q.custom.query` so the key carries the shared prefix and no handwritten
 * queryKey exists. The key omits user identity on purpose — isolation rests
 * entirely on the request-scoped QueryClient (see lib/query.ts).
 */
export function createSessionQuery(q: AppQueryOptions, transport: SessionTransport) {
	// Identity bridge, not a behavior change: the workspace currently resolves
	// two structurally identical @tanstack/react-query copies (the app's and the
	// one nested under @questpie/tanstack-query), so the builder's options carry
	// a foreign Query class identity that tsc rejects nominally. The runtime
	// value is a plain queryOptions object; re-typing it against the app's copy
	// keeps ensureQueryData/useQuery callers typed end to end.
	const keys = createQueryKeys(q);
	return (): EnsureQueryDataOptions<SessionSnapshot> =>
		q.custom.query({
			key: keys.session(),
			queryFn: async (): Promise<SessionSnapshot> => {
				const { data, error } = await authClient.getSession({
					fetchOptions: {
						baseURL: `${transport.baseURL}/api/auth`,
						headers: transport.headers,
						...(transport.fetch ? { customFetchImpl: transport.fetch } : {}),
					},
				});
				if (error) {
					throw new Error(`get-session answered ${error.status}: ${error.message ?? ""}`);
				}
				return data ?? null;
			},
		}) as unknown as EnsureQueryDataOptions<SessionSnapshot>;
}

export type SessionQuery = ReturnType<typeof createSessionQuery>;
