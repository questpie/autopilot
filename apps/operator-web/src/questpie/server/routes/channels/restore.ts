import { route } from "questpie/services";
import { z } from "zod";
import {
	commandEnvelopeSchema,
	expectedVersionSchema,
	requireSession,
} from "../../domain/organization-route-contract";

export default route()
	.post()
	.access(({ session }) => !!session)
	.schema(
		commandEnvelopeSchema.extend({ channelId: z.string(), expectedVersion: expectedVersionSchema }),
	)
	.handler(async ({ input, session, services }) =>
		services.organizationDomain.restoreChannel({
			...input,
			userId: requireSession(session).user.id,
		}),
	);
