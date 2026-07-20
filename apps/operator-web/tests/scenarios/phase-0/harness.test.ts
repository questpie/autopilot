import { describe, expect, test } from "bun:test";
import {
	ControllableQueueFixture,
	FixtureClock,
	IdempotencyFixture,
	ProviderFixture,
	RbacFixture,
	RealtimeGapFixture,
	ScenarioEvidenceRecorder,
	createDisposableCompanyFixture,
	createFixtureIdFactory,
	startAuthFixture,
} from "../harness";
import { phase0ScenarioContracts, stableSelectors } from "./contracts";
import { phase0FixtureProfiles } from "./fixture-profiles";
import {
	phase0QueryStateCoverage,
	notApplicableReasons,
	queryStateKeys,
	stateObligationRegistry,
} from "./state-obligations";

describe("Phase 0 scenario contract", () => {
	test("registers every universal-state obligation with one owner and executable evidence metadata", () => {
		expect(stateObligationRegistry.map((obligation) => obligation.id)).toEqual([
			"US-AUTH-01",
			"US-INVITE-01",
			"US-SETUP-01",
			"US-HOME-01",
			"US-ACTIVITY-01",
			"US-SPACES-01",
			"US-SPACE-01",
			"US-PROJECT-01",
			"US-CHANNELS-01",
			"US-GOAL-01",
			"US-TASK-01",
			"US-TASK-ASSIGN-01",
			"US-THREAD-01",
			"US-NEEDS-01",
			"US-RUN-DETAIL-01",
			"US-SCOPE-01",
			"US-QUERY-REALTIME-01",
			"US-AI-SETUP-01",
			"US-RUN-LIVE-01",
			"US-PERMISSION-01",
			"US-RUN-CANCEL-01",
			"US-RUN-RETRY-01",
			"US-CAPACITY-LOSS-01",
			"US-AGENT-PEERS-01",
			"US-COPY-01",
			"US-ADAPTIVE-01",
		]);

		const registeredSelectors = new Set(Object.values(stableSelectors));
		for (const obligation of stateObligationRegistry) {
			expect(obligation.proofTask).toStartWith(`prove-${obligation.ownerFlow.toLowerCase()}-`);
			expect(obligation.reusedBy).not.toContain(obligation.ownerFlow);
			expect(obligation.selectors.length).toBeGreaterThan(0);
			expect(obligation.selectors.every((selector) => registeredSelectors.has(selector))).toBe(
				true,
			);
			expect(obligation.fixtureModeIds.length).toBeGreaterThan(0);
			expect(
				obligation.fixtureModeIds.every((mode) => /^[a-z][a-z0-9-]+:[a-z0-9-]+$/.test(mode)),
			).toBe(true);
			expect(obligation.layers.length).toBeGreaterThan(0);
			expect(obligation.absenceAssertion.length).toBeGreaterThan(20);
		}
	});

	test("dispositions every universal query state for every accepted query-backed screen", () => {
		expect(phase0QueryStateCoverage.map((surface) => surface.selector)).toEqual([
			"screen-sign-in",
			"screen-invitation-acceptance",
			"screen-company-setup",
			"screen-team-setup",
			"screen-work-setup",
			"screen-company-home",
			"screen-company-activity",
			"screen-ai-setup",
			"screen-space-directory",
			"screen-space-overview",
			"screen-project-context",
			"screen-channel-directory",
			"screen-goal-list",
			"screen-goal-detail",
			"screen-task-list",
			"screen-task-detail",
			"screen-channel-thread",
			"screen-needs-you",
			"screen-run-detail",
		]);
		const obligationById = new Map(
			stateObligationRegistry.map((obligation) => [obligation.id, obligation]),
		);
		for (const surface of phase0QueryStateCoverage) {
			expect(Object.keys(surface.states)).toEqual(queryStateKeys);
			for (const disposition of Object.values(surface.states)) {
				if ("notApplicable" in disposition) {
					expect(notApplicableReasons).toContain(disposition.notApplicable);
					continue;
				}

				const obligation = obligationById.get(disposition.obligationId);
				expect(obligation).toBeDefined();
				expect(obligation?.selectors).toContain(surface.selector);
				expect(obligation?.fixtureModeIds).toContain(disposition.fixtureModeId);
			}
		}
	});

	test("keeps flow ownership and reuse backlinks exact", () => {
		const ownedByFlow = Object.fromEntries(
			phase0ScenarioContracts.map((scenario) => [
				scenario.flow,
				stateObligationRegistry
					.filter((obligation) => obligation.ownerFlow === scenario.flow)
					.map((obligation) => obligation.id),
			]),
		);
		const reusedByFlow = Object.fromEntries(
			phase0ScenarioContracts.map((scenario) => [
				scenario.flow,
				stateObligationRegistry
					.filter((obligation) => obligation.reusedBy.includes(scenario.flow))
					.map((obligation) => obligation.id),
			]),
		);

		expect(ownedByFlow).toEqual({
			F01: [
				"US-AUTH-01",
				"US-INVITE-01",
				"US-SETUP-01",
				"US-HOME-01",
				"US-ACTIVITY-01",
				"US-SPACES-01",
				"US-COPY-01",
				"US-ADAPTIVE-01",
			],
			F02: ["US-AI-SETUP-01"],
			F03: [
				"US-SPACE-01",
				"US-PROJECT-01",
				"US-CHANNELS-01",
				"US-GOAL-01",
				"US-TASK-01",
				"US-SCOPE-01",
			],
			F04: ["US-THREAD-01", "US-RUN-LIVE-01"],
			F05: ["US-TASK-ASSIGN-01"],
			F06: ["US-NEEDS-01", "US-RUN-DETAIL-01", "US-PERMISSION-01"],
			F07: ["US-RUN-CANCEL-01", "US-RUN-RETRY-01"],
			F08: ["US-AGENT-PEERS-01"],
			F09: ["US-QUERY-REALTIME-01"],
			F10: ["US-CAPACITY-LOSS-01"],
		});
		expect(reusedByFlow).toEqual({
			F01: ["US-SCOPE-01", "US-QUERY-REALTIME-01"],
			F02: ["US-SCOPE-01", "US-QUERY-REALTIME-01", "US-COPY-01"],
			F03: ["US-SPACES-01", "US-QUERY-REALTIME-01", "US-COPY-01"],
			F04: ["US-SCOPE-01", "US-QUERY-REALTIME-01", "US-COPY-01", "US-ADAPTIVE-01"],
			F05: ["US-TASK-01", "US-SCOPE-01", "US-QUERY-REALTIME-01", "US-RUN-LIVE-01", "US-COPY-01"],
			F06: ["US-SCOPE-01", "US-QUERY-REALTIME-01", "US-COPY-01"],
			F07: ["US-RUN-DETAIL-01", "US-SCOPE-01", "US-QUERY-REALTIME-01", "US-COPY-01"],
			F08: ["US-SCOPE-01", "US-QUERY-REALTIME-01", "US-RUN-LIVE-01", "US-COPY-01"],
			F09: ["US-THREAD-01", "US-SCOPE-01", "US-COPY-01"],
			F10: [
				"US-SCOPE-01",
				"US-QUERY-REALTIME-01",
				"US-AI-SETUP-01",
				"US-RUN-RETRY-01",
				"US-COPY-01",
			],
		});
	});

	test("registers F01-F10 once with locale-independent selectors", () => {
		expect(phase0ScenarioContracts.map((scenario) => scenario.flow)).toEqual([
			"F01",
			"F02",
			"F03",
			"F04",
			"F05",
			"F06",
			"F07",
			"F08",
			"F09",
			"F10",
		]);
		for (const scenario of phase0ScenarioContracts) {
			expect(scenario.stableSelectors.length).toBeGreaterThan(0);
			expect(scenario.stableSelectors.every((selector) => /^[a-z][a-z0-9-]+$/.test(selector))).toBe(
				true,
			);
			expect(scenario.negativeOracle.length).toBeGreaterThan(20);
		}
	});

	test("declares real HTTP for auth, cookie, redirect, and critical realtime journeys", () => {
		for (const flow of ["F01", "F02", "F03", "F04", "F06", "F09"]) {
			expect(
				phase0ScenarioContracts.find((scenario) => scenario.flow === flow)?.requiresRealHttp,
			).toBe(true);
		}
	});

	test("registers the complete accepted selector contract for every F01-F10 journey", () => {
		const requiredSelectors = {
			F01: [
				"screen-sign-in",
				"screen-company-setup",
				"screen-team-setup",
				"screen-work-setup",
				"screen-invitation-acceptance",
				"screen-company-home",
				"screen-company-activity",
				"screen-space-directory",
				"screen-space-overview",
				"screen-channel-thread",
				"chat-composer",
			],
			F02: ["screen-ai-setup", "provider-verify-action", "agent-activate-action"],
			F03: [
				"screen-space-directory",
				"screen-space-overview",
				"screen-project-context",
				"screen-channel-directory",
				"screen-channel-thread",
				"screen-goal-list",
				"screen-goal-detail",
				"goal-criterion-row",
				"screen-task-list",
				"screen-task-detail",
				"task-assignee-trigger",
			],
			F04: ["screen-channel-thread", "chat-composer", "message-run-card"],
			F05: ["screen-task-detail", "task-assignee-trigger", "message-run-card"],
			F06: [
				"screen-needs-you",
				"screen-run-detail",
				"permission-decision-approve",
				"permission-decision-deny",
				"permission-routing-state",
			],
			F07: ["screen-run-detail", "run-cancel-action", "run-retry-action"],
			F08: ["screen-channel-thread", "message-run-card"],
			F09: ["screen-channel-thread", "realtime-state"],
			F10: ["screen-ai-setup", "message-run-card"],
		} satisfies Record<(typeof phase0ScenarioContracts)[number]["flow"], readonly string[]>;

		for (const scenario of phase0ScenarioContracts) {
			expect(scenario.stableSelectors).toEqual(requiredSelectors[scenario.flow]);
		}
	});

	test("declares exact F01 invitation, F03 Channel, and F06 permission fixture modes", () => {
		const fixtureCapabilities = new Map(
			phase0ScenarioContracts.map((scenario) => [scenario.flow, scenario.fixtures]),
		);
		expect(fixtureCapabilities.get("F01")).toContain("invitations");
		expect(fixtureCapabilities.get("F01")).toContain("screen-states");
		expect(fixtureCapabilities.get("F03")).toContain("spaces-channels");
		expect(fixtureCapabilities.get("F06")).toContain("permissions");
		expect(fixtureCapabilities.get("F08")).toContain("activated-agents");

		expect(phase0FixtureProfiles.F01.invitationModes).toEqual([
			"eligible",
			"expired",
			"revoked",
			"already-used",
			"wrong-account",
			"superseded-by-resend",
			"accept-resend-race",
		]);
		expect(phase0FixtureProfiles.F01.screenStates).toEqual([
			"home-loading",
			"home-empty-human-only",
			"home-populated",
			"activity-loading",
			"activity-empty",
			"activity-populated",
			"long-slovak-copy",
		]);
		expect(phase0FixtureProfiles.F03.channels).toEqual([
			{
				key: "whole-company-general",
				spaceKey: "whole-company",
				kind: "system_default",
				systemKey: "general",
				slug: "general",
			},
			{
				key: "marketing-general",
				spaceKey: "marketing",
				kind: "system_default",
				systemKey: "general",
				slug: "general",
			},
			{
				key: "marketing-campaign",
				spaceKey: "marketing",
				kind: "standard",
				systemKey: null,
				slug: "kampan",
			},
		]);
		expect(phase0FixtureProfiles.F06.permissionModes).toEqual([
			"eligible-approver",
			"no-approver",
			"configuration-only-recipient",
			"wrong-approver",
			"newly-ineligible-approver",
			"expired-request",
			"expired-grant",
			"unknown-effect",
			"revoked-access",
			"forged-authority",
			"stale-principal",
			"stale-lease",
			"duplicate-decision",
		]);
	});

	test("pins deterministic independent Architect and Critic activation fixtures for F08", () => {
		const profile = phase0FixtureProfiles.F08;

		expect(profile.agents.map((agent) => agent.actorKey)).toEqual(["architect", "critic"]);
		for (const agent of profile.agents) {
			expect(agent.state).toBe("active");
			expect(agent.membership).toEqual({ spaceKey: "marketing", state: "active" });
			expect(agent.roleBinding.revision).toBe(1);
			expect(agent.skill.revision).toBe(1);
			expect(agent.requestPolicy.revision).toBe(1);
			expect(agent.executionPolicy.revision).toBe(1);
			expect(agent.providerSnapshot).toBe("qualified-commercial-provider:v1");
			expect(agent.modelSnapshot).toBe("qualified-commercial-offering:v1");
			expect(agent.runtimeSnapshot).toBe("self-hosted-embedded:v1");
			expect(agent.workerSnapshot).toBe("hreben-worker-01:lease-1");
		}
		expect(profile.rootRuns).toHaveLength(2);
		expect(new Set(profile.rootRuns.map((run) => run.runKey)).size).toBe(2);
		expect(new Set(profile.rootRuns.map((run) => run.agentKey))).toEqual(
			new Set(["architect", "critic"]),
		);
		expect(profile.lineageGuard).toEqual({ maximumDepth: 3, rejectRepeatedFingerprint: true });
		expect(profile.admissionCases).toEqual([
			{ mode: "eligible", agentKey: "architect", expected: "accepted" },
			{ mode: "missing-membership", agentKey: "architect", expected: "rejected" },
			{ mode: "inactive-agent", agentKey: "architect", expected: "rejected" },
			{ mode: "incompatible-runtime", agentKey: "critic", expected: "rejected" },
		]);
		expect(profile.lineageCases).toEqual([
			{
				mode: "allowed-child",
				parentAgentKey: "architect",
				childAgentKey: "critic",
				depth: 2,
				fingerprint: "architect>critic:campaign-review",
				expected: "accepted",
			},
			{
				mode: "depth-exceeded",
				parentAgentKey: "architect",
				childAgentKey: "critic",
				depth: 4,
				fingerprint: "depth-4:campaign-review",
				expected: "rejected",
			},
			{
				mode: "repeated-fingerprint",
				parentAgentKey: "critic",
				childAgentKey: "architect",
				depth: 3,
				fingerprint: "architect>critic:campaign-review",
				expected: "rejected",
			},
		]);
		expect(profile.siblingIsolationCases).toEqual([
			{ changedRunKey: "architect-root-run", state: "failed", unaffectedRunKey: "critic-root-run" },
			{
				changedRunKey: "critic-root-run",
				state: "cancelled",
				unaffectedRunKey: "architect-root-run",
			},
		]);
	});
});

describe("Phase 0 fixture capabilities", () => {
	test("creates and disposes an isolated Company graph", () => {
		const ids = createFixtureIdFactory("company");
		const fixture = createDisposableCompanyFixture(ids);
		const marek = fixture.addActor({ kind: "human", name: "Marek" });
		const wholeCompany = fixture.addSpace({ name: "Whole Company", isWholeCompany: true });

		expect(fixture.company.name).toBe("Hrebeň");
		expect(fixture.actors.get(marek.id)).toEqual(marek);
		expect(fixture.spaces.get(wholeCompany.id)).toEqual(wholeCompany);
		expect(fixture.databaseName).toStartWith("autopilot_test_company_company_");

		fixture.dispose();
		expect(fixture.disposed).toBe(true);
		expect(fixture.actors.size).toBe(0);
		expect(() => fixture.addActor({ kind: "agent", name: "Autopilot" })).toThrow();
	});

	test("uses real HTTP for cookie and redirect auth behavior", async () => {
		const auth = startAuthFixture(createFixtureIdFactory("auth"));
		try {
			const anonymous = await fetch(`${auth.baseUrl}/app`, { redirect: "manual" });
			expect(anonymous.status).toBe(303);
			expect(anonymous.headers.get("location")).toBe("/sign-in");

			const signIn = await fetch(`${auth.baseUrl}/auth/sign-in`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: "marek@example.test" }),
				redirect: "manual",
			});
			const cookie = signIn.headers.get("set-cookie");
			expect(signIn.status).toBe(303);
			expect(cookie).toContain(`${auth.sessionCookieName}=`);
			expect(cookie).toContain("HttpOnly");

			const authenticated = await fetch(`${auth.baseUrl}/app`, {
				headers: { cookie: cookie?.split(";")[0] ?? "" },
			});
			expect(authenticated.status).toBe(200);
			expect(await authenticated.json()).toEqual({ authenticated: true });
		} finally {
			auth.stop();
		}
	});

	test("holds provider verification in a realistic observable delay", async () => {
		const clock = new FixtureClock();
		const provider = new ProviderFixture(clock, "invalid-credential", 750);
		const resultPromise = provider.verify();

		expect(provider.status).toBe("verifying");
		expect(clock.pendingWaitCount).toBe(1);
		clock.advanceBy(749);
		expect(provider.status).toBe("verifying");
		clock.advanceBy(1);

		expect(await resultPromise).toEqual({ status: "failed", reason: "invalid_credential" });
		expect(provider.status).toBe("settled");
	});

	test("redelivers queue work while an idempotency key preserves one effect", async () => {
		const ids = createFixtureIdFactory("queue");
		const queue = new ControllableQueueFixture<{ requestId: string }>(() => ids.next("message"));
		const ledger = new IdempotencyFixture<string>();
		let effectCount = 0;
		const messageId = queue.publish({ requestId: "request-1" });
		const consume = async ({ payload }: { payload: { requestId: string } }) =>
			ledger.execute(payload.requestId, () => {
				effectCount += 1;
				return `run-${effectCount}`;
			});

		await queue.deliverNext(consume);
		queue.redeliver(messageId);
		await queue.deliverNext(consume);

		expect(queue.history.map((delivery) => delivery.deliveryAttempt)).toEqual([1, 2]);
		expect(effectCount).toBe(1);
		expect(ledger.processedKeys).toEqual(["request-1"]);
	});

	test("returns bounded replay or an explicit replay gap", () => {
		const realtime = new RealtimeGapFixture<string>(2);
		realtime.publish("one");
		const second = realtime.publish("two");
		const third = realtime.publish("three");

		expect(realtime.reconnect(second.id)).toEqual({ kind: "replay", events: [third] });
		expect(realtime.reconnect(0)).toEqual({ kind: "gap", refetchRequired: true, latestEventId: 3 });
	});

	test("does not widen a Company grant into Space content access", () => {
		const rbac = new RbacFixture();
		rbac.grant({
			actorId: "marek",
			permission: "company.settings.read",
			scope: { kind: "company", companyId: "hreben" },
		});

		expect(
			rbac.allows("marek", "company.settings.read", { kind: "company", companyId: "hreben" }),
		).toBe(true);
		expect(
			rbac.allows("marek", "space.content.read", {
				kind: "space",
				companyId: "hreben",
				spaceId: "marketing",
			}),
		).toBe(false);
	});

	test("captures browser/server/network/console evidence without secrets", () => {
		const evidence = new ScenarioEvidenceRecorder();
		evidence.record({ source: "browser", level: "info", message: "screen-channel-thread visible" });
		evidence.record({
			source: "network",
			level: "info",
			message: "POST /commands/messages.send",
			metadata: { status: 201 },
		});
		evidence.record({ source: "console", level: "error", message: "realtime disconnected" });
		evidence.record({
			source: "server",
			level: "info",
			message: "replay gap requested bounded refetch",
		});

		expect(evidence.entries).toHaveLength(4);
		expect(evidence.errors()).toHaveLength(1);
		expect(() =>
			evidence.record({
				source: "server",
				level: "info",
				message: "unsafe",
				metadata: { credential: "redacted" },
			}),
		).toThrow();
	});
});
