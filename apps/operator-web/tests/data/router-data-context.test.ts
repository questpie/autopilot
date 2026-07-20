import { describe, expect, test } from "bun:test";

import { createRequestDataContext } from "@/lib/data/app-data-context";
import { createAppRouter } from "@/router";

describe("TanStack Router data context", () => {
	test("binds one isolated QueryClient to route context and SSR hydration", () => {
		const firstData = createRequestDataContext(
			new Request("https://operator.example.test/", {
				headers: { cookie: "better-auth.session_token=session-a" },
			}),
		);
		const secondData = createRequestDataContext(
			new Request("https://operator.example.test/", {
				headers: { cookie: "better-auth.session_token=session-b" },
			}),
		);

		const firstRouter = createAppRouter(firstData);
		const secondRouter = createAppRouter(secondData);

		expect(firstRouter.options.context.queryClient).toBe(firstData.queryClient);
		expect(secondRouter.options.context.queryClient).toBe(secondData.queryClient);
		expect(firstRouter.options.context.queryClient).not.toBe(
			secondRouter.options.context.queryClient,
		);
		expect(firstRouter.options.Wrap).toBeFunction();
	});

	test("keeps page routes behind shared query factories", async () => {
		const pageRouteFiles = [
			...new Bun.Glob("src/routes/**/*.{ts,tsx}").scanSync({ cwd: process.cwd() }),
		].filter((routeFile) => !routeFile.startsWith("src/routes/api/"));

		// Raw network access has three shapes: direct fetch calls, direct typed
		// client access (collections/routes/globals), and third-party HTTP
		// clients. Page routes read through the request-bound data context only.
		const rawNetworkAccess =
			/\bfetch\s*\(|\bclient\.(?:collections|routes|globals)\b|from\s+["'](?:axios|ky|got|superagent|node-fetch|cross-fetch|undici|@better-fetch\/fetch)["']/;

		for (const routeFile of pageRouteFiles) {
			const source = await Bun.file(routeFile).text();
			expect(source, `${routeFile} must not bypass the request-bound data context`).not.toMatch(
				rawNetworkAccess,
			);
		}
	});
});
