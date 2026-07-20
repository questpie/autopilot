import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import type { AppDataContext } from "@/lib/data/app-data-context";
import { createRouterDataContext } from "@/lib/data/router-data-context";
import { routeTree } from "./routeTree.gen";

export function createAppRouter(data: AppDataContext) {
	const router = createRouter({
		routeTree,
		context: data,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient: data.queryClient,
	});

	return router;
}

export function getRouter() {
	return createAppRouter(createRouterDataContext());
}
