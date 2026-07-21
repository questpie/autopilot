import { afterAll, describe, expect, it } from "bun:test";
import { createDisposableDb, type DisposableDb } from "../../harness/real/disposable-db";
import { type AuthenticatedSession, createAuthenticatedSession } from "../../harness/real/identity";
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

/** Bootstrap a Company and create one active Space; the caller becomes its Lead. */
const setupSpace = async (harness: Harness, label: string) => {
	const session = await createAuthenticatedSession({
		baseUrl: harness.server.baseUrl,
		db: harness.db,
		runId: harness.runId,
		email: `f03-chan-${label}-${harness.runId}@harness.invalid`,
	});
	const company = await session.client.routes.companies.bootstrap.post({
		idempotencyKey: `f03-chan-boot-${label}-${harness.runId}`,
		name: `Hreben Channels ${label}`,
	});
	const space = await session.client.routes.spaces.create.post({
		idempotencyKey: `f03-chan-space-${label}-${harness.runId}`,
		companyId: company.companyId,
		name: `Space ${label}`,
	});
	return { session, companyId: company.companyId, spaceId: space.spaceId };
};

/** Await a rejection and hand back the thrown QuestpieClientError-shaped value. */
const expectRejection = async <T>(
	promise: Promise<T>,
): Promise<{ status?: number; code?: string }> => {
	const outcome = await promise.then(
		(value) => ({ ok: true as const, value }),
		(error: unknown) => ({ ok: false as const, error }),
	);
	if (outcome.ok)
		throw new Error(
			`expected the command to reject but it resolved: ${JSON.stringify(outcome.value)}`,
		);
	expect(outcome.error).toBeInstanceOf(Error);
	return outcome.error as { status?: number; code?: string };
};

const readChannel = async (session: AuthenticatedSession, spaceId: string, slug: string) => {
	const found = await session.client.collections.channels.find({ where: { space: spaceId, slug } });
	return found.docs[0];
};

describe("F03 channel commands: create / rename / archive / restore through the real operator-web", () => {
	it(
		"creates a standard Channel, rejects a duplicate slug in the same Space, and allows it in another",
		async () => {
			const harness = await boot();
			const { session, companyId, spaceId } = await setupSpace(harness, "dup");

			// (a) A standard Channel is created: kind standard, systemKey null, version 1, active.
			const created = await session.client.routes.channels.create.post({
				idempotencyKey: `f03-chan-create-a-${harness.runId}`,
				spaceId,
				name: "Announcements",
			});
			expect(created.replayed).toBe(false);
			expect(typeof created.channelId).toBe("string");
			const channel = await readChannel(session, spaceId, "announcements");
			expect(channel?.kind).toBe("standard");
			expect(channel?.systemKey ?? null).toBeNull();
			expect(channel?.status).toBe("active");
			expect(channel?.version).toBe(1);

			// (b) A second Channel with the SAME slug in the SAME Space is a local-slug conflict.
			const duplicate = await expectRejection(
				session.client.routes.channels.create.post({
					idempotencyKey: `f03-chan-create-dup-${harness.runId}`,
					spaceId,
					name: "Announcements",
				}),
			);
			expect(duplicate.status).toBe(409);
			expect(duplicate.code).toBe("CONFLICT");

			// (c) The SAME slug in a DIFFERENT Space succeeds — the invariant is per-Space.
			const other = await session.client.routes.spaces.create.post({
				idempotencyKey: `f03-chan-space-dup2-${harness.runId}`,
				companyId,
				name: "Space Dup Two",
			});
			const reused = await session.client.routes.channels.create.post({
				idempotencyKey: `f03-chan-create-reuse-${harness.runId}`,
				spaceId: other.spaceId,
				name: "Announcements",
			});
			expect(reused.replayed).toBe(false);
			expect(typeof reused.channelId).toBe("string");

			// (g) Archiving frees nothing: channels_space_slug_unique spans every status
			// (no partial WHERE), so an archived Channel still reserves its slug and
			// re-creating it in the same Space stays a 409 — the reason the pre-check
			// queries all statuses.
			await session.client.routes.channels.archive.post({
				idempotencyKey: `f03-chan-arch-slug-${harness.runId}`,
				channelId: created.channelId,
				expectedVersion: 1,
			});
			const afterArchiveDup = await expectRejection(
				session.client.routes.channels.create.post({
					idempotencyKey: `f03-chan-create-archdup-${harness.runId}`,
					spaceId,
					name: "Announcements",
				}),
			);
			expect(afterArchiveDup.status).toBe(409);
			expect(afterArchiveDup.code).toBe("CONFLICT");
		},
		TEST_TIMEOUT,
	);

	it(
		"renames, archives, and restores a standard Channel under optimistic version, and rejects a stale version",
		async () => {
			const harness = await boot();
			const { session, spaceId } = await setupSpace(harness, "life");

			const created = await session.client.routes.channels.create.post({
				idempotencyKey: `f03-chan-life-create-${harness.runId}`,
				spaceId,
				name: "Roadmap",
			});

			// (d) rename bumps the version and re-slugs.
			const renamed = await session.client.routes.channels.rename.post({
				idempotencyKey: `f03-chan-life-rename-${harness.runId}`,
				channelId: created.channelId,
				expectedVersion: 1,
				name: "Product Roadmap",
			});
			expect(renamed.version).toBe(2);
			const afterRename = await readChannel(session, spaceId, "product-roadmap");
			expect(afterRename?.name).toBe("Product Roadmap");
			expect(afterRename?.version).toBe(2);

			// (d) archive sets status/archivedAt and bumps the version.
			const archived = await session.client.routes.channels.archive.post({
				idempotencyKey: `f03-chan-life-archive-${harness.runId}`,
				channelId: created.channelId,
				expectedVersion: 2,
			});
			expect(archived.version).toBe(3);
			const afterArchive = await readChannel(session, spaceId, "product-roadmap");
			expect(afterArchive?.status).toBe("archived");
			expect(afterArchive?.archivedAt).not.toBeNull();

			// (d) restore clears archivedAt and returns to active.
			const restored = await session.client.routes.channels.restore.post({
				idempotencyKey: `f03-chan-life-restore-${harness.runId}`,
				channelId: created.channelId,
				expectedVersion: 3,
			});
			expect(restored.version).toBe(4);
			const afterRestore = await readChannel(session, spaceId, "product-roadmap");
			expect(afterRestore?.status).toBe("active");
			expect(afterRestore?.archivedAt ?? null).toBeNull();

			// (f) a stale expectedVersion is a client-recoverable optimistic conflict —
			// it must surface as a clean 409, never a 500 (the delivery contract the UI
			// relies on to retry with a fresh version).
			const stale = await expectRejection(
				session.client.routes.channels.archive.post({
					idempotencyKey: `f03-chan-life-stale-${harness.runId}`,
					channelId: created.channelId,
					expectedVersion: 1,
				}),
			);
			expect(stale.status).toBe(409);
			expect(stale.code).toBe("CONFLICT");
		},
		TEST_TIMEOUT,
	);

	it(
		"protects the seeded system_default #general Channel from rename and archive",
		async () => {
			const harness = await boot();
			const { session, spaceId } = await setupSpace(harness, "prot");

			const general = await readChannel(session, spaceId, "general");
			expect(general?.kind).toBe("system_default");
			const generalId = general?.id ?? "";
			const generalVersion = general?.version ?? 1;

			// (e) renaming the immutable per-Space anchor is forbidden — even with the right version.
			const renameProtected = await expectRejection(
				session.client.routes.channels.rename.post({
					idempotencyKey: `f03-chan-prot-rename-${harness.runId}`,
					channelId: generalId,
					expectedVersion: generalVersion,
					name: "Renamed General",
				}),
			);
			expect(renameProtected.status).toBe(403);
			expect(renameProtected.code).toBe("FORBIDDEN");

			// (e) archiving it is forbidden too — the #general anchor can never be archived.
			const archiveProtected = await expectRejection(
				session.client.routes.channels.archive.post({
					idempotencyKey: `f03-chan-prot-archive-${harness.runId}`,
					channelId: generalId,
					expectedVersion: generalVersion,
				}),
			);
			expect(archiveProtected.status).toBe(403);
			expect(archiveProtected.code).toBe("FORBIDDEN");

			// The anchor is untouched: still the active system_default #general.
			const stillGeneral = await readChannel(session, spaceId, "general");
			expect(stillGeneral?.status).toBe("active");
			expect(stillGeneral?.version).toBe(generalVersion);
		},
		TEST_TIMEOUT,
	);
});
