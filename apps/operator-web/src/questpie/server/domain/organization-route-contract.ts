import { ApiError } from "questpie/errors";
import { z } from "zod";

export const invitationChallengeCookie = "qp_invitation_challenge";

export const commandEnvelopeSchema = z.object({
	idempotencyKey: z.string().min(8).max(255),
	correlationId: z.string().min(1).max(160).optional(),
});

export const expectedVersionSchema = z.number().int().min(1);

export const invitationBindingSchema = z.object({
	roleSystemKey: z.string().min(1).max(80),
	scopeType: z.enum(["company", "space"]),
	spaceId: z.string().nullable().optional(),
});

export function requireSession<T extends { user: { id: string } }>(session: T | null): T {
	if (!session) throw ApiError.unauthorized();
	return session;
}

export function readInvitationChallenge(request: Request | undefined): string {
	if (!request) throw ApiError.badRequest("Invitation continuation request is missing");
	const cookie = request.headers.get("cookie") ?? "";
	const challenge = cookie
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${invitationChallengeCookie}=`))
		?.slice(invitationChallengeCookie.length + 1);
	if (!challenge) throw ApiError.badRequest("Invitation continuation is missing");
	return decodeURIComponent(challenge);
}
