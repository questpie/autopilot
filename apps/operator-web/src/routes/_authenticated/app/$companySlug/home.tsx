import { createFileRoute } from "@tanstack/react-router";

import { CompanyHome } from "@/components/screens/company-home";

export const Route = createFileRoute("/_authenticated/app/$companySlug/home")({
	head: () => ({
		meta: [{ title: "Domov — QUESTPIE Autopilot" }],
	}),
	component: CompanyHomeRoute,
});

function CompanyHomeRoute() {
	// The company projection is resolved once by the shell layout's beforeLoad.
	const { company } = Route.useRouteContext();
	return <CompanyHome companyName={company.name} />;
}
