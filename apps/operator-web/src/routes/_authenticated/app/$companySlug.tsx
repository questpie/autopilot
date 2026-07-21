import { onlineManager, useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
	redirect,
	useRouterState,
} from "@tanstack/react-router";
import { type ReactNode, useMemo, useSyncExternalStore } from "react";

import { StateBand, StatePanel } from "@questpie/ui";
import { CompanyShell } from "@questpie/ui/components/templates";

import type { AgentsSnapshot } from "@/features/actors/queries";
import { deriveCompanyShell } from "@/features/company/queries";
import type { SpacesSnapshot } from "@/features/spaces/queries";
import { isSurfaceDenied } from "@/lib/data/surface-denied";
import { buildCompanyNavigation } from "@/lib/navigation/company-nav";

export const Route = createFileRoute("/_authenticated/app/$companySlug")({
	beforeLoad: async ({ context, params }) => {
		// A slug outside the visitor's visible set is indistinguishable from one
		// that never existed — both answer the uniform not-found, so nothing leaks
		// about other tenants.
		const company = await context.queryClient.ensureQueryData(
			context.queries.company.resolve(params.companySlug),
		);
		if (!company) throw notFound();
		return { company: { id: company.id, name: company.name, slug: company.slug } };
	},
	loader: async ({ context }) => {
		const companyId = context.company.id;
		const agentsArm = context.queries.actors.agents(companyId);
		// Prefetch the PLAIN arms (SSR-safe, dehydrated). They seed the SAME cache
		// entries the component's live arms read — the framework omits the {realtime}
		// config from the key, so `spaces.visible` and `spaces.visibleLive` hash to
		// one entry. The stream then upgrades that hydrated snapshot in place: no
		// frozen loader read, so another actor/tab creating a Space updates the nav.
		//
		// Surface-denied is wired into BOTH truth-read paths, not just the live stream:
		// SPACES is the surface-critical read, so a surface-denied error (403 /
		// non-retryable) there returns a `denied` flag the component renders as
		// ShellSurfaceDenied — never a throw to the router's default error boundary.
		// AGENTS only feeds the footer band, so a denial there degrades LOCALLY: seed
		// an empty snapshot so the live arm has data and the shell renders without it
		// (rather than suspending into a stream that would only reject again). Any
		// non-surface-denied error (incl. 401) is rethrown so the router/guard handles
		// it unchanged.
		const [session, spacesDenied] = await Promise.all([
			context.queryClient.ensureQueryData(context.session()),
			context.queryClient
				.ensureQueryData(context.queries.spaces.visible(companyId))
				.then(() => false)
				.catch((error: unknown) => {
					if (isSurfaceDenied(error)) return true;
					throw error;
				}),
			context.queryClient.ensureQueryData(agentsArm).catch((error: unknown) => {
				if (!isSurfaceDenied(error)) throw error;
				context.queryClient.setQueryData(agentsArm.queryKey, {
					docs: [],
				} satisfies AgentsSnapshot);
			}),
		]);
		// The pathless guard proved a session; re-narrow for the loader closure.
		if (!session) throw redirect({ to: "/sign-in" });
		if (spacesDenied) return { company: context.company, denied: true as const };
		return {
			company: context.company,
			self: { id: session.user.id, name: session.user.name, kind: "human" as const },
			denied: false as const,
		};
	},
	component: CompanyShellLayout,
});

// Hoisted to module scope so their references are STABLE across renders. Passing
// fresh closures to useSyncExternalStore makes React re-run the subscribe effect on
// every commit (unsubscribe + re-subscribe), and this shell re-renders frequently
// (pathname selector + every live-snapshot replacement) — with a single onlineManager
// consumer that churn would tear down and re-add the window online/offline listeners
// each commit. They capture nothing but the module singleton, so hoisting is safe.
const subscribeOnline = (callback: () => void) => onlineManager.subscribe(callback);
const getOnlineSnapshot = () => onlineManager.isOnline();
// `() => true` keeps SSR and the first client render in agreement, so an offline
// first paint cannot mismatch.
const getOnlineServerSnapshot = () => true;

/**
 * Live online/offline signal from TanStack's onlineManager, via the canonical
 * external-store hook, over stable subscribe/getSnapshot references.
 */
function useOnline(): boolean {
	return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
}

/** Longest-prefix match of the current path against the one config's destinations. */
function resolveActiveNavId(pathname: string, destinations: Record<string, string>): string {
	let activeId = "home";
	let matched = -1;
	for (const [id, href] of Object.entries(destinations)) {
		if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > matched) {
			activeId = id;
			matched = href.length;
		}
	}
	return activeId;
}

/**
 * The offline / dormant-Autopilot band the shell footer surfaces honestly. Offline
 * is read from the component's own `online` state, NOT the nav model — connectivity
 * is deliberately kept out of buildCompanyNavigation so an online flip re-runs only
 * this cheap call and leaves `sections`/`destinations` referentially stable.
 */
function footerNoticeFor(online: boolean, autopilotPending: boolean): ReactNode {
	if (!online) return <StateBand tone="attention" label="Bez pripojenia — pracujeme offline" />;
	if (autopilotPending) return <StateBand tone="neutral" label="Autopilot: Vyžaduje nastavenie" />;
	return null;
}

/**
 * SURFACE-DENIED state: access to this company surface was revoked mid-session.
 * The session stays valid, so we degrade only this surface and offer the way back —
 * never a hard crash, and no leak beyond "your access here changed".
 */
function ShellSurfaceDenied({ companyName }: { companyName: string }) {
	return (
		<main
			data-testid="shell-surface-denied"
			className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6"
		>
			<StatePanel
				state="access"
				title="Prístup k tomuto priestoru bol zamietnutý"
				description={`Vaše oprávnenia pre ${companyName} sa medzičasom zmenili. Prihlásenie zostáva aktívne.`}
				action={
					<Link to="/" className="text-primary text-sm font-medium hover:underline">
						Späť na úvod
					</Link>
				}
			/>
		</main>
	);
}

/**
 * Route component. The loader marks the SPACES truth read denied when it 403s, so
 * we branch here BEFORE mounting the live arms: on a load-time denial we render the
 * graceful surface-denied UI and never open a stream that would only reject again.
 * The live shell is a separate component so its hooks stay unconditional.
 */
function CompanyShellLayout() {
	const data = Route.useLoaderData();
	if (data.denied) return <ShellSurfaceDenied companyName={data.company.name} />;
	return <CompanyShellLive company={data.company} self={data.self} />;
}

/**
 * The company layout renders the real kit CompanyShell during SSR. Its base-ui
 * Drawer is mount-gated behind hydration inside the kit, so the server never calls
 * useSyncExternalStore on the popup store — the full adaptive shell streams and the
 * interactive drawer upgrades after hydration. The single navigation config (AC-2)
 * still feeds the rail, drawer, and mobile bottom nav from one model.
 *
 * Shell nav is LIVE (owner decision): the loader seeded the plain arms, and here
 * we subscribe to the live arms on the SAME keys, so the hydrated static snapshot
 * upgrades to a stream in place. The PURE deriveCompanyShell re-runs client-side —
 * bounded live snapshots ARE truth; no new channel, no frozen loader read.
 */
function CompanyShellLive({
	company,
	self,
}: {
	company: { id: string; name: string; slug: string };
	self: { id: string; name: string; kind: "human" };
}) {
	const { queries } = Route.useRouteContext();
	const navigate = Route.useNavigate();
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const online = useOnline();

	// Live arms on the SAME keys the loader seeded. `.data` stays defined across a
	// mid-stream error (the error surfaces on `.error`, it is not thrown while data
	// exists), so the shell never blanks on a blip and can degrade deliberately.
	const spacesQuery = useSuspenseQuery<SpacesSnapshot>(queries.spaces.visibleLive(company.id));
	const agentsQuery = useSuspenseQuery<AgentsSnapshot>(queries.actors.agentsLive(company.id));

	// SPACES is the surface-critical arm — a surface-denied error there denies the
	// whole surface (below). AGENTS only feeds the footer band, so a denial there
	// degrades LOCALLY: drop the agent snapshot so autopilotPending neutralizes and
	// the band hides, while the rest of the shell (and the child route) stay mounted.
	const spacesDenied = isSurfaceDenied(spacesQuery.error);
	const agentsDenied = isSurfaceDenied(agentsQuery.error);

	// Truth = bounded live snapshots: re-run the PURE deriveCompanyShell client-side.
	// TanStack keeps `data` refs stable while snapshots are unchanged, and `online`
	// no longer feeds the nav config, so `shell` and the `model` memo stay
	// referentially stable across online flips and in-company navigations — the kit's
	// own useMemo over `sections` is not defeated; only the footer band reads `online`.
	const shell = useMemo(
		() =>
			deriveCompanyShell({
				spaces: spacesQuery.data.docs,
				agents: agentsDenied ? [] : agentsQuery.data.docs,
			}),
		[spacesQuery.data, agentsQuery.data, agentsDenied],
	);
	const model = useMemo(
		() =>
			buildCompanyNavigation({
				companySlug: company.slug,
				spaces: shell.spaces,
				self,
				autopilotPending: shell.autopilotPending,
			}),
		[company.slug, shell.spaces, self, shell.autopilotPending],
	);
	const activeId = resolveActiveNavId(pathname, model.destinations);

	// SURFACE-DENIED: revoked access to the spaces truth read degrades gracefully.
	if (spacesDenied) return <ShellSurfaceDenied companyName={company.name} />;

	return (
		<CompanyShell
			companyName={company.name}
			sections={model.sections}
			activeId={activeId}
			actor={self}
			commandLabel="Hľadať alebo vyvolať"
			footerNotice={footerNoticeFor(online, model.autopilotPending)}
			onNavigate={(id) => {
				const href = model.destinations[id];
				if (href) void navigate({ href });
			}}
			onCreate={() => {
				void navigate({ to: "/app/$companySlug/spaces", params: { companySlug: company.slug } });
			}}
		>
			<Outlet />
		</CompanyShell>
	);
}
