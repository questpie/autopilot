import { createClient } from "questpie/client";

import type { AppConfig } from "#questpie";

export type CreateAppClientOptions = {
	baseURL: string;
	fetch?: typeof fetch;
	headers?: Record<string, string>;
};

export function createAppClient({ baseURL, fetch, headers }: CreateAppClientOptions) {
	return createClient<AppConfig>({
		baseURL,
		basePath: "/api",
		fetch,
		headers,
	});
}

export type AppClient = ReturnType<typeof createAppClient>;
