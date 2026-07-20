import { describe, expect, test } from "bun:test";

import {
	BOOTSTRAP_RECOVERABLE_MESSAGE,
	createCompaniesCommands,
	createIdempotencyKeyRegistry,
	previewCompanySlug,
} from "@/lib/data/commands/companies";

describe("company bootstrap draft logic", () => {
	test("previews the server slug format without the uniqueness suffix", () => {
		expect(previewCompanySlug("Hrebeň")).toBe("hreben");
		expect(previewCompanySlug("  Marketing & Sales  ")).toBe("marketing-sales");
		expect(previewCompanySlug("Čerešňová Ulička 7")).toBe("ceresnova-ulicka-7");
		// Slug-incompatible input yields "" instead of throwing — the form
		// keeps its placeholder while the server stays the format authority.
		expect(previewCompanySlug("———")).toBe("");
		expect(previewCompanySlug("x".repeat(200))).toHaveLength(120);
	});

	test("mints one key per draft and returns it for every retry", () => {
		let sequence = 0;
		const registry = createIdempotencyKeyRegistry(() => `key-${++sequence}`);
		const first = registry.keyFor({ name: "Hrebeň" });
		expect(registry.keyFor({ name: "Hrebeň" })).toBe(first);
		expect(registry.keyFor({ name: "  Hrebeň  " })).toBe(first);
		const edited = registry.keyFor({ name: "Hrebeň s.r.o." });
		expect(edited).not.toBe(first);
		// Returning to an earlier draft returns its ORIGINAL key — if that
		// submission had already committed server-side, the receipt replays.
		expect(registry.keyFor({ name: "Hrebeň" })).toBe(first);
	});

	test("default minting satisfies the command envelope bounds", () => {
		const registry = createIdempotencyKeyRegistry();
		const key = registry.keyFor({ name: "Hrebeň" });
		expect(key.length).toBeGreaterThanOrEqual(8);
		expect(key.length).toBeLessThanOrEqual(255);
	});

	test("bootstrap submits the trimmed draft under a draft-stable key", async () => {
		const submissions: { idempotencyKey: string; name: string }[] = [];
		let failFirst = true;
		const commands = createCompaniesCommands({
			bootstrap: async (submission) => {
				submissions.push(submission);
				if (failFirst) {
					failFirst = false;
					throw new Error("transport down");
				}
				return { companyId: "company-1", replayed: false };
			},
		});

		const failed = await commands.bootstrap({ name: "  Hrebeň  " });
		expect(failed).toEqual({ status: "recoverable", message: BOOTSTRAP_RECOVERABLE_MESSAGE });

		const retried = await commands.bootstrap({ name: "Hrebeň" });
		expect(retried.status).toBe("created");
		if (retried.status === "created") {
			expect(retried.receipt).toEqual({ companyId: "company-1", replayed: false });
		}

		expect(submissions).toHaveLength(2);
		expect(submissions[0]?.name).toBe("Hrebeň");
		expect(submissions[1]?.name).toBe("Hrebeň");
		// The retry after the recoverable failure reuses the SAME key.
		expect(submissions[1]?.idempotencyKey).toBe(submissions[0]?.idempotencyKey ?? "");
	});
});
