import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo } from "react";

import { StatePanel } from "@questpie/ui";

import { ChannelDirectory } from "@/components/screens/channel-directory";
import { ProjectDirectory } from "@/components/screens/project-directory";
import { SpaceOverview } from "@/components/screens/space-directory";
import {
	type ChannelsSnapshot,
	deriveChannelDirectory,
	deriveProjectDirectory,
	type ProjectsSnapshot,
	type SpaceSummary,
} from "@/lib/data/feature-queries";
import { isSurfaceDenied } from "@/lib/data/surface-denied";

export const Route = createFileRoute("/_authenticated/app/$companySlug/spaces/$spaceSlug")({
	loader: async ({ context, params }) => {
		const spaces = await context.queryClient.ensureQueryData(
			context.queries.spaces.directory(context.company.id),
		);
		const space = spaces.find((candidate) => candidate.slug === params.spaceSlug);
		// A slug outside the visitor's spaces answers the uniform not-found.
		if (!space) throw notFound();
		// LIVE channel + project directories (mirrors spaces.index): seed the PLAIN arms
		// so SSR ships a static snapshot, then the components mount the LIVE arms on the
		// IDENTICAL keys and the streams upgrade those ONE cache entries in place — no
		// frozen loader read. Both are SPACE-SCOPED (the channels / projects of THIS
		// space) and depend only on the already-resolved `space.id`, so they prefetch in
		// PARALLEL — one round-trip, not two. Each carries its OWN denied flag so the two
		// live sections degrade independently: a 403 / non-retryable realtime rejection
		// returns a `denied` flag the component renders gracefully, never a throw to the
		// router error boundary; every other error (incl. 401) rethrows for the
		// guard/router to own (Promise.all propagates the first such rejection).
		const [channelsDenied, projectsDenied] = await Promise.all([
			context.queryClient
				.ensureQueryData(context.queries.channels.visible(space.id))
				.then(() => false)
				.catch((error: unknown) => {
					if (isSurfaceDenied(error)) return true;
					throw error;
				}),
			context.queryClient
				.ensureQueryData(context.queries.projects.visible(space.id))
				.then(() => false)
				.catch((error: unknown) => {
					if (isSurfaceDenied(error)) return true;
					throw error;
				}),
		]);
		return { space, channelsDenied, projectsDenied };
	},
	head: () => ({
		meta: [{ title: "Priestor — QUESTPIE Autopilot" }],
	}),
	component: SpaceOverviewRoute,
});

/**
 * Route gate. The loader marks each truth read (channels, projects) denied when it
 * 403s, so we branch here BEFORE mounting each live arm — on a load-time denial we
 * render the graceful surface-denied UI and never open a stream that would only
 * reject again. Each live directory is a separate component so its hooks stay
 * unconditional. Both space-scoped directories compose under the ONE SpaceOverview.
 */
function SpaceOverviewRoute() {
	const { space, channelsDenied, projectsDenied } = Route.useLoaderData();
	return (
		<SpaceOverview space={space}>
			<div className="grid gap-10">
				{channelsDenied ? <ChannelsSurfaceDenied /> : <SpaceChannelsLive space={space} />}
				{projectsDenied ? <ProjectsSurfaceDenied /> : <SpaceProjectsLive space={space} />}
			</div>
		</SpaceOverview>
	);
}

/**
 * SURFACE-DENIED: access to this Space's channels was revoked. The session stays
 * valid (ADR 0022), so we degrade only the channel body, in-shell — the Space header
 * still renders and never a hard crash.
 */
function ChannelsSurfaceDenied() {
	return (
		<div data-testid="channels-surface-denied">
			<StatePanel
				state="access"
				title="Prístup ku kanálom bol zamietnutý"
				description="Vaše oprávnenia sa medzičasom zmenili. Prihlásenie zostáva aktívne."
			/>
		</div>
	);
}

/**
 * SURFACE-DENIED: access to this Space's projects was revoked — the projects mirror
 * of ChannelsSurfaceDenied. Degrades only the project body, in-shell; the session and
 * the rest of the Space stay intact.
 */
function ProjectsSurfaceDenied() {
	return (
		<div data-testid="projects-surface-denied">
			<StatePanel
				state="access"
				title="Prístup k projektom bol zamietnutý"
				description="Vaše oprávnenia sa medzičasom zmenili. Prihlásenie zostáva aktívne."
			/>
		</div>
	);
}

/**
 * The LIVE channel directory. The loader seeded the plain arm; here we subscribe to
 * the live arm on the SAME key, so the hydrated static snapshot upgrades to a stream
 * in place. The PURE deriveChannelDirectory re-runs client-side — bounded live
 * snapshots ARE truth (the shell's deriveCompanyShell pattern), so a channel created
 * in this Space (via inc3's channels.create route) appears here with no invalidate,
 * no frozen loader read.
 */
function SpaceChannelsLive({ space }: { space: SpaceSummary }) {
	const { queries } = Route.useRouteContext();
	// Live arm on the SAME key the loader seeded. `.data` stays defined across a
	// mid-stream error (it surfaces on `.error`, not thrown while data exists), so the
	// directory never blanks on a blip and can degrade deliberately below.
	const channelsQuery = useSuspenseQuery<ChannelsSnapshot>(queries.channels.visibleLive(space.id));
	const channelsDenied = isSurfaceDenied(channelsQuery.error);
	// Re-run the PURE projection over the live snapshot; refs stay stable while the
	// snapshot is unchanged, so the channel list is not needlessly recomputed.
	const channels = useMemo(
		() => deriveChannelDirectory(channelsQuery.data.docs),
		[channelsQuery.data],
	);

	// SURFACE-DENIED mid-stream: same graceful degrade as a load-time denial.
	if (channelsDenied) return <ChannelsSurfaceDenied />;

	return <ChannelDirectory channels={channels} />;
}

/**
 * The LIVE project directory — the exact mirror of SpaceChannelsLive. The loader
 * seeded the plain projects arm; here we subscribe to the live arm on the SAME key,
 * so the hydrated snapshot upgrades to a stream in place and the PURE
 * deriveProjectDirectory re-runs client-side. A project created in this Space (via the
 * projects.create route) is persisted and appears here off the stream — no invalidate,
 * no frozen loader read.
 */
function SpaceProjectsLive({ space }: { space: SpaceSummary }) {
	const { queries } = Route.useRouteContext();
	const projectsQuery = useSuspenseQuery<ProjectsSnapshot>(queries.projects.visibleLive(space.id));
	const projectsDenied = isSurfaceDenied(projectsQuery.error);
	const projects = useMemo(
		() => deriveProjectDirectory(projectsQuery.data.docs),
		[projectsQuery.data],
	);

	if (projectsDenied) return <ProjectsSurfaceDenied />;

	return <ProjectDirectory projects={projects} />;
}
