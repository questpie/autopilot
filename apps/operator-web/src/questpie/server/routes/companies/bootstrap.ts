import { route } from "questpie/services";
import { z } from "zod";
import { commandEnvelopeSchema, requireSession } from "../../domain/organization-route-contract";

export default route()
	.post()
	.access(({ session }) => !!session)
	.schema(
		commandEnvelopeSchema.extend({
			name: z.string().trim().min(2).max(160),
			locale: z.string().min(2).max(16).optional(),
			timezone: z.string().min(1).max(80).optional(),
		}),
	)
	.handler(async ({ input, session, services }) => {
		const authenticated = requireSession(session);
		return services.organizationDomain.bootstrap({
			...input,
			userId: authenticated.user.id,
			userName: authenticated.user.name,
		});
	});
