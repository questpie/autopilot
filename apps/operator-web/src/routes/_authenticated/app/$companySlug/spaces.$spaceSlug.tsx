import { createFileRoute, notFound } from "@tanstack/react-router";

import { SpaceOverview } from "@/components/screens/space-directory";

export const Route = createFileRoute("/_authenticated/app/$companySlug/spaces/$spaceSlug")({
	loader: async ({ context, params }) => {
		const spaces = await context.queryClient.ensureQueryData(
			context.queries.spaces.directory(context.company.id),
		);
		const space = spaces.find((candidate) => candidate.slug === params.spaceSlug);
		// A slug outside the visitor's spaces answers the uniform not-found.
		if (!space) throw notFound();
		return { space };
	},
	head: () => ({
		meta: [{ title: "Priestor — QUESTPIE Autopilot" }],
	}),
	component: SpaceOverviewRoute,
});

function SpaceOverviewRoute() {
	const { space } = Route.useLoaderData();
	return <SpaceOverview space={space} />;
}
