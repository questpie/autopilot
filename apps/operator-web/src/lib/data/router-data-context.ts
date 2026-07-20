import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { createBrowserDataContext, createRequestDataContext } from "@/lib/data/app-data-context";

export const createRouterDataContext = createIsomorphicFn()
	.server(() => createRequestDataContext(getRequest()))
	.client(() => createBrowserDataContext(window.location.origin));
