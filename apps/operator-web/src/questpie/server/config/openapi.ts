import { openApiConfig } from "@questpie/openapi";

export default openApiConfig({
	info: {
		title: "operator-web API",
		version: "1.0.0",
		description: "QUESTPIE API",
	},
	scalar: { theme: "purple" },
});
