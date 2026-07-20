export type OrganizationErrorCode =
	| "access_denied"
	| "email_mismatch"
	| "idempotency_conflict"
	| "invitation_expired"
	| "invitation_not_pending"
	| "last_human_owner"
	| "scope_mismatch"
	| "version_conflict";

export class OrganizationDomainError extends Error {
	constructor(
		readonly code: OrganizationErrorCode,
		message: string,
	) {
		super(message);
		this.name = "OrganizationDomainError";
	}
}

export interface ExactScopeBinding {
	readonly companyId: string;
	readonly scopeType: "company" | "space";
	readonly spaceId: string | null;
	readonly permissions: readonly string[];
}

export function resolveExactScopePermissions(input: {
	readonly companyId: string;
	readonly spaceId?: string;
	readonly bindings: readonly ExactScopeBinding[];
}): { company: string[]; space: string[] } {
	const company = new Set<string>();
	const space = new Set<string>();

	for (const binding of input.bindings) {
		if (binding.companyId !== input.companyId) continue;
		if (binding.scopeType === "company" && binding.spaceId === null) {
			for (const permission of binding.permissions) company.add(permission);
			continue;
		}
		if (
			binding.scopeType === "space" &&
			input.spaceId !== undefined &&
			binding.spaceId === input.spaceId
		) {
			for (const permission of binding.permissions) space.add(permission);
		}
	}

	return { company: [...company].sort(), space: [...space].sort() };
}

export function assertExpectedVersion(actual: number, expected: number): void {
	if (actual !== expected) {
		throw new OrganizationDomainError(
			"version_conflict",
			`Expected version ${expected} but found ${actual}`,
		);
	}
}

export function evaluateReceipt(
	receipt: { readonly payloadHash: string; readonly resultId: string | null },
	payloadHash: string,
): { kind: "replay"; resultId: string | null } {
	if (receipt.payloadHash !== payloadHash) {
		throw new OrganizationDomainError(
			"idempotency_conflict",
			"Idempotency key was used with a different payload",
		);
	}
	return { kind: "replay", resultId: receipt.resultId };
}

export function assertHumanOwnerCanBeRemoved(input: {
	readonly targetKind: "human" | "agent";
	readonly targetIsOwner: boolean;
	readonly activeHumanOwnerCount: number;
}): void {
	if (input.targetKind === "human" && input.targetIsOwner && input.activeHumanOwnerCount <= 1) {
		throw new OrganizationDomainError(
			"last_human_owner",
			"The last active Human Owner cannot be removed",
		);
	}
}

export function normalizeInvitationEmail(email: string): string {
	return email.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired" | "superseded";

export function transitionInvitation(
	invitation: {
		readonly status: InvitationStatus;
		readonly version: number;
		readonly expiresAt: Date;
	},
	command: {
		readonly kind: "accept" | "resend" | "revoke";
		readonly expectedVersion: number;
		readonly now: Date;
	},
): { status: InvitationStatus; version: number } {
	assertExpectedVersion(invitation.version, command.expectedVersion);
	if (invitation.status !== "pending") {
		throw new OrganizationDomainError(
			"invitation_not_pending",
			`Invitation is ${invitation.status}`,
		);
	}
	if (invitation.expiresAt.getTime() <= command.now.getTime()) {
		return { status: "expired", version: invitation.version + 1 };
	}

	const statusByCommand = {
		accept: "accepted",
		resend: "superseded",
		revoke: "revoked",
	} as const;
	return { status: statusByCommand[command.kind], version: invitation.version + 1 };
}
