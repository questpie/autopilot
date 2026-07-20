import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { CreateSpaceDialog } from "@/components/screens/create-space-dialog";
import { SpaceDirectory } from "@/components/screens/space-directory";

export const Route = createFileRoute("/_authenticated/app/$companySlug/spaces/")({
	loader: async ({ context }) => {
		const spaces = await context.queryClient.ensureQueryData(
			context.queries.spaces.directory(context.company.id),
		);
		return { spaces };
	},
	head: () => ({
		meta: [{ title: "Priestory — QUESTPIE Autopilot" }],
	}),
	component: SpaceDirectoryRoute,
});

function SpaceDirectoryRoute() {
	const { spaces } = Route.useLoaderData();
	const { company, commands, queryClient } = Route.useRouteContext();
	const navigate = Route.useNavigate();
	const router = useRouter();
	const [createOpen, setCreateOpen] = useState(false);

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
						const outcome = await commands.spaces.create(company.id, draft);
						if (outcome.status === "recoverable") return outcome;
						// The new space must appear; drop cached reads and re-run the loader.
						queryClient.removeQueries();
						setCreateOpen(false);
						await router.invalidate();
						return { status: "created" };
					}}
				/>
			) : null}
		</>
	);
}
