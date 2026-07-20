import { describe, expect, it } from "bun:test";

import {
	buildCompanyNavigation,
	COMPANY_NAV_IDS,
	type CompanyNavigationProjection,
} from "@/lib/navigation/company-nav";

const projection = (
	overrides: Partial<CompanyNavigationProjection> = {},
): CompanyNavigationProjection => ({
	companySlug: "hreben-x1",
	// Deliberately unordered: Whole Company must still lead.
	spaces: [
		{ slug: "marketing", name: "Marketing", isWholeCompany: false },
		{ slug: "whole-company", name: "Whole Company", isWholeCompany: true },
	],
	self: { id: "actor-owner", name: "Marek", kind: "human" },
	autopilotPending: true,
	...overrides,
});

const allItems = (model: ReturnType<typeof buildCompanyNavigation>) =>
	model.sections.flatMap((section) => section.items);

describe("buildCompanyNavigation — the one config behind rail, drawer, and bottom nav", () => {
	it("carries exactly the three F01 bands in order", () => {
		const model = buildCompanyNavigation(projection());
		expect(model.sections.map((section) => section.id)).toEqual([
			"attention",
			"spaces",
			"resources",
		]);
	});

	it("names the attention band Domov / Potrebuje ťa / Aktivita", () => {
		const [attention] = buildCompanyNavigation(projection()).sections;
		expect(attention?.items.map((item) => item.id)).toEqual([
			COMPANY_NAV_IDS.home,
			COMPANY_NAV_IDS.inbox,
			COMPANY_NAV_IDS.activity,
		]);
		const inbox = attention?.items.find((item) => item.id === COMPANY_NAV_IDS.inbox);
		expect(inbox?.label).toBe("Potrebuje ťa");
		expect(inbox?.mobileLabel).toBe("Pre teba");
	});

	it("leads the spaces band with Whole Company regardless of input order", () => {
		const spaces = buildCompanyNavigation(projection()).sections.find(
			(section) => section.id === "spaces",
		);
		expect(spaces?.items[0]?.label).toBe("Whole Company");
		expect(spaces?.items[0]?.id).toBe("space:whole-company");
		// The directory link closes the band and owns the mobile "spaces" slot.
		const directory = spaces?.items.find((item) => item.id === COMPANY_NAV_IDS.spacesDirectory);
		expect(directory?.label).toBe("Všetky priestory");
		expect(directory?.mobileSlot).toBe("spaces");
	});

	it("orders created spaces after Whole Company, then alphabetically", () => {
		const model = buildCompanyNavigation(
			projection({
				spaces: [
					{ slug: "web", name: "Web", isWholeCompany: false },
					{ slug: "whole-company", name: "Whole Company", isWholeCompany: true },
					{ slug: "financie", name: "Financie", isWholeCompany: false },
				],
			}),
		);
		const spaces = model.sections.find((section) => section.id === "spaces");
		const spaceLabels = spaces?.items
			.filter((item) => item.id.startsWith("space:"))
			.map((item) => item.label);
		expect(spaceLabels).toEqual(["Whole Company", "Financie", "Web"]);
		// Every created space earns its own overview destination.
		expect(model.destinations["space:financie"]).toBe("/app/hreben-x1/spaces/financie");
		expect(model.destinations["space:web"]).toBe("/app/hreben-x1/spaces/web");
	});

	it("puts Tím, Nastavenia AI, and the self mark in the resources band", () => {
		const resources = buildCompanyNavigation(projection()).sections.find(
			(section) => section.id === "resources",
		);
		expect(resources?.items.map((item) => item.id)).toEqual([
			COMPANY_NAV_IDS.team,
			COMPANY_NAV_IDS.settingsAi,
			COMPANY_NAV_IDS.self,
		]);
		const settings = resources?.items.find((item) => item.id === COMPANY_NAV_IDS.settingsAi);
		expect(settings?.label).toBe("Nastavenia AI");
		const self = resources?.items.find((item) => item.id === COMPANY_NAV_IDS.self);
		expect(self?.kind).toBe("direct");
	});

	it("populates all four mobile slots exactly once", () => {
		const slots = allItems(buildCompanyNavigation(projection()))
			.map((item) => item.mobileSlot)
			.filter((slot): slot is NonNullable<typeof slot> => slot !== undefined);
		expect([...slots].sort()).toEqual(["home", "inbox", "self", "spaces"]);
	});

	it("routes every id to an implemented in-company destination and nowhere else", () => {
		const model = buildCompanyNavigation(projection());
		expect(model.destinations).toEqual({
			[COMPANY_NAV_IDS.home]: "/app/hreben-x1/home",
			[COMPANY_NAV_IDS.inbox]: "/app/hreben-x1/needs-you",
			[COMPANY_NAV_IDS.activity]: "/app/hreben-x1/activity",
			[COMPANY_NAV_IDS.spacesDirectory]: "/app/hreben-x1/spaces",
			[COMPANY_NAV_IDS.team]: "/app/hreben-x1/team",
			[COMPANY_NAV_IDS.settingsAi]: "/app/hreben-x1/settings/ai",
			[COMPANY_NAV_IDS.self]: "/app/hreben-x1/team",
			"space:whole-company": "/app/hreben-x1/spaces/whole-company",
			"space:marketing": "/app/hreben-x1/spaces/marketing",
		});
		// No unimplemented F01 destination ever leaks into the config.
		const paths = Object.values(model.destinations).join(" ");
		for (const unbuilt of ["goals", "tasks", "channels", "runs", "undefined"]) {
			expect(paths).not.toContain(unbuilt);
		}
	});

	// The offline notice is no longer derived here: connectivity is intentionally
	// excluded from the nav config so online flips don't churn sections/destinations
	// (the component computes the offline footer band from its own `online` state).

	it("carries the dormant-autopilot flag through untouched", () => {
		expect(buildCompanyNavigation(projection({ autopilotPending: true })).autopilotPending).toBe(
			true,
		);
		expect(buildCompanyNavigation(projection({ autopilotPending: false })).autopilotPending).toBe(
			false,
		);
	});
});
