import { route } from "questpie/services";
import { z } from "zod";
import {
	commandEnvelopeSchema,
	expectedVersionSchema,
	invitationBindingSchema,
	requireSession,
} from "../../domain/organization-route-contract";

export default route()
	.post()
	.access(({ session }) => !!session)
	.schema(
		commandEnvelopeSchema.extend({
			actorId: z.string(),
			expectedVersion: expectedVersionSchema,
			bindings: z.array(invitationBindingSchema).min(1),
		}),
	)
	.handler(async ({ input, session, services }) =>
		services.organizationDomain.replaceRoleBindings({
			...input,
			userId: requireSession(session).user.id,
		}),
	);
