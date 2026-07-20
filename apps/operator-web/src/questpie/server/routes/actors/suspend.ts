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
		commandEnvelopeSchema.extend({
			actorId: z.string(),
			expectedVersion: expectedVersionSchema,
			reason: z.string().min(1).max(2000).optional(),
		}),
	)
	.handler(async ({ input, session, services }) =>
		services.organizationDomain.suspendActor({ ...input, userId: requireSession(session).user.id }),
	);
