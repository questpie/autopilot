import { mcpConfig } from "@questpie/mcp";

/**
 * MCP remains registered for QUESTPIE codegen, but exposes nothing by default.
 * Phase-0 Agent work may add only named tools with explicit workload policy
 * after the bounded Agent principal is released and pinned.
 */
export default mcpConfig({
	crud: {
		defaults: {
			collections: { read: false, write: false, delete: false },
			globals: { read: false, write: false },
		},
		collections: {},
		globals: {},
	},
	routes: { exposeAnnotated: false, routes: {} },
	resources: { schemas: false, routes: false },
	http: { accessMode: "user" },
	stdio: { accessMode: "user" },
});
