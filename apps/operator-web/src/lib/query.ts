import { createQuestpieQueryOptions } from "@questpie/tanstack-query";

import type { AppClient } from "@/lib/client";

/**
 * Typed TanStack Query option builders for this project.
 *
 * `q.collections.*`, `q.globals.*`, and `q.routes.*` return `queryOptions()` /
 * `mutationOptions()` objects you pass straight into `useQuery` / `useMutation`.
 * Full type inference flows from the server schema via `AppConfig`.
 *
 * @example
 * const { data } = useQuery(q.collections.posts.find({ limit: 10 }));
 * const create = useMutation(q.collections.posts.create());
 */
export function createAppQueryOptions(client: AppClient) {
	// GUARD: keys built here (and via q.custom) deliberately omit user identity —
	// the same logical query hashes identically for every user. The no-leak
	// property therefore rests ENTIRELY on the request-scoped QueryClient
	// (lib/query-client.ts): one per request, never shared, never persisted.
	// Never introduce a module-level QueryClient or cross-request cache.
	return createQuestpieQueryOptions(client, {
		keyPrefix: ["autopilot-v2"],
		locale: "sk",
	});
}

export type AppQueryOptions = ReturnType<typeof createAppQueryOptions>;
