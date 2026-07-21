import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { StatePanel } from "@questpie/ui";

import { CreateSpaceDialog } from "@/components/screens/create-space-dialog";
import { SpaceDirectory } from "@/components/screens/space-directory";
import { deriveSpaceDirectory, type SpacesSnapshot } from "@/lib/data/feature-queries";
import { isSurfaceDenied } from "@/lib/data/surface-denied";

export const Route = createFileRoute("/_authenticated/app/$companySlug/spaces/")({
	loader: async ({ context }) => {
		// LIVE directory (ADR 0022 validation surface): prefetch the PLAIN arm so SSR
		// ships a static snapshot, then the component mounts the LIVE arm on the
		// IDENTICAL key and the stream upgrades that ONE cache entry in place — no
		// frozen useLoaderData read. Surface-denied is handled exactly as the shell
		// does: a 403 / non-retryable realtime rejection returns a `denied` flag the
		// component renders gracefully, never a throw to the router error boundary;
		// every other error (incl. 401) rethrows for the guard/router to own.
		const denied = await context.queryClient
			.ensureQueryData(context.queries.spaces.visible(context.company.id))
			.then(() => false)
			.catch((error: unknown) => {
				if (isSurfaceDenied(error)) return true;
				throw error;
			});
		return { denied };
	},
	head: () => ({
		meta: [{ title: "Priestory — QUESTPIE Autopilot" }],
	}),
	component: SpaceDirectoryRoute,
});

/**
 * Route gate. The loader marks the spaces truth read denied when it 403s, so we
 * branch here BEFORE mounting the live arm — on a load-time denial we render the
 * graceful surface-denied UI and never open a stream that would only reject again.
 * The live directory is a separate component so its hooks stay unconditional.
 */
function SpaceDirectoryRoute() {
	const { denied } = Route.useLoaderData();
	if (denied) return <SpacesSurfaceDenied />;
	return <SpaceDirectoryLive />;
}

/**
 * SURFACE-DENIED: access to the spaces surface was revoked. The session stays
 * valid (ADR 0022), so we degrade only this surface, in-shell — never a hard crash.
 */
function SpacesSurfaceDenied() {
	return (
		<div data-testid="spaces-surface-denied" className="mx-auto w-full max-w-3xl px-4 py-8">
			<StatePanel
				state="access"
				title="Prístup k priestorom bol zamietnutý"
				description="Vaše oprávnenia sa medzičasom zmenili. Prihlásenie zostáva aktívne."
			/>
		</div>
	);
}

/**
 * The LIVE spaces directory. The loader seeded the plain arm; here we subscribe to
 * the live arm on the SAME key, so the hydrated static snapshot upgrades to a
 * stream in place. The PURE deriveSpaceDirectory re-runs client-side — bounded live
 * snapshots ARE truth (the shell's deriveCompanyShell pattern), so a Space created
 * in another tab/actor appears here with no invalidate, no frozen loader read.
 */
function SpaceDirectoryLive() {
	const { company, commands, queries } = Route.useRouteContext();
	const navigate = Route.useNavigate();
	const [createOpen, setCreateOpen] = useState(false);

	// Live arm on the SAME key the loader seeded. `.data` stays defined across a
	// mid-stream error (it surfaces on `.error`, not thrown while data exists), so
	// the directory never blanks on a blip and can degrade deliberately below.
	const spacesQuery = useSuspenseQuery<SpacesSnapshot>(queries.spaces.visibleLive(company.id));
	const spacesDenied = isSurfaceDenied(spacesQuery.error);
	// Re-run the PURE projection over the live snapshot; refs stay stable while the
	// snapshot is unchanged, so the directory list is not needlessly recomputed.
	const spaces = useMemo(() => deriveSpaceDirectory(spacesQuery.data.docs), [spacesQuery.data]);

	// SURFACE-DENIED mid-stream: same graceful degrade as a load-time denial.
	if (spacesDenied) return <SpacesSurfaceDenied />;

	return (
		<>
			<SpaceDirectory
				spaces={spaces}
				onCreate={() => setCreateOpen(true)}
				onOpenSpace={(spaceSlug) => {
					void navigate({
						to: "/app/$companySlug/spaces/$spaceSlug",
						params: { companySlug: company.slug, spaceSlug },
					});
				}}
			/>
			{createOpen ? (
				<CreateSpaceDialog
					onClose={() => setCreateOpen(false)}
					onSubmit={async (draft) => {
						// Fire exactly ONE spaces.create route mutation; the idempotency-key
						// registry makes each retry replay-safe. The directory is LIVE, so the
						// persisted Space arrives on the stream and reconciles by identity —
						// NO invalidate + loader reload, and NO onMutate on the live list (its
						// full-snapshot replace reducer would overwrite any patch). A provisional
						// pending-row UX, if ever wanted, belongs on a SEPARATE plain/ephemeral
						// key via use-optimistic-mutation — never patched onto this live arm.
						const outcome = await commands.spaces.create(company.id, draft);
						if (outcome.status === "recoverable") return outcome;
						setCreateOpen(false);
						return { status: "created" };
					}}
				/>
			) : null}
		</>
	);
}
