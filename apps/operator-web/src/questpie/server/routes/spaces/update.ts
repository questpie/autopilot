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
			spaceId: z.string(),
			expectedVersion: expectedVersionSchema,
			name: z.string().trim().min(2).max(160).optional(),
			description: z.string().max(5000).optional(),
		}),
	)
	.handler(async ({ input, session, services }) =>
		services.organizationDomain.updateSpace({ ...input, userId: requireSession(session).user.id }),
	);
