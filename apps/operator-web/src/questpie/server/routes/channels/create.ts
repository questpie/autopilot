import { route } from "questpie/services";
import { z } from "zod";
import { commandEnvelopeSchema, requireSession } from "../../domain/organization-route-contract";

export default route()
	.post()
	.access(({ session }) => !!session)
	.schema(
		commandEnvelopeSchema.extend({
			spaceId: z.string(),
			name: z.string().trim().min(2).max(160),
		}),
	)
	.handler(async ({ input, session, services }) =>
		services.organizationDomain.createChannel({
			...input,
			userId: requireSession(session).user.id,
		}),
	);
