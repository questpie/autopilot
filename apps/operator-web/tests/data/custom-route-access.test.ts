import { describe, expect, test } from "bun:test";

const EXPLICIT_PUBLIC_ROUTES = new Set([
	"src/questpie/server/routes/invitations/challenge.ts",
	"src/questpie/server/routes/invitations/exchange.ts",
]);

describe("custom QUESTPIE route access", () => {
	test("classifies every route as protected or intentionally public", async () => {
		const routeFiles = [
			...new Bun.Glob("src/questpie/server/routes/**/*.ts").scanSync({
				cwd: process.cwd(),
			}),
		].sort();

		expect(routeFiles.length).toBeGreaterThan(0);

		for (const routeFile of routeFiles) {
			const source = await Bun.file(routeFile).text();
			const compactSource = source.replace(/\s+/g, " ");

			expect(compactSource, `${routeFile} must declare route-level access`).toContain(".access(");
			if (EXPLICIT_PUBLIC_ROUTES.has(routeFile)) {
				expect(compactSource, `${routeFile} is the reviewed public allowlist`).toContain(
					".access(true)",
				);
			} else {
				expect(compactSource, `${routeFile} must reject anonymous requests`).toContain(
					".access(({ session }) => !!session)",
				);
				expect(compactSource).not.toContain(".access(true)");
			}
		}
	});
});
