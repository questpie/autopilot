import { afterAll, describe, expect, it } from "bun:test";
import { createDisposableDb, type DisposableDb } from "../../harness/real/disposable-db";
import { createAuthenticatedSession } from "../../harness/real/identity";
import { createRunContext } from "../../harness/real/run-context";
import { type StartedServer, startServer } from "../../harness/real/server-process";

const TEST_TIMEOUT = 240_000;

type Harness = {
	runId: string;
	db: DisposableDb;
	server: StartedServer;
};

let bootPromise: Promise<Harness> | null = null;

/** One boot shared by the it-blocks below; the first caller pays inside its own timeout. */
const boot = (): Promise<Harness> => {
	bootPromise ??= (async () => {
		const ctx = createRunContext();
		const db = await createDisposableDb(ctx.runId);
		const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
		return { runId: ctx.runId, db, server };
	})();
	return bootPromise;
};

afterAll(async () => {
	if (!bootPromise) return;
	const harness = await bootPromise.catch(() => null);
	if (!harness) return;
	await harness.server.stop();
	await harness.db.drop();
});

describe("F03 flow: the Space/Project/Channel vertical through the real operator-web", () => {
	it(
		"bootstrap seeds the protected general channel in Whole Company",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `f03-general-${harness.runId}@harness.invalid`,
			});
			const receipt = await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `f03-general-${harness.runId}`,
				name: "Hreben Channels",
			});
			const wholeCompany = (
				await session.client.collections.spaces.find({
					where: { company: receipt.companyId, systemKey: "whole-company" },
				})
			).docs[0];
			if (!wholeCompany) throw new Error("whole-company space missing after bootstrap");
			// The protected default Channel is seeded atomically by the bootstrap command;
			// its persistence is proven only through the typed collections.channels seam.
			const channels = await session.client.collections.channels.find({
				where: { space: wholeCompany.id, systemKey: "general" },
			});
			expect(channels.docs).toHaveLength(1);
			expect(channels.docs[0]?.kind).toBe("system_default");
			expect(channels.docs[0]?.slug).toBe("general");
		},
		TEST_TIMEOUT,
	);

	it(
		"a created Space seeds its own system_default general with a distinct Space anchor",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `f03-anchor-${harness.runId}@harness.invalid`,
			});
			const receipt = await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `f03-anchor-${harness.runId}`,
				name: "Hreben Anchor",
			});
			const wholeCompany = (
				await session.client.collections.spaces.find({
					where: { company: receipt.companyId, systemKey: "whole-company" },
				})
			).docs[0];
			if (!wholeCompany) throw new Error("whole-company space missing after bootstrap");
			// A newly created Space carries its own immutable #general anchor — a distinct
			// row keyed to the new Space, never an alias of the Whole Company channel.
			const created = await session.client.routes.spaces.create.post({
				idempotencyKey: `f03-anchor-marketing-${harness.runId}`,
				companyId: receipt.companyId,
				name: "Marketing",
			});
			expect(created.replayed).toBe(false);
			const marketing = await session.client.collections.channels.find({
				where: { space: created.spaceId, systemKey: "general" },
			});
			expect(marketing.docs).toHaveLength(1);
			expect(marketing.docs[0]?.kind).toBe("system_default");
			expect(marketing.docs[0]?.slug).toBe("general");
			// Exactly two system_default/general leaves across the two Spaces, each keyed
			// to a DIFFERENT Space FK — no shared or aliased row bridges the anchors.
			const generals = await session.client.collections.channels.find({
				where: { systemKey: "general", kind: "system_default" },
			});
			expect(generals.docs).toHaveLength(2);
			const spaceAnchors = new Set(generals.docs.map((doc) => doc.space));
			expect(spaceAnchors.size).toBe(2);
			expect(spaceAnchors.has(wholeCompany.id)).toBe(true);
			expect(spaceAnchors.has(created.spaceId)).toBe(true);
		},
		TEST_TIMEOUT,
	);
});
