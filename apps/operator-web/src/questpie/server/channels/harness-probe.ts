import { channel } from "questpie/channels";
import { z } from "zod";

/**
 * Harness probe channel: the first real QUESTPIE channel in this app, used by
 * the scenario harness to prove disconnect/replay-gap/refetch behavior over the
 * framework's own SSE transport (no bespoke websocket protocol).
 *
 * Subscribe AND publish are authorized for any authenticated session — and only
 * for authenticated sessions, so nothing anonymous can publish (resolver
 * contract mirrors questpie-cms test/integration/channel-routes.test.ts).
 * Rename to a product channel (e.g. company-activity) is one file +
 * scaffold:generate if F08/F09 formalize one.
 */
export default channel("harness-probe")
	.events({ tick: z.object({ seq: z.number() }) })
	.authorize({
		subscribe: ({ session }) => !!session?.user,
		publish: ({ session }) => !!session?.user,
	});
