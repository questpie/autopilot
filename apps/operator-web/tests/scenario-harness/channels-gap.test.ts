import { afterAll, describe, expect, it } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { AppClient } from "../../src/lib/client";
import { createAppQueryOptions } from "../../src/lib/query";
import {
	createChannelClients,
	createGatedSubscriber,
	HARNESS_CHANNEL,
	HARNESS_CHANNEL_WIRE,
	latestLedgerSeq,
	publishTick,
	publishTickUntilReceived,
	punchLedgerGap,
	type TickMessage,
	waitFor,
} from "../scenarios/harness/real/channels-driver";
import { createDisposableDb, type DisposableDb } from "../scenarios/harness/real/disposable-db";
import {
	type AuthenticatedSession,
	createAuthenticatedSession,
} from "../scenarios/harness/real/identity";
import { createRunContext } from "../scenarios/harness/real/run-context";
import { type StartedServer, startServer } from "../scenarios/harness/real/server-process";
import { startTcpGate, type TcpGate } from "../scenarios/harness/real/tcp-gate";

const TEST_TIMEOUT = 240_000;
/** Phase A bound: replay after reopen must land inside this window. */
const REPLAY_WINDOW_MS = 15_000;
/** Gap detection rides the transport's jittered backoff — allow a wider bound. */
const GAP_WINDOW_MS = 30_000;

type Harness = {
	runId: string;
	db: DisposableDb;
	server: StartedServer;
	session: AuthenticatedSession;
	gate: TcpGate;
	/** Sees the server ONLY through the gate; Origin stays the trusted APP_URL. */
	subscriber: AppClient;
	/** Publishes directly against the real server, unaffected by gate faults. */
	publisher: AppClient;
};

let bootPromise: Promise<Harness> | null = null;

/** One boot shared by the ordered phases below; the first caller pays inside its own timeout. */
const boot = (): Promise<Harness> => {
	bootPromise ??= (async () => {
		const ctx = createRunContext();
		const db = await createDisposableDb(ctx.runId);
		const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
		const session = await createAuthenticatedSession({
			baseUrl: server.baseUrl,
			db,
			runId: ctx.runId,
		});
		const gate = startTcpGate(server.port);
		const { subscriber, publisher } = createChannelClients({
			session,
			serverBaseUrl: server.baseUrl,
			gateBaseUrl: gate.baseUrl,
		});
		return { runId: ctx.runId, db, server, session, gate, subscriber, publisher };
	})();
	return bootPromise;
};

afterAll(async () => {
	if (!bootPromise) return;
	const harness = await bootPromise.catch(() => null);
	if (!harness) return;
	live.stop?.();
	harness.subscriber.channels.destroy();
	harness.publisher.channels.destroy();
	harness.gate.stop();
	await harness.server.stop();
	await harness.db.drop();
});

/** Live subscription state carried from phase A into phase B (cursor continuity). */
const live: { messages: TickMessage[]; errors: Error[]; stop?: () => void } = {
	messages: [],
	errors: [],
};

const seqsOf = (messages: readonly TickMessage[]): number[] =>
	messages.map((message) => message.data.seq);

describe("scenario-harness channels disconnect/replay-gap/refetch", () => {
	it(
		"phase A: the transport auto-reconnects through the reopened gate and replays the missed events from its internal cursor",
		async () => {
			const { gate, subscriber, publisher } = await boot();
			live.stop = subscriber.channels[HARNESS_CHANNEL].subscribe(
				(message) => live.messages.push(message),
				{ onError: (error) => live.errors.push(error) },
			);
			// A first subscribe holds no replay cursor: republished seq-0 warm-ups make
			// "subscription established server-side" observable before the real sequence.
			await publishTickUntilReceived({
				publisher,
				received: () => live.messages.length > 0,
				label: "phase A warm-up",
			});
			await publishTick(publisher, 1);
			await waitFor(
				"tick 1 reaches the gated subscriber",
				() => seqsOf(live.messages).includes(1),
				REPLAY_WINDOW_MS,
			);
			// The transport now holds an internal lastEventId stored from received frames.
			gate.close();
			await publishTick(publisher, 2);
			await publishTick(publisher, 3);
			gate.open();
			await waitFor(
				"missed ticks 2 and 3 replayed after reopen",
				() => seqsOf(live.messages).includes(2) && seqsOf(live.messages).includes(3),
				REPLAY_WINDOW_MS,
			);
			expect(seqsOf(live.messages).filter((seq) => seq >= 1)).toEqual([1, 2, 3]);
			expect(live.messages.every((message) => message.event === "tick")).toBe(true);
			// Reconnect failures during the outage are silent while an entry holds a cursor.
			expect(live.errors).toHaveLength(0);
		},
		TEST_TIMEOUT,
	);

	it(
		"phase B: front-pruning the ledger past the held cursor surfaces the exact replay-gap error",
		async () => {
			const { db, gate, publisher } = await boot();
			// Phase ordering: A minted the live subscription this phase continues.
			expect(live.stop).toBeDefined();
			await publishTick(publisher, 4);
			await waitFor(
				"tick 4 arrives (cursor advances)",
				() => seqsOf(live.messages).includes(4),
				REPLAY_WINDOW_MS,
			);
			gate.close();
			await publishTick(publisher, 5);
			await publishTick(publisher, 6);
			// FRONT-prune: delete everything up to latest-1 so the oldest retained row
			// sits beyond cursor+1 — the only deletion shape that fires the gap predicate.
			const latest = await latestLedgerSeq(db, HARNESS_CHANNEL_WIRE);
			const pruned = await punchLedgerGap(db, HARNESS_CHANNEL_WIRE, latest - 1);
			gate.open();
			expect(pruned).toBeGreaterThanOrEqual(2);
			await waitFor(
				"replay-gap error reaches onError",
				() => live.errors.length > 0,
				GAP_WINDOW_MS,
			);
			expect([...new Set(live.errors.map((error) => error.message))]).toEqual([
				"Channel event replay gap",
			]);
			// The pruned-away events are lost as a GAP, never silently skipped into delivery.
			expect(seqsOf(live.messages)).not.toContain(5);
			expect(seqsOf(live.messages)).not.toContain(6);
			live.stop?.();
			live.stop = undefined;
		},
		TEST_TIMEOUT,
	);

	it(
		"phase C: the channels subscription query errors on the gap and an explicit refetch restarts a fresh stream into reset data",
		async () => {
			const { db, server, session, gate, publisher } = await boot();
			// Defensive: a failed earlier phase must not leak a closed gate into this one.
			gate.open();
			const clientC = createGatedSubscriber({
				jar: session.jar,
				serverBaseUrl: server.baseUrl,
				gateBaseUrl: gate.baseUrl,
			});
			// The channels subscription queryOptions pins refetchMode 'reset' but carries
			// NO retry key, so the harness QueryClient must pin retry:false itself.
			const queryClient = new QueryClient({
				defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
			});
			const q = createAppQueryOptions(clientC);
			const observer = new QueryObserver(queryClient, q.channels[HARNESS_CHANNEL].subscription());
			const unsubscribe = observer.subscribe(() => {});
			const current = () => observer.getCurrentResult();
			const dataSeqs = (): number[] =>
				((current().data as readonly TickMessage[] | undefined) ?? []).map(
					(message) => message.data.seq,
				);
			try {
				await publishTickUntilReceived({
					publisher,
					received: () => dataSeqs().length > 0,
					label: "phase C warm-up",
				});
				await publishTick(publisher, 201);
				await waitFor(
					"tick 201 lands in query data",
					() => dataSeqs().includes(201),
					REPLAY_WINDOW_MS,
				);
				gate.close();
				await publishTick(publisher, 202);
				await publishTick(publisher, 203);
				const latest = await latestLedgerSeq(db, HARNESS_CHANNEL_WIRE);
				await punchLedgerGap(db, HARNESS_CHANNEL_WIRE, latest - 1);
				gate.open();
				await waitFor(
					"query errors with the replay gap",
					() => current().status === "error",
					GAP_WINDOW_MS,
				);
				expect(current().error?.message).toBe("Channel event replay gap");
				// Driven refetch: streamedQuery restarts with a FRESH subscribe — the
				// errored iterator already removed its entry, wiping the stale cursor.
				void observer.refetch();
				await publishTickUntilReceived({
					publisher,
					received: () => current().status === "success" && dataSeqs().length > 0,
					label: "phase C post-refetch warm-up",
				});
				await publishTick(publisher, 204);
				await waitFor(
					"fresh tick 204 arrives in the reset data",
					() => dataSeqs().includes(204),
					REPLAY_WINDOW_MS,
				);
				expect(current().status).toBe("success");
				expect(current().error).toBeNull();
				expect(dataSeqs()).toContain(204);
				// Reset semantics: pre-gap data is wiped and gapped events are not replayed.
				expect(dataSeqs()).not.toContain(201);
				expect(dataSeqs()).not.toContain(202);
				expect(dataSeqs()).not.toContain(203);
			} finally {
				unsubscribe();
				queryClient.clear();
				clientC.channels.destroy();
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"phase D (negative): clean abort then resubscribe is a fresh stream with NO replay — abort is not a disconnect fault lever",
		async () => {
			const { gate, subscriber, publisher } = await boot();
			// Defensive: a failed earlier phase must not leak a closed gate into this one.
			gate.open();
			const controller = new AbortController();
			const firstMessages: TickMessage[] = [];
			const firstErrors: Error[] = [];
			// Public ChannelSubscribeOptions is {signal?, onError?} only — signal is the
			// clean-unsubscribe path, and unsubscribing destroys the entry AND its cursor.
			subscriber.channels[HARNESS_CHANNEL].subscribe((message) => firstMessages.push(message), {
				signal: controller.signal,
				onError: (error) => firstErrors.push(error),
			});
			await publishTickUntilReceived({
				publisher,
				received: () => firstMessages.length > 0,
				label: "phase D first warm-up",
			});
			await publishTick(publisher, 301);
			await waitFor(
				"tick 301 arrives before the abort",
				() => seqsOf(firstMessages).includes(301),
				REPLAY_WINDOW_MS,
			);
			controller.abort();
			await publishTick(publisher, 302);
			await publishTick(publisher, 303);
			const secondMessages: TickMessage[] = [];
			const secondErrors: Error[] = [];
			const stopSecond = subscriber.channels[HARNESS_CHANNEL].subscribe(
				(message) => secondMessages.push(message),
				{ onError: (error) => secondErrors.push(error) },
			);
			try {
				await publishTickUntilReceived({
					publisher,
					received: () => secondMessages.length > 0,
					label: "phase D second warm-up",
				});
				await publishTick(publisher, 304);
				await waitFor(
					"tick 304 arrives on the fresh stream",
					() => seqsOf(secondMessages).includes(304),
					REPLAY_WINDOW_MS,
				);
				// NO replay of anything published while cleanly unsubscribed...
				expect(seqsOf(secondMessages)).not.toContain(301);
				expect(seqsOf(secondMessages)).not.toContain(302);
				expect(seqsOf(secondMessages)).not.toContain(303);
				// ...and no gap error either: this is a fresh stream, not a fault.
				expect(secondErrors).toHaveLength(0);
				expect(firstErrors).toHaveLength(0);
			} finally {
				stopSecond();
			}
		},
		TEST_TIMEOUT,
	);
});
