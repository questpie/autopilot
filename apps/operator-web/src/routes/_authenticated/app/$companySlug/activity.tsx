import { createFileRoute } from "@tanstack/react-router";

import { ActivityFeed } from "@/components/screens/activity-feed";

export const Route = createFileRoute("/_authenticated/app/$companySlug/activity")({
	loader: async ({ context }) => {
		const rows = await context.queryClient.ensureQueryData(
			context.queries.activity.feed(context.company.id),
		);
		return { rows };
	},
	head: () => ({
		meta: [{ title: "Aktivita — QUESTPIE Autopilot" }],
	}),
	component: ActivityRoute,
});

function ActivityRoute() {
	const { rows } = Route.useLoaderData();
	return <ActivityFeed rows={rows} />;
}
