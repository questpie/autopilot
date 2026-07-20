import { describe, expect, test } from "bun:test";
import {
	OrganizationDomainError,
	assertExpectedVersion,
	assertHumanOwnerCanBeRemoved,
	evaluateReceipt,
	normalizeInvitationEmail,
	resolveExactScopePermissions,
	transitionInvitation,
} from "../../../src/questpie/server/domain/organization-policy";

describe("F01 Company participation and authority contract", () => {
	test("Company role permissions never imply Space content permissions", () => {
		const permissions = resolveExactScopePermissions({
			companyId: "hreben",
			spaceId: "marketing",
			bindings: [
				{
					companyId: "hreben",
					scopeType: "company",
					spaceId: null,
					permissions: ["company.read", "spaces.create_archive"],
				},
			],
		});

		expect(permissions.company).toEqual(["company.read", "spaces.create_archive"]);
		expect(permissions.space).toEqual([]);
	});

	test("ignores a binding whose Company or Space does not exactly match", () => {
		const permissions = resolveExactScopePermissions({
			companyId: "hreben",
			spaceId: "marketing",
			bindings: [
				{ companyId: "other", scopeType: "company", spaceId: null, permissions: ["company.read"] },
				{
					companyId: "hreben",
					scopeType: "space",
					spaceId: "finance",
					permissions: ["space.read"],
				},
			],
		});

		expect(permissions).toEqual({ company: [], space: [] });
	});

	test("same idempotency payload replays while a changed payload conflicts", () => {
		expect(evaluateReceipt({ payloadHash: "same", resultId: "company-1" }, "same")).toEqual({
			kind: "replay",
			resultId: "company-1",
		});
		expect(() =>
			evaluateReceipt({ payloadHash: "first", resultId: "company-1" }, "changed"),
		).toThrow(
			new OrganizationDomainError(
				"idempotency_conflict",
				"Idempotency key was used with a different payload",
			),
		);
	});

	test("CAS rejects a stale aggregate version", () => {
		expect(() => assertExpectedVersion(4, 3)).toThrow(
			new OrganizationDomainError("version_conflict", "Expected version 3 but found 4"),
		);
	});

	test("the last active Human Owner cannot be suspended or archived", () => {
		expect(() =>
			assertHumanOwnerCanBeRemoved({
				targetKind: "human",
				targetIsOwner: true,
				activeHumanOwnerCount: 1,
			}),
		).toThrow(
			new OrganizationDomainError(
				"last_human_owner",
				"The last active Human Owner cannot be removed",
			),
		);
		expect(() =>
			assertHumanOwnerCanBeRemoved({
				targetKind: "agent",
				targetIsOwner: false,
				activeHumanOwnerCount: 1,
			}),
		).not.toThrow();
	});
});

describe("Invitation lifecycle contract", () => {
	test("normalizes the verified-email comparison", () => {
		expect(normalizeInvitationEmail("  TOMAS@HREBEN.SK ")).toBe("tomas@hreben.sk");
	});

	test("accept, resend, revoke, and expiry race from the same version fail closed", () => {
		const pending = {
			status: "pending" as const,
			version: 7,
			expiresAt: new Date("2026-07-19T10:00:00Z"),
		};
		const now = new Date("2026-07-19T09:00:00Z");
		expect(transitionInvitation(pending, { kind: "accept", expectedVersion: 7, now })).toEqual({
			status: "accepted",
			version: 8,
		});
		expect(transitionInvitation(pending, { kind: "resend", expectedVersion: 7, now })).toEqual({
			status: "superseded",
			version: 8,
		});
		expect(transitionInvitation(pending, { kind: "revoke", expectedVersion: 7, now })).toEqual({
			status: "revoked",
			version: 8,
		});
		expect(() =>
			transitionInvitation({ ...pending, version: 8 }, { kind: "accept", expectedVersion: 7, now }),
		).toThrow(OrganizationDomainError);
		expect(
			transitionInvitation(pending, {
				kind: "accept",
				expectedVersion: 7,
				now: new Date("2026-07-19T10:00:00Z"),
			}),
		).toEqual({ status: "expired", version: 8 });
	});
});
