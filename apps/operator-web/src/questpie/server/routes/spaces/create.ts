import { route } from "questpie/services";
import { z } from "zod";
import { commandEnvelopeSchema, requireSession } from "../../domain/organization-route-contract";

export default route()
	.post()
	.access(({ session }) => !!session)
	.schema(
		commandEnvelopeSchema.extend({
			companyId: z.string(),
			name: z.string().trim().min(2).max(160),
			description: z.string().max(5000).optional(),
		}),
	)
	.handler(async ({ input, session, services }) =>
		services.organizationDomain.createSpace({ ...input, userId: requireSession(session).user.id }),
	);
