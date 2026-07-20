/**
 * Invitation commands for the team step (SPEC 10.3). Pure by construction —
 * the transport is injected, so tests never network. No email delivery exists
 * in this phase: the issuer-visible /invite/<token> link is the only honest
 * delivery channel, and it can be shown ONLY while the delivery token is in
 * hand (the server persists just its hash).
 */

export type InvitationDraft = { email: string };

export type InvitationBindingInput = {
	roleSystemKey: string;
	scopeType: "company" | "space";
	spaceId?: string | null;
};

export type InvitationIssueSubmission = {
	idempotencyKey: string;
	companyId: string;
	email: string;
	bindings: InvitationBindingInput[];
};

export type InvitationMutateSubmission = {
	idempotencyKey: string;
	invitationId: string;
	expectedVersion: number;
};

/** F01 default: an invited human joins as a company-scoped member. */
export const COMPANY_MEMBER_BINDINGS: readonly InvitationBindingInput[] = [
	{ roleSystemKey: "member", scopeType: "company" },
];

/** SPEC 10.3 recoverable-error contract: retry offered, the address kept intact. */
export const INVITATION_ISSUE_RECOVERABLE_MESSAGE =
	"Pozvánku sa nepodarilo vytvoriť. Skúste to znova — zadaná adresa zostala zachovaná.";
export const INVITATION_MUTATION_RECOVERABLE_MESSAGE =
	"Akciu s pozvánkou sa nepodarilo dokončiť. Skúste to znova.";
export const INVITATION_ACCEPT_RECOVERABLE_MESSAGE =
	"Pozvánku sa nepodarilo prijať. Skúste to znova.";

/** Structural check for the typed client's forbidden error (403 — email mismatch). */
const isForbidden = (error: unknown): boolean =>
	error instanceof Error && "status" in error && (error as { status?: number }).status === 403;

/** The issuer-visible delivery link for a one-time token. */
export const inviteHrefFor = (deliveryToken: string): string => `/invite/${deliveryToken}`;

export const normalizeInviteEmail = (raw: string): string => raw.trim().toLocaleLowerCase("en-US");

/** Per-address validation before submit — one address, plausible shape. */
export const isValidInviteEmail = (raw: string): boolean =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());

export type MintKey = () => string;

const defaultMintKey: MintKey = () => `invitations-${crypto.randomUUID()}`;

/**
 * Draft-stable idempotency keys, fingerprinted by caller-supplied strings:
 * retrying an unchanged command after a recoverable failure replays the
 * server receipt instead of duplicating the write.
 */
const createKeyRegistry = (mintKey: MintKey) => {
	const keys = new Map<string, string>();
	return (fingerprint: string): string => {
		const existing = keys.get(fingerprint);
		if (existing) return existing;
		const minted = mintKey();
		keys.set(fingerprint, minted);
		return minted;
	};
};

type InvitationsTransport = {
	issue: (
		submission: InvitationIssueSubmission,
	) => Promise<{ invitationId: string; deliveryToken?: string; replayed: boolean }>;
	resend: (
		submission: InvitationMutateSubmission,
	) => Promise<{ invitationId: string; deliveryToken?: string; replayed: boolean }>;
	revoke: (
		submission: InvitationMutateSubmission,
	) => Promise<{ invitationId: string; replayed: boolean }>;
	accept: (submission: {
		idempotencyKey: string;
		expectedVersion: number;
	}) => Promise<{ actorId: string; companyId?: string; replayed: boolean }>;
};

export type InvitationIssueOutcome =
	/** inviteHref is null when a replay consumed the one-time token — resend mints a new link. */
	| { status: "issued"; invitationId: string; inviteHref: string | null }
	| { status: "recoverable"; message: string };

export type InvitationResendOutcome =
	| { status: "resent"; invitationId: string; inviteHref: string | null }
	| { status: "recoverable"; message: string };

export type InvitationRevokeOutcome =
	| { status: "revoked"; invitationId: string }
	| { status: "recoverable"; message: string };

export type InvitationAcceptOutcome =
	| { status: "accepted"; companyId: string | null }
	/** The signed-in verified e-mail does not match the invitation (403). */
	| { status: "wrong-account" }
	| { status: "recoverable"; message: string };

/**
 * Invitation commands over an injected transport (the typed client in the
 * app, a fake in tests). Fingerprints keep every retry replay-safe: issue is
 * keyed by company + normalized address, resend/revoke by invitation +
 * expected version (a successful mutation bumps the version, so the next
 * intent is a fresh command).
 */
export function createInvitationsCommands(
	transport: InvitationsTransport,
	mintKey: MintKey = defaultMintKey,
) {
	const keyFor = createKeyRegistry(mintKey);
	return {
		async issue(companyId: string, draft: InvitationDraft): Promise<InvitationIssueOutcome> {
			const email = draft.email.trim();
			try {
				const receipt = await transport.issue({
					idempotencyKey: keyFor(`issue:${companyId}:${normalizeInviteEmail(email)}`),
					companyId,
					email,
					bindings: [...COMPANY_MEMBER_BINDINGS],
				});
				return {
					status: "issued",
					invitationId: receipt.invitationId,
					inviteHref: receipt.deliveryToken ? inviteHrefFor(receipt.deliveryToken) : null,
				};
			} catch {
				return { status: "recoverable", message: INVITATION_ISSUE_RECOVERABLE_MESSAGE };
			}
		},
		async resend(invitationId: string, expectedVersion: number): Promise<InvitationResendOutcome> {
			try {
				const receipt = await transport.resend({
					idempotencyKey: keyFor(`resend:${invitationId}:${expectedVersion}`),
					invitationId,
					expectedVersion,
				});
				return {
					status: "resent",
					invitationId: receipt.invitationId,
					inviteHref: receipt.deliveryToken ? inviteHrefFor(receipt.deliveryToken) : null,
				};
			} catch {
				return { status: "recoverable", message: INVITATION_MUTATION_RECOVERABLE_MESSAGE };
			}
		},
		async revoke(invitationId: string, expectedVersion: number): Promise<InvitationRevokeOutcome> {
			try {
				const receipt = await transport.revoke({
					idempotencyKey: keyFor(`revoke:${invitationId}:${expectedVersion}`),
					invitationId,
					expectedVersion,
				});
				return { status: "revoked", invitationId: receipt.invitationId };
			} catch {
				return { status: "recoverable", message: INVITATION_MUTATION_RECOVERABLE_MESSAGE };
			}
		},
		/**
		 * Accept the continuation for the signed-in verified account. The key is
		 * draft-stable per version so a retry replays the receipt (exactly one
		 * Actor). A 403 is the honest email mismatch; anything else is recoverable.
		 */
		async accept(expectedVersion: number): Promise<InvitationAcceptOutcome> {
			try {
				const receipt = await transport.accept({
					idempotencyKey: keyFor(`accept:${expectedVersion}`),
					expectedVersion,
				});
				return { status: "accepted", companyId: receipt.companyId ?? null };
			} catch (error) {
				if (isForbidden(error)) return { status: "wrong-account" };
				return { status: "recoverable", message: INVITATION_ACCEPT_RECOVERABLE_MESSAGE };
			}
		},
	};
}

export type InvitationsCommands = ReturnType<typeof createInvitationsCommands>;
