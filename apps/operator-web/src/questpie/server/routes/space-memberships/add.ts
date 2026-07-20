import { route } from "questpie/services";
import { z } from "zod";
import { commandEnvelopeSchema, requireSession } from "../../domain/organization-route-contract";

export default route()
	.post()
	.access(({ session }) => !!session)
	.schema(
		commandEnvelopeSchema.extend({
			spaceId: z.string(),
			actorId: z.string(),
			roleSystemKey: z.enum(["lead", "space-member", "viewer"]),
		}),
	)
	.handler(async ({ input, session, services }) =>
		services.organizationDomain.addSpaceMembership({
			...input,
			userId: requireSession(session).user.id,
		}),
	);
