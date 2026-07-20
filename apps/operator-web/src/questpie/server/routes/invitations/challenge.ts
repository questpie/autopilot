import { route } from "questpie/services";
import { z } from "zod";
import { invitationChallengeCookie } from "../../domain/organization-route-contract";

/**
 * Public continuation seam (SPEC 10.0): resolves the qp_invitation_challenge
 * cookie into masked, presentational state. It never echoes the raw token or
 * the raw invited address, and answers a uniform "invalid" for any missing or
 * unresolvable challenge — no enumeration.
 */
export default route()
	.post()
	.access(true)
	.schema(z.object({}))
	.handler(async ({ request, services }) => {
		if (!request) return { status: "invalid" as const };
		const raw = (request.headers.get("cookie") ?? "")
			.split(";")
			.map((part) => part.trim())
			.find((part) => part.startsWith(`${invitationChallengeCookie}=`))
			?.slice(invitationChallengeCookie.length + 1);
		if (!raw) return { status: "invalid" as const };
		return services.organizationDomain.describeInvitationChallenge(decodeURIComponent(raw));
	});
