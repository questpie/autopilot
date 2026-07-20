import type { ActorProjection, CompanyNavigationSection } from "@questpie/ui";

import {
	ActivityIcon,
	HouseIcon,
	InboxIcon,
	LayersIcon,
	SettingsIcon,
	UsersIcon,
} from "./nav-icons";

/** A space as the shell needs to name it — persisted name + slug, no invention. */
export interface NavSpace {
	slug: string;
	name: string;
	isWholeCompany: boolean;
}

/**
 * Server-truth inputs the one navigation config is derived from. Deliberately
 * excludes `online`: connectivity is a frequent, transient signal that does NOT
 * change any nav item, so it must not feed this builder — otherwise every online
 * flip mints fresh `sections`/`destinations` refs and defeats the shell's memo
 * over `sections`. The offline footer band is computed by the component from its
 * own `online` state instead (see routes/.../$companySlug.tsx footerNoticeFor).
 */
export interface CompanyNavigationProjection {
	companySlug: string;
	spaces: readonly NavSpace[];
	/** The signed-in human — the "Ja" mobile slot renders their mark. */
	self: ActorProjection;
	/** The dormant Autopilot still needs a provider — surfaced, never faked. */
	autopilotPending: boolean;
}

export const COMPANY_NAV_IDS = {
	home: "home",
	inbox: "inbox",
	activity: "activity",
	spacesDirectory: "spaces",
	team: "team",
	settingsAi: "settings-ai",
	self: "self",
} as const;

const spaceNavId = (slug: string): string => `space:${slug}`;

export interface CompanyNavigationModel {
	sections: CompanyNavigationSection[];
	/** navId -> in-company href. Only implemented destinations appear here. */
	destinations: Record<string, string>;
	/** Whether the dormant Autopilot still needs a provider — drives the footer band. */
	autopilotPending: boolean;
}

/**
 * THE one navigation config (AC-2): a single pure builder feeds the rail, the
 * drawer, and the mobile bottom nav from the same sections. Every destination
 * is an implemented F01 route — nothing points at a screen that does not exist
 * yet. Whole Company always leads the spaces band; the four mobile slots
 * (home/spaces/inbox/self) are always populated.
 */
export function buildCompanyNavigation(
	projection: CompanyNavigationProjection,
): CompanyNavigationModel {
	const base = `/app/${projection.companySlug}`;
	const orderedSpaces = [...projection.spaces].sort((a, b) => {
		if (a.isWholeCompany !== b.isWholeCompany) return a.isWholeCompany ? -1 : 1;
		return a.name.localeCompare(b.name, "sk");
	});

	const destinations: Record<string, string> = {
		[COMPANY_NAV_IDS.home]: `${base}/home`,
		[COMPANY_NAV_IDS.inbox]: `${base}/needs-you`,
		[COMPANY_NAV_IDS.activity]: `${base}/activity`,
		[COMPANY_NAV_IDS.spacesDirectory]: `${base}/spaces`,
		[COMPANY_NAV_IDS.team]: `${base}/team`,
		[COMPANY_NAV_IDS.settingsAi]: `${base}/settings/ai`,
		// "Ja" has no dedicated profile route in F01; it surfaces the signed-in
		// human where they actually live in the company — the team roster.
		[COMPANY_NAV_IDS.self]: `${base}/team`,
	};
	for (const space of orderedSpaces) {
		destinations[spaceNavId(space.slug)] = `${base}/spaces/${space.slug}`;
	}

	const sections: CompanyNavigationSection[] = [
		{
			id: "attention",
			items: [
				{
					kind: "attention",
					id: COMPANY_NAV_IDS.home,
					label: "Domov",
					icon: HouseIcon,
					mobileSlot: "home",
				},
				{
					kind: "attention",
					id: COMPANY_NAV_IDS.inbox,
					label: "Potrebuje ťa",
					mobileLabel: "Pre teba",
					icon: InboxIcon,
					mobileSlot: "inbox",
				},
				{ kind: "attention", id: COMPANY_NAV_IDS.activity, label: "Aktivita", icon: ActivityIcon },
			],
		},
		{
			id: "spaces",
			label: "Priestory",
			items: [
				...orderedSpaces.map((space) => ({
					kind: "space" as const,
					id: spaceNavId(space.slug),
					label: space.name,
				})),
				{
					kind: "space",
					id: COMPANY_NAV_IDS.spacesDirectory,
					label: "Všetky priestory",
					icon: LayersIcon,
					mobileSlot: "spaces",
				},
			],
		},
		{
			id: "resources",
			items: [
				{ kind: "resource", id: COMPANY_NAV_IDS.team, label: "Tím", icon: UsersIcon },
				{
					kind: "resource",
					id: COMPANY_NAV_IDS.settingsAi,
					label: "Nastavenia AI",
					icon: SettingsIcon,
				},
				{
					kind: "direct",
					id: COMPANY_NAV_IDS.self,
					label: "Ja",
					actor: projection.self,
					mobileSlot: "self",
				},
			],
		},
	];

	return {
		sections,
		destinations,
		autopilotPending: projection.autopilotPending,
	};
}
