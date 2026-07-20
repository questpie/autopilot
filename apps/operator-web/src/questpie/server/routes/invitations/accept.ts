import { route } from "questpie/services";
import {
	commandEnvelopeSchema,
	expectedVersionSchema,
	readInvitationChallenge,
	requireSession,
} from "../../domain/organization-route-contract";

export default route()
	.post()
	.access(({ session }) => !!session)
	.schema(commandEnvelopeSchema.extend({ expectedVersion: expectedVersionSchema }))
	.handler(async ({ input, session, services, request }) => {
		const authenticated = requireSession(session);
		return services.organizationDomain.acceptInvitation({
			...input,
			userId: authenticated.user.id,
			userName: authenticated.user.name,
			verifiedEmail: authenticated.user.email,
			emailVerified: authenticated.user.emailVerified,
			challenge: readInvitationChallenge(request),
		});
	});
