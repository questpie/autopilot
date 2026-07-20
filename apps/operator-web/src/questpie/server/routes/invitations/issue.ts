import { route } from "questpie/services";
import { z } from "zod";
import {
	commandEnvelopeSchema,
	invitationBindingSchema,
	requireSession,
} from "../../domain/organization-route-contract";

export default route()
	.post()
	.access(({ session }) => !!session)
	.schema(
		commandEnvelopeSchema.extend({
			companyId: z.string(),
			email: z.string().email(),
			bindings: z.array(invitationBindingSchema).min(1),
			expiresInHours: z.number().int().min(1).max(168).optional(),
		}),
	)
	.handler(async ({ input, session, services }) =>
		services.organizationDomain.issueInvitation({
			...input,
			userId: requireSession(session).user.id,
		}),
	);
