import { describe, expect, it } from "bun:test";

import mcp from "../src/questpie/server/config/mcp";

describe("MCP exposure policy", () => {
	it("stays fail-closed until named Autopilot tools receive an explicit workload policy", () => {
		expect(mcp.crud?.defaults).toEqual({
			collections: { read: false, write: false, delete: false },
			globals: { read: false, write: false },
		});
		expect(mcp.crud?.collections).toEqual({});
		expect(mcp.crud?.globals).toEqual({});
		expect(mcp.routes).toEqual({ exposeAnnotated: false, routes: {} });
		expect(mcp.resources).toEqual({ schemas: false, routes: false });
		expect(mcp.http?.accessMode).toBe("user");
		expect(mcp.stdio?.accessMode).toBe("user");
	});
});
