import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo } from "react";

import { StatePanel } from "@questpie/ui";

import { ChannelDirectory } from "@/components/screens/channel-directory";
import { SpaceOverview } from "@/components/screens/space-directory";
import {
	type ChannelsSnapshot,
	deriveChannelDirectory,
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
		// LIVE channel directory (mirrors spaces.index): prefetch the PLAIN channels
		// arm so SSR ships a static snapshot, then the component mounts the LIVE arm on
		// the IDENTICAL key and the stream upgrades that ONE cache entry in place — no
		// frozen loader read. Channels are SPACE-SCOPED, so this reads the channels of
		// THIS space. Surface-denied is handled exactly as spaces.index does: a 403 /
		// non-retryable realtime rejection returns a `denied` flag the component renders
		// gracefully, never a throw to the router error boundary; every other error
		// (incl. 401) rethrows for the guard/router to own.
		const channelsDenied = await context.queryClient
			.ensureQueryData(context.queries.channels.visible(space.id))
			.then(() => false)
			.catch((error: unknown) => {
				if (isSurfaceDenied(error)) return true;
				throw error;
			});
		return { space, channelsDenied };
	},
	head: () => ({
		meta: [{ title: "Priestor — QUESTPIE Autopilot" }],
	}),
	component: SpaceOverviewRoute,
});

/**
 * Route gate. The loader marks the channels truth read denied when it 403s, so we
 * branch here BEFORE mounting the live arm — on a load-time denial we render the
 * graceful surface-denied UI and never open a stream that would only reject again.
 * The live channel directory is a separate component so its hooks stay unconditional.
 */
function SpaceOverviewRoute() {
	const { space, channelsDenied } = Route.useLoaderData();
	return (
		<SpaceOverview space={space}>
			{channelsDenied ? <ChannelsSurfaceDenied /> : <SpaceChannelsLive space={space} />}
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
