import { route } from "questpie/services";
import { z } from "zod";
import { invitationChallengeCookie } from "../../domain/organization-route-contract";

const inputSchema = z.object({ token: z.string().min(32).max(512) });

export default route()
	.post()
	.raw()
	.access(true)
	.handler(async ({ request, services }) => {
		const input = inputSchema.parse(await request.json());
		const { challenge } = await services.organizationDomain.exchangeInvitationToken(input.token);
		return new Response(null, {
			status: 303,
			headers: {
				location: "/sign-in?continue=invitation",
				"set-cookie": `${invitationChallengeCookie}=${encodeURIComponent(challenge)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=900`,
			},
		});
	});
