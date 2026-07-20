import { describe, expect, test } from "bun:test";

import { createRequestDataContext } from "@/lib/data/app-data-context";

describe("request-scoped QUESTPIE data context", () => {
	test("forwards only request identity to the same-origin headless API", async () => {
		let observedRequest: Request | undefined;
		const request = new Request("https://operator.example.test/company/hreben", {
			headers: {
				authorization: "Bearer actor-token",
				cookie: "better-auth.session_token=session-a",
				host: "untrusted-proxy.example.test",
				"x-forwarded-for": "203.0.113.9",
			},
		});

		const data = createRequestDataContext(request, {
			fetch: async (input, init) => {
				observedRequest = new Request(input, init);
				return Response.json({ docs: [], totalDocs: 0, limit: 50, page: 1, totalPages: 0 });
			},
		});

		await data.queryClient.fetchQuery(data.queries.companies.visible());

		expect(observedRequest?.url).toStartWith("https://operator.example.test/api/companies?");
		expect(observedRequest?.headers.get("cookie")).toBe("better-auth.session_token=session-a");
		expect(observedRequest?.headers.get("authorization")).toBe("Bearer actor-token");
		expect(observedRequest?.headers.get("host")).toBeNull();
		expect(observedRequest?.headers.get("x-forwarded-for")).toBeNull();
	});

	test("does not share an authenticated cache entry with another request", () => {
		const first = createRequestDataContext(
			new Request("https://operator.example.test/", {
				headers: { cookie: "better-auth.session_token=session-a" },
			}),
		);
		const second = createRequestDataContext(
			new Request("https://operator.example.test/", {
				headers: { cookie: "better-auth.session_token=session-b" },
			}),
		);
		const firstQuery = first.queries.companies.visible();
		const secondQuery = second.queries.companies.visible();

		first.queryClient.setQueryData(firstQuery.queryKey, { docs: [{ id: "company-a" }] });

		expect(secondQuery.queryKey).toEqual(firstQuery.queryKey);
		expect(second.queryClient.getQueryData(secondQuery.queryKey)).toBeUndefined();
	});

	test("bounds Space reads to one active Company scope", async () => {
		let observedUrl: URL | undefined;
		const data = createRequestDataContext(
			new Request("https://operator.example.test/company/hreben"),
			{
				fetch: async (input) => {
					observedUrl = new URL(String(input));
					return Response.json({ docs: [], totalDocs: 0, limit: 100, page: 1, totalPages: 0 });
				},
			},
		);

		await data.queryClient.fetchQuery(data.queries.spaces.visible("company-hreben"));

		expect(observedUrl?.searchParams.get("where[company]")).toBe("company-hreben");
		expect(observedUrl?.searchParams.get("where[status]")).toBe("active");
		expect(observedUrl?.searchParams.get("limit")).toBe("100");
	});
});
