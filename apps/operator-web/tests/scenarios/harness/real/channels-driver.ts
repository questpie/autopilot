import { type AppClient, createAppClient } from "../../../../src/lib/client";
import type { DisposableDb } from "./disposable-db";
import { type AuthenticatedSession, type CookieJar, makeAuthedFetch } from "./identity";

/**
 * The app's first real channel (src/questpie/server/channels/harness-probe.ts).
 * Clients address it by the GENERATED registry key (camelCase config key);
 * the wire/ledger name below is what the `channel` text column stores —
 * .authorize() elevates visibility to "private", so the resolved name carries
 * the "private-" prefix (framework channel-builder visibilityPrefix).
 */
export const HARNESS_CHANNEL = "harnessProbe" as const;
export const HARNESS_CHANNEL_WIRE = "private-harness-probe" as const;

export type TickMessage = { event: "tick"; eventId: string; data: { seq: number } };

const DEFAULT_ESTABLISH_TIMEOUT_MS = 20_000;
const PUBLISH_SETTLE_MS = 500;
const POLL_INTERVAL_MS = 50;

export type GatedSubscriberOptions = {
	jar: CookieJar;
	/** Real server origin — stays the Origin header (trusted APP_URL) even through the gate. */
	serverBaseUrl: string;
	/** The TCP gate's address — the only path the subscriber's bytes take. */
	gateBaseUrl: string;
};

/**
 * Subscriber client whose EVERY request (channel config, realtime SSE stream)
 * rides through the TCP gate, while the Origin header keeps the trusted APP_URL
 * value: cookie-bearing realtime requests without a trusted Origin are denied
 * (channel_origin_denied), and only the `fetch` option reliably reaches the SSE
 * transport's own fetch — static client headers are not guaranteed to.
 */
export const createGatedSubscriber = (options: GatedSubscriberOptions): AppClient =>
	createAppClient({
		baseURL: options.gateBaseUrl,
		fetch: makeAuthedFetch(options.jar, options.serverBaseUrl),
	});

export type ChannelActors = { subscriber: AppClient; publisher: AppClient };

/** Subscriber through the gate; publisher direct and unaffected by gate faults. */
export const createChannelClients = (options: {
	session: AuthenticatedSession;
	serverBaseUrl: string;
	gateBaseUrl: string;
}): ChannelActors => ({
	subscriber: createGatedSubscriber({
		jar: options.session.jar,
		serverBaseUrl: options.serverBaseUrl,
		gateBaseUrl: options.gateBaseUrl,
	}),
	publisher: options.session.client,
});

/** One authed tick publish; resolves to the ledger eventId from the receipt. */
export const publishTick = async (client: AppClient, seq: number): Promise<string> => {
	const receipt = await client.channels[HARNESS_CHANNEL].publish({
		event: "tick",
		data: { seq },
	});
	return receipt.eventId;
};

/** Bounded poll; throws with the label on timeout — never an unbounded wait. */
export const waitFor = async (
	label: string,
	predicate: () => boolean,
	timeoutMs: number,
	intervalMs = POLL_INTERVAL_MS,
): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return;
		await Bun.sleep(intervalMs);
	}
	if (predicate()) return;
	throw new Error(`waitFor(${label}) timed out after ${timeoutMs}ms`);
};

/**
 * A first subscribe holds no replay cursor, so "the subscription is established
 * server-side" is made observable by republishing a warm-up tick (seq 0) until
 * one arrives; the caller's real sequence is deterministic from then on.
 */
export const publishTickUntilReceived = async (options: {
	publisher: AppClient;
	received: () => boolean;
	label: string;
	seq?: number;
	timeoutMs?: number;
}): Promise<void> => {
	const timeoutMs = options.timeoutMs ?? DEFAULT_ESTABLISH_TIMEOUT_MS;
	const seq = options.seq ?? 0;
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		await publishTick(options.publisher, seq);
		const settleUntil = Math.min(Date.now() + PUBLISH_SETTLE_MS, deadline);
		while (Date.now() < settleUntil) {
			if (options.received()) return;
			await Bun.sleep(POLL_INTERVAL_MS);
		}
	}
	if (options.received()) return;
	throw new Error(`publishTickUntilReceived(${options.label}) timed out after ${timeoutMs}ms`);
};

/** Highest ledger seq for the channel (`channel` text column, app migration lines 419-429). */
export const latestLedgerSeq = async (db: DisposableDb, channel: string): Promise<number> => {
	const result = await db.exec(
		"SELECT COALESCE(MAX(seq), 0)::int AS latest FROM questpie_channel_event WHERE channel = $1",
		[channel],
	);
	return Number(result.rows[0]?.latest ?? 0);
};

/**
 * Punches a replay gap by FRONT-pruning the ledger: delete every event with
 * seq <= throughSeq so the oldest RETAINED row sits beyond the held cursor+1.
 * This is the only deletion shape that fires the framework's gap predicate
 * (channel-event-ledger.ts:281-291: gap iff resumeSeq > latestSeq OR
 * resumeSeq < oldestSeq - 1, where latestSeq comes from the head table and
 * mid-stream holes are silently skipped), and it mirrors what the retention
 * sweep itself does (framework precedent: ordered-channel-ledger.test.ts).
 * Returns the number of pruned rows.
 */
export const punchLedgerGap = async (
	db: DisposableDb,
	channel: string,
	throughSeq: number,
): Promise<number> => {
	const result = await db.exec(
		"DELETE FROM questpie_channel_event WHERE channel = $1 AND seq <= $2 RETURNING seq",
		[channel, throughSeq],
	);
	return result.rows.length;
};
