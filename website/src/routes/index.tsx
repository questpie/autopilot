import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { LandingPage } from "@/components/landing/LandingPage";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
	component: Home,
	headers: () => ({
		"Cache-Control":
			"public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
	}),
	staleTime: 60 * 60_000,
	gcTime: 2 * 60 * 60_000,
});

function Home() {
	return (
		<HomeLayout {...baseOptions()}>
			<LandingPage />
		</HomeLayout>
	);
}
