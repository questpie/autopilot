import { createFileRoute } from "@tanstack/react-router";

import { NeedsYou } from "@/components/screens/needs-you";

export const Route = createFileRoute("/_authenticated/app/$companySlug/needs-you")({
	head: () => ({
		meta: [{ title: "Potrebuje ťa — QUESTPIE Autopilot" }],
	}),
	component: NeedsYou,
});
