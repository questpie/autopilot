import { afterAll, describe, expect, it } from "bun:test";
import { createDisposableDb, type DisposableDb } from "../../harness/real/disposable-db";
import {
	createAuthenticatedSession,
	createCookieJar,
	makeAuthedFetch,
	signInFreshSession,
} from "../../harness/real/identity";
import { createRunContext } from "../../harness/real/run-context";
import { type StartedServer, startServer } from "../../harness/real/server-process";
import { stableSelectors } from "../contracts";

const TEST_TIMEOUT = 240_000;

type Harness = {
	runId: string;
	db: DisposableDb;
	server: StartedServer;
};

let bootPromise: Promise<Harness> | null = null;

/** One boot shared by the facets below; the first caller pays inside its own timeout. */
const boot = (): Promise<Harness> => {
	bootPromise ??= (async () => {
		const ctx = createRunContext();
		const db = await createDisposableDb(ctx.runId);
		const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
		return { runId: ctx.runId, db, server };
	})();
	return bootPromise;
};

afterAll(async () => {
	if (!bootPromise) return;
	const harness = await bootPromise.catch(() => null);
	if (!harness) return;
	await harness.server.stop();
	await harness.db.drop();
});

/** SSR marker for a stable screen selector, as rendered into the HTML stream. */
const screenMarker = (testId: string): string => `data-testid="${testId}"`;

const locationOf = (response: Response): string => response.headers.get("location") ?? "";

/** Asserts a manual-redirect response: 3xx with a Location containing the path. */
const expectRedirectTo = (response: Response, path: string): void => {
	expect({
		status: response.status,
		redirected: response.status >= 300 && response.status < 400,
	}).toEqual({
		status: response.status,
		redirected: true,
	});
	expect(locationOf(response)).toContain(path);
};

/** Public continuation cookie the exchange 303 sets (server contract). */
const INVITATION_CHALLENGE_COOKIE = "qp_invitation_challenge";

/** An owner bootstraps a company and invites a fresh Lucia; returns the issued facts. */
const inviteLucia = async (harness: Harness, tag: string) => {
	const owner = await createAuthenticatedSession({
		baseUrl: harness.server.baseUrl,
		db: harness.db,
		runId: harness.runId,
		email: `invite-owner-${tag}-${harness.runId}@harness.invalid`,
	});
	const companyName = `Hreben Invite ${tag}`;
	const receipt = await owner.client.routes.companies.bootstrap.post({
		idempotencyKey: `invite-bootstrap-${tag}-${harness.runId}`,
		name: companyName,
	});
	const luciaEmail = `lucia-${tag}-${harness.runId}@harness.invalid`;
	// The canonical F01 member invitation grants company membership AND viewer
	// access to the Whole Company Space (server contract: organization-db.test.ts)
	// so the invited human sees exactly that one space and nothing wider.
	const wholeCompany = (
		await owner.client.collections.spaces.find({
			where: { company: receipt.companyId, systemKey: "whole-company" },
		})
	).docs[0];
	if (!wholeCompany) throw new Error("whole-company space missing after bootstrap");
	const invitation = await owner.client.routes.invitations.issue.post({
		idempotencyKey: `invite-issue-${tag}-${harness.runId}`,
		companyId: receipt.companyId,
		email: luciaEmail,
		bindings: [
			{ roleSystemKey: "member", scopeType: "company" },
			{ roleSystemKey: "viewer", scopeType: "space", spaceId: wholeCompany.id },
		],
	});
	const slug = (await owner.client.collections.companies.find({})).docs[0]?.slug ?? "";
	if (!invitation.deliveryToken) throw new Error("issue did not return a delivery token");
	return {
		owner,
		companyId: receipt.companyId,
		companyName,
		companySlug: slug,
		invitationId: invitation.invitationId,
		deliveryToken: invitation.deliveryToken,
		luciaEmail,
	};
};

/** Fresh anonymous cookie jar that exchanges the raw token into the continuation challenge. */
const anonExchange = async (harness: Harness, deliveryToken: string) => {
	const jar = createCookieJar();
	const fetchImpl = makeAuthedFetch(jar, harness.server.baseUrl);
	const response = await fetchImpl(`${harness.server.baseUrl}/api/invitations/exchange`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ token: deliveryToken }),
		redirect: "manual",
	});
	await response.arrayBuffer().catch(() => undefined);
	return { jar, fetch: fetchImpl, response };
};

describe("F01 flow: bootstrap a human-only company through the real operator-web", () => {
	it(
		"sign-in screen serves the auth entry",
		async () => {
			const { server } = await boot();
			const response = await fetch(`${server.baseUrl}/sign-in`);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain(screenMarker(stableSelectors.screenSignIn));
		},
		TEST_TIMEOUT,
	);

	it(
		"root routes anonymous visitors to sign-in",
		async () => {
			const { server } = await boot();
			const response = await fetch(`${server.baseUrl}/`, { redirect: "manual" });
			expectRedirectTo(response, "/sign-in");
			await response.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"authenticated visitors are routed away from sign-in",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `routed-away-${harness.runId}@harness.invalid`,
			});
			// US-AUTH-01: Location-only assert — signed-in visitors never see the form.
			const response = await session.fetch(`${harness.server.baseUrl}/sign-in`, {
				redirect: "manual",
			});
			expect(response.status).toBeGreaterThanOrEqual(300);
			expect(response.status).toBeLessThan(400);
			const location = locationOf(response);
			expect(location.length).toBeGreaterThan(0);
			expect(location.includes("/sign-in")).toBe(false);
			await response.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"onboarding requires a session",
		async () => {
			const { server } = await boot();
			const response = await fetch(`${server.baseUrl}/onboarding/company`, {
				redirect: "manual",
			});
			expectRedirectTo(response, "/sign-in");
			await response.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"company setup screen",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `company-step-${harness.runId}@harness.invalid`,
			});
			const response = await session.fetch(`${harness.server.baseUrl}/onboarding/company`);
			expect(response.status).toBe(200);
			expect(await response.text()).toContain(screenMarker(stableSelectors.screenCompanySetup));
		},
		TEST_TIMEOUT,
	);

	it(
		"resume-forward skips the completed company step",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `resume-forward-${harness.runId}@harness.invalid`,
			});
			// Journey glue, already green server-side (auth-http.test.ts): the
			// typed-client bootstrap merely places this session past the step.
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `resume-forward-${harness.runId}`,
				name: "Hreben Resume",
			});
			const response = await session.fetch(`${harness.server.baseUrl}/onboarding/company`, {
				redirect: "manual",
			});
			expectRedirectTo(response, "/onboarding/team");
			await response.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"team step renders",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `team-step-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `team-step-${harness.runId}`,
				name: "Hreben Team",
			});
			const response = await session.fetch(`${harness.server.baseUrl}/onboarding/team`);
			expect(response.status).toBe(200);
			expect(await response.text()).toContain(screenMarker(stableSelectors.screenTeamSetup));
		},
		TEST_TIMEOUT,
	);

	it(
		"team roster lists the owner and the dormant autopilot truthfully",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `team-roster-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `team-roster-${harness.runId}`,
				name: "Hreben Roster",
			});
			const response = await session.fetch(`${harness.server.baseUrl}/onboarding/team`);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain(screenMarker(stableSelectors.screenTeamSetup));
			// Roster truth: the owner row carries the signed-in user's name and role.
			expect(html).toContain(`Harness User team-roster-${harness.runId}@harness.invalid`);
			expect(html).toContain("Vlastník");
			// The dormant Autopilot is pending setup — and claims no activity.
			expect(html).toContain("Vyžaduje nastavenie");
			expect(html).not.toContain("data-presence");
		},
		TEST_TIMEOUT,
	);

	it(
		"invitation issue hands the issuer the delivery token and the roster the pending row",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `invite-issuer-${harness.runId}@harness.invalid`,
			});
			const receipt = await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `invite-issuer-${harness.runId}`,
				name: "Hreben Invite",
			});
			if (receipt.replayed) throw new Error("bootstrap replayed on first submission");
			const luciaEmail = `lucia-invite-${harness.runId}@harness.invalid`;
			// Journey glue, already green server-side (auth-http.test.ts family): the
			// issue seam answers the ISSUER with the one-time delivery token — no
			// email delivery exists, so the issuer-visible /invite/<token> link the
			// team screen builds from it is the only honest channel.
			const invitation = await session.client.routes.invitations.issue.post({
				idempotencyKey: `invite-issue-${harness.runId}`,
				companyId: receipt.companyId,
				email: luciaEmail,
				bindings: [{ roleSystemKey: "member", scopeType: "company" }],
			});
			expect(invitation.replayed).toBe(false);
			if (invitation.replayed) throw new Error("invitation replayed on first issue");
			expect(typeof invitation.invitationId).toBe("string");
			expect(typeof invitation.deliveryToken).toBe("string");
			expect(invitation.deliveryToken.length).toBeGreaterThan(0);
			// The roster page owes the issuer the pending-invitation truth.
			const response = await session.fetch(`${harness.server.baseUrl}/onboarding/team`);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain(luciaEmail);
			expect(html).toContain("Pozvánka čaká");
		},
		TEST_TIMEOUT,
	);

	it(
		"AI setup screen renders while the provider is absent",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `ai-gate-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `ai-gate-${harness.runId}`,
				name: "Hreben AI",
			});
			const response = await session.fetch(`${harness.server.baseUrl}/onboarding/ai`);
			expect(response.status).toBe(200);
			expect(await response.text()).toContain(screenMarker(stableSelectors.screenAiSetup));
		},
		TEST_TIMEOUT,
	);

	it(
		"reaching the AI gate writes nothing and leaves the autopilot dormant",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `ai-absence-${harness.runId}@harness.invalid`,
			});
			const receipt = await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `ai-absence-${harness.runId}`,
				name: "Hreben Absence",
			});
			// Proceeding past the gate ('Nastaviť neskôr') is a client navigation with
			// no server seam — the executable oracle is the absence of any write. The
			// harness shares one database across facets, so the honest measure is a
			// delta: reaching the gate must add no command receipt.
			const receiptsBefore = await harness.db.exec(
				"SELECT count(*)::int AS count FROM command_receipts",
			);
			const aiStep = await session.fetch(`${harness.server.baseUrl}/onboarding/ai`);
			expect(aiStep.status).toBe(200);
			// The dormant Autopilot never advances and no provider surface exists to
			// hold a secret; reaching the gate creates no command receipt.
			const autopilot = await session.client.collections.actors.findOne({
				where: { id: receipt.autopilotActorId },
			});
			expect(autopilot?.setupStatus).toBe("pending_setup");
			expect(autopilot?.membershipStatus).toBe("invited");
			const receiptsAfter = await harness.db.exec(
				"SELECT count(*)::int AS count FROM command_receipts",
			);
			expect(receiptsAfter.rows[0]?.count).toBe(receiptsBefore.rows[0]?.count);
		},
		TEST_TIMEOUT,
	);

	it(
		"the app shell requires a session",
		async () => {
			const { server } = await boot();
			// The pathless guard redirects before any slug is resolved — an
			// anonymous visitor never learns whether the company exists.
			const response = await fetch(`${server.baseUrl}/app/hreben/home`, { redirect: "manual" });
			expectRedirectTo(response, "/sign-in");
			await response.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"the adaptive shell serves the company home for an onboarded owner",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `shell-home-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `shell-home-${harness.runId}`,
				name: "Hreben Home",
			});
			const companies = await session.client.collections.companies.find({});
			const slug = companies.docs[0]?.slug ?? "";
			expect(slug.length).toBeGreaterThan(0);
			const response = await session.fetch(`${harness.server.baseUrl}/app/${slug}/home`);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain(screenMarker(stableSelectors.screenCompanyHome));
			expect(html).toContain("Hreben Home");
		},
		TEST_TIMEOUT,
	);

	it(
		"root resolves an onboarded owner into the company shell",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `root-onboarded-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `root-onboarded-${harness.runId}`,
				name: "Hreben Root",
			});
			const companies = await session.client.collections.companies.find({});
			const slug = companies.docs[0]?.slug ?? "";
			const response = await session.fetch(`${harness.server.baseUrl}/`, { redirect: "manual" });
			expectRedirectTo(response, `/app/${slug}/home`);
			await response.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"a fresh session resumes into the shell from server truth",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `fresh-resume-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `fresh-resume-${harness.runId}`,
				name: "Hreben Resume Home",
			});
			const companies = await session.client.collections.companies.find({});
			const slug = companies.docs[0]?.slug ?? "";
			// A brand-new cookie jar signs in with the same credentials; "/" resolves
			// from the session cookie's server truth, not from any remembered state.
			const fresh = await signInFreshSession({
				baseUrl: harness.server.baseUrl,
				email: session.email,
				password: session.password,
			});
			const response = await fresh.fetch(`${harness.server.baseUrl}/`, { redirect: "manual" });
			expectRedirectTo(response, `/app/${slug}/home`);
			await response.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"a fresh visitor without a company resolves to the company step",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `fresh-nocompany-${harness.runId}@harness.invalid`,
			});
			const response = await session.fetch(`${harness.server.baseUrl}/`, { redirect: "manual" });
			expectRedirectTo(response, "/onboarding/company");
			await response.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"an unknown company slug does not leak existence",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `unknown-slug-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `unknown-slug-${harness.runId}`,
				name: "Hreben Unknown",
			});
			// A slug outside the visitor's visible set is indistinguishable from one
			// that never existed — both answer the uniform Slovak not-found.
			const response = await session.fetch(`${harness.server.baseUrl}/app/neexistuje/home`);
			expect(response.status).toBe(404);
			const html = await response.text();
			expect(html).not.toContain(screenMarker(stableSelectors.screenCompanyHome));
			expect(html).toContain("nenašla");
		},
		TEST_TIMEOUT,
	);

	it(
		"the activity surface lists exactly the bootstrap event attributed to the owner",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `activity-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `activity-${harness.runId}`,
				name: "Hreben Activity",
			});
			const companies = await session.client.collections.companies.find({});
			const slug = companies.docs[0]?.slug ?? "";
			const response = await session.fetch(`${harness.server.baseUrl}/app/${slug}/activity`);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain(screenMarker(stableSelectors.screenCompanyActivity));
			// The one persisted event, attributed to the owner (their user name).
			expect(html).toContain("Spoločnosť spustená");
			expect(html).toContain(`activity-${harness.runId}@harness.invalid`);
			// Nothing is invented — no space-created (none happened) and no agent run.
			expect(html).not.toContain("Priestor vytvorený");
			expect(html).not.toContain("data-presence");
		},
		TEST_TIMEOUT,
	);

	it(
		"the spaces surfaces list the Whole Company and open its overview",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `spaces-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `spaces-${harness.runId}`,
				name: "Hreben Spaces",
			});
			const companies = await session.client.collections.companies.find({});
			const slug = companies.docs[0]?.slug ?? "";
			const directory = await session.fetch(`${harness.server.baseUrl}/app/${slug}/spaces`);
			expect(directory.status).toBe(200);
			const directoryHtml = await directory.text();
			expect(directoryHtml).toContain(screenMarker(stableSelectors.screenSpaceDirectory));
			expect(directoryHtml).toContain("Whole Company");
			const overview = await session.fetch(
				`${harness.server.baseUrl}/app/${slug}/spaces/whole-company`,
			);
			expect(overview.status).toBe(200);
			const overviewHtml = await overview.text();
			expect(overviewHtml).toContain(screenMarker(stableSelectors.screenSpaceOverview));
			expect(overviewHtml).toContain("Whole Company");
			expect(overviewHtml).toContain("#general");
		},
		TEST_TIMEOUT,
	);

	it(
		"a created space appears in the directory with its own general channel",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `space-create-${harness.runId}@harness.invalid`,
			});
			const receipt = await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `space-create-${harness.runId}`,
				name: "Hreben Create",
			});
			const slug = (await session.client.collections.companies.find({})).docs[0]?.slug ?? "";
			// Journey glue via the product seam: creating a space is already green
			// server-side; here it proves the surfaces reflect the new space.
			const created = await session.client.routes.spaces.create.post({
				idempotencyKey: `space-create-marketing-${harness.runId}`,
				companyId: receipt.companyId,
				name: "Marketing",
			});
			expect(created.replayed).toBe(false);
			const directory = await session.fetch(`${harness.server.baseUrl}/app/${slug}/spaces`);
			expect((await directory.text()).includes("Marketing")).toBe(true);
			const overview = await session.fetch(
				`${harness.server.baseUrl}/app/${slug}/spaces/marketing`,
			);
			expect(overview.status).toBe(200);
			const overviewHtml = await overview.text();
			expect(overviewHtml).toContain(screenMarker(stableSelectors.screenSpaceOverview));
			expect(overviewHtml).toContain("Marketing");
			expect(overviewHtml).toContain("#general");
		},
		TEST_TIMEOUT,
	);

	it(
		"the needs-you surface renders its honest empty state",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `needs-you-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `needs-you-${harness.runId}`,
				name: "Hreben Needs",
			});
			const slug = (await session.client.collections.companies.find({})).docs[0]?.slug ?? "";
			const response = await session.fetch(`${harness.server.baseUrl}/app/${slug}/needs-you`);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain(screenMarker(stableSelectors.screenNeedsYou));
			// Human-only and honest: nothing is waiting because no agent runs exist.
			expect(html).not.toContain("data-presence");
		},
		TEST_TIMEOUT,
	);

	it(
		"the rendered shell exposes only implemented destinations",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: `nav-negative-${harness.runId}@harness.invalid`,
			});
			await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `nav-negative-${harness.runId}`,
				name: "Hreben Nav",
			});
			const slug = (await session.client.collections.companies.find({})).docs[0]?.slug ?? "";
			const html = await (await session.fetch(`${harness.server.baseUrl}/app/${slug}/home`)).text();
			// The one nav config renders every implemented landmark...
			for (const landmark of [
				"Domov",
				"Potrebuje ťa",
				"Aktivita",
				"Všetky priestory",
				"Whole Company",
				"Tím",
				"Nastavenia AI",
			]) {
				expect(html).toContain(landmark);
			}
			// ...and never a destination F01 has not built (SPEC 2.1).
			for (const unbuilt of ["Ciele", "Úlohy", "Knižnica", "Behy"]) {
				expect(html).not.toContain(unbuilt);
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"invitation exchange redirects an anonymous continuation to sign-in",
		async () => {
			const harness = await boot();
			const { deliveryToken } = await inviteLucia(harness, "exchange");
			// Journey glue, already green server-side (organization-db.test.ts): the
			// raw token is exchanged before auth for an opaque continuation challenge.
			const { jar, response } = await anonExchange(harness, deliveryToken);
			expect(response.status).toBe(303);
			expect(locationOf(response)).toContain("/sign-in?continue=invitation");
			expect(jar.cookieHeader()).toContain(INVITATION_CHALLENGE_COOKIE);
		},
		TEST_TIMEOUT,
	);

	it(
		"the sign-in continuation surfaces the masked invitation context",
		async () => {
			const harness = await boot();
			const { deliveryToken, companyName, luciaEmail } = await inviteLucia(harness, "banner");
			const { fetch: continuation } = await anonExchange(harness, deliveryToken);
			// The signed-out continuation carries the challenge cookie into sign-in,
			// which must surface the masked invitation context from the public seam.
			const response = await continuation(`${harness.server.baseUrl}/sign-in?continue=invitation`);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain(screenMarker(stableSelectors.screenSignIn));
			expect(html).toContain(companyName);
			// The address is masked to bullets — the raw invited e-mail is never echoed.
			expect(html).toContain("•••");
			expect(html).not.toContain(luciaEmail);
		},
		TEST_TIMEOUT,
	);

	it(
		"the public invite entry is reachable without a session",
		async () => {
			const { server } = await boot();
			// The public entry accepts the raw token in the path; SSR renders the
			// continuation shell (the token exchange itself is a browser step).
			const response = await fetch(
				`${server.baseUrl}/invite/harness-invite-token-${"x".repeat(40)}`,
			);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain(screenMarker("screen-invite-continue"));
		},
		TEST_TIMEOUT,
	);

	it(
		"an invited human accepts through the continuation into exactly the invited scope",
		async () => {
			const harness = await boot();
			const invited = await inviteLucia(harness, "accept");
			// Lucia authenticates (verified) and continues her invitation: the
			// exchange adds the challenge cookie to her own jar.
			const lucia = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
				email: invited.luciaEmail,
			});
			const exchange = await lucia.fetch(`${harness.server.baseUrl}/api/invitations/exchange`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token: invited.deliveryToken }),
				redirect: "manual",
			});
			await exchange.arrayBuffer().catch(() => undefined);

			// The acceptance screen renders from her continued session's truth.
			const screen = await lucia.fetch(`${harness.server.baseUrl}/invitation`);
			expect(screen.status).toBe(200);
			const screenHtml = await screen.text();
			expect(screenHtml).toContain(screenMarker(stableSelectors.screenInvitationAcceptance));
			expect(screenHtml).toContain(invited.companyName);

			// The masked continuation seam reports the eligible state and the version
			// the accept command must present (the app reads it the same way).
			const eligible = await lucia.fetch(`${harness.server.baseUrl}/api/invitations/challenge`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			});
			const eligibleState = (await eligible.json()) as {
				status: string;
				companyName?: string;
				expectedVersion?: number;
			};
			expect(eligibleState.status).toBe("eligible");
			expect(eligibleState.companyName).toBe(invited.companyName);

			// Accept via the product command seam consumes the one-time continuation
			// and materializes the invited Human Actor.
			const expectedVersion = eligibleState.expectedVersion ?? 0;
			const idempotencyKey = `accept-lucia-${harness.runId}`;
			const accepted = await lucia.client.routes.invitations.accept.post({
				idempotencyKey,
				expectedVersion,
			});
			expect(accepted.replayed).toBe(false);
			expect(typeof accepted.actorId).toBe("string");
			// The continuation is strictly single-use: a second accept cannot
			// double-spend the now-consumed challenge (server checks it before any
			// replay short-circuit), so no second Actor is ever created.
			const retry = await lucia.fetch(`${harness.server.baseUrl}/api/invitations/accept`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ idempotencyKey, expectedVersion }),
			});
			expect(retry.status).toBeGreaterThanOrEqual(400);
			await retry.arrayBuffer().catch(() => undefined);
			const humans = await invited.owner.client.collections.actors.find({
				where: { company: invited.companyId, kind: "human" },
			});
			// Exactly the owner and the single Lucia — no duplicate Actor exists.
			expect(humans.docs).toHaveLength(2);

			// No widening: Lucia sees only the Whole Company scope she was invited into.
			const luciaSpaces = await lucia.client.collections.spaces.find({});
			expect(luciaSpaces.docs).toHaveLength(1);
			expect(luciaSpaces.docs[0]?.slug).toBe("whole-company");

			// The consumed continuation surfaces the terminal already-used state.
			const terminal = await lucia.fetch(`${harness.server.baseUrl}/api/invitations/challenge`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			});
			expect(terminal.status).toBe(200);
			expect(((await terminal.json()) as { status: string }).status).toBe("already-used");
		},
		TEST_TIMEOUT,
	);

	it(
		"F01 UC-P0-001 bootstrap-human-only-company",
		async () => {
			const harness = await boot();
			const base = harness.server.baseUrl;

			// Anonymous entry: the sign-in surface is served.
			const anonSignIn = await fetch(`${base}/sign-in`);
			expect(anonSignIn.status).toBe(200);
			expect(await anonSignIn.text()).toContain(screenMarker(stableSelectors.screenSignIn));

			// Marek authenticates via the documented harness seam.
			const marek = await createAuthenticatedSession({
				baseUrl: base,
				db: harness.db,
				runId: harness.runId,
				email: `marek-${harness.runId}@harness.invalid`,
			});

			// Authed root resolves to the company onboarding step.
			const authedRoot = await marek.fetch(`${base}/`, { redirect: "manual" });
			expectRedirectTo(authedRoot, "/onboarding/company");
			await authedRoot.arrayBuffer();
			const companyStep = await marek.fetch(`${base}/onboarding/company`);
			expect(companyStep.status).toBe(200);
			expect(await companyStep.text()).toContain(screenMarker(stableSelectors.screenCompanySetup));

			// Bootstrap Hreben exactly once; the same idempotencyKey replays the receipt.
			const idempotencyKey = `f01-bootstrap-${harness.runId}`;
			const receipt = await marek.client.routes.companies.bootstrap.post({
				idempotencyKey,
				name: "Hreben",
			});
			expect(receipt.replayed).toBe(false);
			if (receipt.replayed) throw new Error("bootstrap replayed on first submission");
			const replay = await marek.client.routes.companies.bootstrap.post({
				idempotencyKey,
				name: "Hreben",
			});
			expect(replay.replayed).toBe(true);
			expect(replay.companyId).toBe(receipt.companyId);
			const visible = await marek.client.collections.companies.find({});
			expect(visible.docs).toHaveLength(1);
			expect(visible.docs[0]?.name).toBe("Hreben");
			const companySlug = visible.docs[0]?.slug ?? "";
			expect(companySlug.length).toBeGreaterThan(0);

			// Resume-forward: the completed company step now redirects to team.
			const companyAgain = await marek.fetch(`${base}/onboarding/company`, {
				redirect: "manual",
			});
			expectRedirectTo(companyAgain, "/onboarding/team");
			await companyAgain.arrayBuffer();

			// Team roster truth: Marek plus the dormant Autopilot, no fake agent activity.
			const teamStep = await marek.fetch(`${base}/onboarding/team`);
			expect(teamStep.status).toBe(200);
			const teamHtml = await teamStep.text();
			expect(teamHtml).toContain(screenMarker(stableSelectors.screenTeamSetup));
			expect(teamHtml).toContain("Autopilot");
			expect(teamHtml).toContain("Vyžaduje nastavenie");

			// Marek invites Lucia from the team step; the issuer sees the delivery token.
			const invitation = await marek.client.routes.invitations.issue.post({
				idempotencyKey: `f01-invite-lucia-${harness.runId}`,
				companyId: receipt.companyId,
				email: `lucia-${harness.runId}@harness.invalid`,
				bindings: [{ roleSystemKey: "member", scopeType: "company" }],
			});
			expect(typeof invitation.invitationId).toBe("string");
			expect(invitation.replayed).toBe(false);

			// AI gate renders; Marek proceeds WITHOUT configuring any provider. The
			// harness shares one database across facets, so the absence oracle measures
			// a delta around the gate rather than an absolute count.
			const receiptsBeforeGate = await harness.db.exec(
				"SELECT count(*)::int AS count FROM command_receipts",
			);
			const aiStep = await marek.fetch(`${base}/onboarding/ai`);
			expect(aiStep.status).toBe(200);
			expect(await aiStep.text()).toContain(screenMarker(stableSelectors.screenAiSetup));

			// Absence oracle: Autopilot stays dormant; no provider secret exists;
			// reaching the gate and skipping writes nothing beyond the bootstrap and the
			// invitation this journey already made.
			const autopilot = await marek.client.collections.actors.findOne({
				where: { id: receipt.autopilotActorId },
			});
			expect(autopilot?.setupStatus).toBe("pending_setup");
			expect(autopilot?.membershipStatus).toBe("invited");
			const receiptsAfterGate = await harness.db.exec(
				"SELECT count(*)::int AS count FROM command_receipts",
			);
			expect(receiptsAfterGate.rows[0]?.count).toBe(receiptsBeforeGate.rows[0]?.count);

			// Work step completes into the adaptive shell with the persisted name.
			const workStep = await marek.fetch(`${base}/onboarding/work`);
			expect(workStep.status).toBe(200);
			expect(await workStep.text()).toContain(screenMarker(stableSelectors.screenWorkSetup));
			const home = await marek.fetch(`${base}/app/${companySlug}/home`);
			expect(home.status).toBe(200);
			const homeHtml = await home.text();
			expect(homeHtml).toContain(screenMarker(stableSelectors.screenCompanyHome));
			expect(homeHtml).toContain("Hreben");
		},
		TEST_TIMEOUT,
	);
});
