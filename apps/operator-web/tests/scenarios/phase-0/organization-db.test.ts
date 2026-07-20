import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { app, createContext } from "../../../src/questpie/server/.generated";

// Fail-loud protection: this contract mutates whatever DATABASE_URL points at,
// so it refuses to run outside a scenario-harness disposable database. Direct
// invocation against a dev/prod database must error, never skip.
const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/\/qp_harness_\d{14}_[a-z0-9]{6}(?:\?|$)/.test(databaseUrl)) {
	throw new Error(
		"organization-db.test.ts runs only against a scenario-harness disposable database " +
			"(qp_harness_*). Use `bun run test:scenario-harness`; refusing this DATABASE_URL.",
	);
}

describe("F01 QUESTPIE organization database contract", () => {
	const userIds: string[] = [];
	const companyIds: string[] = [];
	let ownerUserId = "";
	let invitedUserId = "";
	let invitedEmail = "";
	let companyId = "";
	let ownerActorId = "";

	beforeAll(async () => {
		const context = await createContext({ accessMode: "system" });
		const unique = crypto.randomUUID();
		const owner = await context.collections.user.create({
			name: "Marek Test",
			email: `marek-${unique}@example.test`,
			emailVerified: true,
			role: "user",
		});
		invitedEmail = `jana-${unique}@example.test`;
		const invited = await context.collections.user.create({
			name: "Jana Test",
			email: invitedEmail,
			emailVerified: true,
			role: "user",
		});
		ownerUserId = owner.id;
		invitedUserId = invited.id;
		userIds.push(owner.id, invited.id);

		const result = await context.services.organizationDomain.bootstrap({
			userId: ownerUserId,
			userName: "Marek Test",
			name: "Hrebeň DB Test",
			idempotencyKey: `bootstrap-${crypto.randomUUID()}`,
		});
		companyId = result.companyId;
		ownerActorId = result.ownerActorId;
		companyIds.push(companyId);
	});

	afterAll(async () => {
		const context = await createContext({ accessMode: "system" });
		for (const trackedCompanyId of companyIds) {
			const invitations = await context.collections.actor_invitations.find({
				where: { company: trackedCompanyId },
				limit: 500,
			});
			if (invitations.docs.length) {
				await context.collections.invitation_challenges.deleteMany({
					where: { invitation: { in: invitations.docs.map((invitation) => invitation.id) } },
				});
			}
			await context.collections.command_receipts.deleteMany({
				where: { company: trackedCompanyId },
			});
			await context.collections.activity_events.deleteMany({
				where: { company: trackedCompanyId },
			});
			await context.collections.audit_events.deleteMany({ where: { company: trackedCompanyId } });
			await context.collections.actor_role_bindings.deleteMany({
				where: { company: trackedCompanyId },
			});
			await context.collections.space_memberships.deleteMany({
				where: { company: trackedCompanyId },
			});
			await context.collections.projects.deleteMany({ where: { company: trackedCompanyId } });
			await context.collections.spaces.deleteMany({ where: { company: trackedCompanyId } });
			await context.collections.roles.deleteMany({ where: { company: trackedCompanyId } });
			await context.collections.actor_invitations.deleteMany({
				where: { company: trackedCompanyId },
			});
			await context.collections.actors.deleteMany({ where: { company: trackedCompanyId } });
			await context.collections.companies.deleteMany({ where: { id: trackedCompanyId } });
		}
		await context.collections.command_receipts.deleteMany({
			where: { principalUser: { in: userIds } },
		});
		await context.collections.user.deleteMany({ where: { id: { in: userIds } } });
		await app.destroy();
	});

	test("atomically backfills the owner Actor and provisions the fixed participation graph", async () => {
		const context = await createContext({ accessMode: "system" });
		const company = await context.collections.companies.findOne({ where: { id: companyId } });
		const owner = await context.collections.actors.findOne({ where: { id: ownerActorId } });
		const autopilot = await context.collections.actors.findOne({
			where: { company: companyId, systemKey: "autopilot" },
		});
		const wholeCompany = await context.collections.spaces.findOne({
			where: { company: companyId, systemKey: "whole-company" },
		});
		const roles = await context.collections.roles.find({ where: { company: companyId } });
		const memberships = await context.collections.space_memberships.find({
			where: { company: companyId },
		});

		expect(company?.createdByUser).toBe(ownerUserId);
		expect(company?.createdByActor).toBe(ownerActorId);
		expect(owner?.membershipStatus).toBe("active");
		expect(autopilot?.setupStatus).toBe("pending_setup");
		expect(wholeCompany?.isWholeCompany).toBe(true);
		expect(roles.docs.map((role) => role.systemKey).sort()).toEqual([
			"admin",
			"lead",
			"member",
			"owner",
			"space-member",
			"viewer",
		]);
		expect(memberships.docs).toHaveLength(2);
		expect(memberships.docs.find((membership) => membership.actor === ownerActorId)?.status).toBe(
			"active",
		);
		expect(memberships.docs.find((membership) => membership.actor === autopilot?.id)?.status).toBe(
			"pending",
		);
	});

	test("replays the same bootstrap key and rejects a changed payload", async () => {
		const context = await createContext({ accessMode: "system" });
		const key = `bootstrap-replay-${crypto.randomUUID()}`;
		const first = await context.services.organizationDomain.bootstrap({
			userId: ownerUserId,
			userName: "Marek Test",
			name: "Replay Test",
			idempotencyKey: key,
		});
		companyIds.push(first.companyId);
		const replay = await context.services.organizationDomain.bootstrap({
			userId: ownerUserId,
			userName: "Marek Test",
			name: "Replay Test",
			idempotencyKey: key,
		});
		expect(replay).toEqual({ companyId: first.companyId, replayed: true });
		await expect(
			context.services.organizationDomain.bootstrap({
				userId: ownerUserId,
				userName: "Marek Test",
				name: "Changed",
				idempotencyKey: key,
			}),
		).rejects.toThrow("different payload");
	});

	test("fails every generated organization collection write closed outside system mode", async () => {
		const id = crypto.randomUUID();
		const forbiddenWrites = [
			() => app.collections.companies.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.actors.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.actor_invitations.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.invitation_challenges.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.roles.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.actor_role_bindings.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.spaces.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.space_memberships.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.projects.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.activity_events.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.audit_events.deleteById({ id }, { accessMode: "user" }),
			() => app.collections.command_receipts.deleteById({ id }, { accessMode: "user" }),
		];
		for (const write of forbiddenWrites) await expect(write()).rejects.toThrow();
	});

	test("accepts only a matching verified email and materializes exact Company and Space grants", async () => {
		const context = await createContext({ accessMode: "system" });
		const wholeCompany = await context.collections.spaces.findOne({
			where: { company: companyId, systemKey: "whole-company" },
		});
		expect(wholeCompany).not.toBeNull();
		const issued = await context.services.organizationDomain.issueInvitation({
			userId: ownerUserId,
			companyId,
			email: `  ${invitedEmail.toUpperCase()}  `,
			bindings: [
				{ roleSystemKey: "member", scopeType: "company" },
				{ roleSystemKey: "viewer", scopeType: "space", spaceId: wholeCompany!.id },
			],
			idempotencyKey: `invite-${crypto.randomUUID()}`,
		});
		const invitationBeforeExchange = await context.collections.actor_invitations.findOne({
			where: { id: issued.invitationId },
		});
		expect(invitationBeforeExchange?.normalizedEmail).toBe(invitedEmail);
		const exchanged = await context.services.organizationDomain.exchangeInvitationToken(
			issued.deliveryToken!,
		);
		await expect(
			context.services.organizationDomain.exchangeInvitationToken(issued.deliveryToken!),
		).rejects.toThrow();
		await expect(
			context.services.organizationDomain.acceptInvitation({
				userId: invitedUserId,
				userName: "Jana Test",
				verifiedEmail: "somebody-else@example.test",
				emailVerified: true,
				challenge: exchanged.challenge,
				expectedVersion: 2,
				idempotencyKey: `accept-mismatch-${crypto.randomUUID()}`,
			}),
		).rejects.toThrow("does not match");

		const accepted = await context.services.organizationDomain.acceptInvitation({
			userId: invitedUserId,
			userName: "Jana Test",
			verifiedEmail: invitedEmail,
			emailVerified: true,
			challenge: exchanged.challenge,
			expectedVersion: 2,
			idempotencyKey: `accept-${crypto.randomUUID()}`,
		});
		const actor = await context.collections.actors.findOne({ where: { id: accepted.actorId } });
		const membership = await context.collections.space_memberships.findOne({
			where: { actor: accepted.actorId, space: wholeCompany!.id, status: "active" },
		});
		const bindings = await context.collections.actor_role_bindings.find({
			where: { actor: accepted.actorId, status: "active" },
		});
		const roles = await context.collections.roles.find({
			where: { id: { in: bindings.docs.map((binding) => binding.role) } },
		});
		expect(actor?.membershipStatus).toBe("active");
		expect(membership).not.toBeNull();
		expect(roles.docs.map((role) => role.systemKey).sort()).toEqual(["member", "viewer"]);

		const suspended = await context.services.organizationDomain.suspendActor({
			userId: ownerUserId,
			actorId: accepted.actorId,
			expectedVersion: actor!.version,
			reason: "DB contract",
			idempotencyKey: `suspend-${crypto.randomUUID()}`,
		});
		await expect(
			context.services.organizationDomain.reactivateActor({
				userId: ownerUserId,
				actorId: accepted.actorId,
				expectedVersion: actor!.version,
				idempotencyKey: `reactivate-stale-${crypto.randomUUID()}`,
			}),
		).rejects.toThrow("version");
		await context.services.organizationDomain.reactivateActor({
			userId: ownerUserId,
			actorId: accepted.actorId,
			expectedVersion: suspended.version,
			idempotencyKey: `reactivate-${crypto.randomUUID()}`,
		});
	});

	test("rotates resend tokens, rejects stale invitation races, and terminally revokes", async () => {
		const context = await createContext({ accessMode: "system" });
		const email = `race-${crypto.randomUUID()}@example.test`;
		const issued = await context.services.organizationDomain.issueInvitation({
			userId: ownerUserId,
			companyId,
			email,
			bindings: [{ roleSystemKey: "member", scopeType: "company" }],
			idempotencyKey: `invite-race-${crypto.randomUUID()}`,
		});
		const resent = await context.services.organizationDomain.resendInvitation({
			userId: ownerUserId,
			invitationId: issued.invitationId,
			expectedVersion: 1,
			idempotencyKey: `resend-${crypto.randomUUID()}`,
		});
		await expect(
			context.services.organizationDomain.exchangeInvitationToken(issued.deliveryToken!),
		).rejects.toThrow();
		await expect(
			context.services.organizationDomain.revokeInvitation({
				userId: ownerUserId,
				invitationId: issued.invitationId,
				expectedVersion: 1,
				idempotencyKey: `revoke-stale-${crypto.randomUUID()}`,
			}),
		).rejects.toThrow();
		await context.services.organizationDomain.revokeInvitation({
			userId: ownerUserId,
			invitationId: resent.invitationId,
			expectedVersion: 1,
			idempotencyKey: `revoke-${crypto.randomUUID()}`,
		});
		await expect(
			context.services.organizationDomain.exchangeInvitationToken(resent.deliveryToken!),
		).rejects.toThrow();
	});

	test("allows exactly one winner when accept and revoke race on the same version", async () => {
		const context = await createContext({ accessMode: "system" });
		const email = `accept-race-${crypto.randomUUID()}@example.test`;
		const user = await context.collections.user.create({
			name: "Race User",
			email,
			emailVerified: true,
			role: "user",
		});
		userIds.push(user.id);
		const issued = await context.services.organizationDomain.issueInvitation({
			userId: ownerUserId,
			companyId,
			email,
			bindings: [{ roleSystemKey: "member", scopeType: "company" }],
			idempotencyKey: `invite-accept-race-${crypto.randomUUID()}`,
		});
		const exchanged = await context.services.organizationDomain.exchangeInvitationToken(
			issued.deliveryToken!,
		);
		const outcomes = await Promise.allSettled([
			context.services.organizationDomain.acceptInvitation({
				userId: user.id,
				userName: "Race User",
				verifiedEmail: email,
				emailVerified: true,
				challenge: exchanged.challenge,
				expectedVersion: 2,
				idempotencyKey: `accept-race-${crypto.randomUUID()}`,
			}),
			context.services.organizationDomain.revokeInvitation({
				userId: ownerUserId,
				invitationId: issued.invitationId,
				expectedVersion: 2,
				idempotencyKey: `revoke-race-${crypto.randomUUID()}`,
			}),
		]);
		expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
		expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
		const invitation = await context.collections.actor_invitations.findOne({
			where: { id: issued.invitationId },
		});
		expect(["accepted", "revoked"]).toContain(invitation?.status);
	});

	test("expires pending invitations and refuses to remove the last active Human Owner", async () => {
		const context = await createContext({ accessMode: "system" });
		const issued = await context.services.organizationDomain.issueInvitation({
			userId: ownerUserId,
			companyId,
			email: `expired-${crypto.randomUUID()}@example.test`,
			bindings: [{ roleSystemKey: "member", scopeType: "company" }],
			expiresInHours: 0,
			idempotencyKey: `invite-expired-${crypto.randomUUID()}`,
		});
		await expect(
			context.services.organizationDomain.exchangeInvitationToken(issued.deliveryToken!),
		).rejects.toThrow("expired");
		const invitation = await context.collections.actor_invitations.findOne({
			where: { id: issued.invitationId },
		});
		expect(invitation?.status).toBe("expired");

		const owner = await context.collections.actors.findOne({ where: { id: ownerActorId } });
		await expect(
			context.services.organizationDomain.suspendActor({
				userId: ownerUserId,
				actorId: ownerActorId,
				expectedVersion: owner!.version,
				idempotencyKey: `suspend-owner-${crypto.randomUUID()}`,
			}),
		).rejects.toThrow("last active Human Owner");
	});

	test("serializes concurrent Owner removals so one active Human Owner always remains", async () => {
		const context = await createContext({ accessMode: "system" });
		const secondOwner = await context.collections.actors.findOne({
			where: { company: companyId, user: invitedUserId, membershipStatus: "active" },
		});
		expect(secondOwner).not.toBeNull();
		await context.services.organizationDomain.replaceRoleBindings({
			userId: ownerUserId,
			actorId: secondOwner!.id,
			expectedVersion: secondOwner!.version,
			bindings: [{ roleSystemKey: "owner", scopeType: "company" }],
			idempotencyKey: `promote-owner-${crypto.randomUUID()}`,
		});
		const ownerRole = await context.collections.roles.findOne({
			where: { company: companyId, systemKey: "owner" },
		});
		expect(ownerRole).not.toBeNull();

		async function activeHumanOwnerCount() {
			const ownerBindings = await context.collections.actor_role_bindings.find({
				where: { company: companyId, role: ownerRole!.id, status: "active" },
			});
			return context.collections.actors.count({
				where: {
					id: { in: ownerBindings.docs.map((binding) => binding.actor) },
					kind: "human",
					membershipStatus: "active",
				},
			});
		}

		async function expectOneDurableWinner(
			outcomes: PromiseSettledResult<unknown>[],
			keys: readonly string[],
		) {
			expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
			expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
			expect(await activeHumanOwnerCount()).toBe(1);
			const receipts = await context.collections.command_receipts.find({
				where: { company: companyId, idempotencyKey: { in: [...keys] } },
			});
			const audits = await context.collections.audit_events.find({
				where: { company: companyId, correlationId: { in: [...keys] } },
			});
			expect(receipts.docs).toHaveLength(1);
			expect(audits.docs).toHaveLength(1);
		}

		const [first, second] = await Promise.all([
			context.collections.actors.findOne({ where: { id: ownerActorId } }),
			context.collections.actors.findOne({ where: { id: secondOwner!.id } }),
		]);
		const suspendKeys = [
			`suspend-first-owner-${crypto.randomUUID()}`,
			`suspend-second-owner-${crypto.randomUUID()}`,
		] as const;
		const outcomes = await Promise.allSettled([
			context.services.organizationDomain.suspendActor({
				userId: ownerUserId,
				actorId: first!.id,
				expectedVersion: first!.version,
				idempotencyKey: suspendKeys[0],
				correlationId: suspendKeys[0],
			}),
			context.services.organizationDomain.suspendActor({
				userId: ownerUserId,
				actorId: second!.id,
				expectedVersion: second!.version,
				idempotencyKey: suspendKeys[1],
				correlationId: suspendKeys[1],
			}),
		]);
		await expectOneDurableWinner(outcomes, suspendKeys);

		const actorsAfterSuspendRace = await Promise.all([
			context.collections.actors.findOne({ where: { id: ownerActorId } }),
			context.collections.actors.findOne({ where: { id: secondOwner!.id } }),
		]);
		const activeOwner = actorsAfterSuspendRace.find(
			(actor) => actor?.membershipStatus === "active",
		);
		const suspendedOwner = actorsAfterSuspendRace.find(
			(actor) => actor?.membershipStatus === "suspended",
		);
		expect(activeOwner?.user).toBeTruthy();
		expect(suspendedOwner).not.toBeNull();
		await context.services.organizationDomain.reactivateActor({
			userId: activeOwner!.user!,
			actorId: suspendedOwner!.id,
			expectedVersion: suspendedOwner!.version,
			idempotencyKey: `restore-suspended-owner-${crypto.randomUUID()}`,
		});
		expect(await activeHumanOwnerCount()).toBe(2);

		const ownersBeforeBindingRace = await Promise.all([
			context.collections.actors.findOne({ where: { id: ownerActorId } }),
			context.collections.actors.findOne({ where: { id: secondOwner!.id } }),
		]);
		const bindingKeys = [
			`remove-first-owner-binding-${crypto.randomUUID()}`,
			`remove-second-owner-binding-${crypto.randomUUID()}`,
		] as const;
		const bindingOutcomes = await Promise.allSettled(
			ownersBeforeBindingRace.map((actor, index) =>
				context.services.organizationDomain.replaceRoleBindings({
					userId: ownerUserId,
					actorId: actor!.id,
					expectedVersion: actor!.version,
					bindings: [{ roleSystemKey: "member", scopeType: "company" }],
					idempotencyKey: bindingKeys[index]!,
					correlationId: bindingKeys[index]!,
				}),
			),
		);
		await expectOneDurableWinner(bindingOutcomes, bindingKeys);

		const remainingOwnerBinding = await context.collections.actor_role_bindings.findOne({
			where: { company: companyId, role: ownerRole!.id, status: "active" },
		});
		const removedOwner = await context.collections.actors.findOne({
			where: {
				id: {
					in: [ownerActorId, secondOwner!.id].filter(
						(actorId) => actorId !== remainingOwnerBinding!.actor,
					),
				},
			},
		});
		const remainingOwner = await context.collections.actors.findOne({
			where: { id: remainingOwnerBinding!.actor },
		});
		await context.services.organizationDomain.replaceRoleBindings({
			userId: remainingOwner!.user!,
			actorId: removedOwner!.id,
			expectedVersion: removedOwner!.version,
			bindings: [{ roleSystemKey: "owner", scopeType: "company" }],
			idempotencyKey: `restore-owner-binding-${crypto.randomUUID()}`,
		});
		expect(await activeHumanOwnerCount()).toBe(2);

		const [suspendTarget, bindingTarget] = await Promise.all([
			context.collections.actors.findOne({ where: { id: ownerActorId } }),
			context.collections.actors.findOne({ where: { id: secondOwner!.id } }),
		]);
		const crossPathKeys = [
			`cross-suspend-owner-${crypto.randomUUID()}`,
			`cross-remove-owner-binding-${crypto.randomUUID()}`,
		] as const;
		const crossPathOutcomes = await Promise.allSettled([
			context.services.organizationDomain.suspendActor({
				userId: ownerUserId,
				actorId: suspendTarget!.id,
				expectedVersion: suspendTarget!.version,
				idempotencyKey: crossPathKeys[0],
				correlationId: crossPathKeys[0],
			}),
			context.services.organizationDomain.replaceRoleBindings({
				userId: ownerUserId,
				actorId: bindingTarget!.id,
				expectedVersion: bindingTarget!.version,
				bindings: [{ roleSystemKey: "member", scopeType: "company" }],
				idempotencyKey: crossPathKeys[1],
				correlationId: crossPathKeys[1],
			}),
		]);
		await expectOneDurableWinner(crossPathOutcomes, crossPathKeys);
	});
});
