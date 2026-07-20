import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auditFrameworkBoundaries } from "./lint-framework-boundaries";

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
	);
});

async function createFixture(dependencies: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "autopilot-framework-boundaries-"));
	temporaryRoots.push(root);
	await mkdir(join(root, "apps/operator-web/src"), { recursive: true });
	await writeFile(
		join(root, "apps/operator-web/package.json"),
		JSON.stringify({ dependencies }),
		"utf8",
	);
	await writeFile(join(root, "apps/operator-web/src/index.ts"), "export {};\n", "utf8");
	return root;
}

describe("framework ownership boundary audit", () => {
	it("rejects app dependencies that replace QUESTPIE infrastructure", async () => {
		const root = await createFixture({
			"@qdrant/js-client-rest": "1.15.1",
			ably: "2.10.0",
			bullmq: "5.56.10",
			dockerode: "4.0.7",
			lucia: "3.2.2",
			openai: "5.10.1",
		});

		const violations = await auditFrameworkBoundaries({ root });

		expect(violations).toEqual([
			"apps/operator-web/package.json: custom search/vector infrastructure belongs to QUESTPIE (@qdrant/js-client-rest)",
			"apps/operator-web/package.json: custom realtime transport belongs to QUESTPIE (ably)",
			"apps/operator-web/package.json: queue/workflow infrastructure belongs to QUESTPIE (bullmq)",
			"apps/operator-web/package.json: sandbox/executor infrastructure belongs to QUESTPIE (dockerode)",
			"apps/operator-web/package.json: authentication infrastructure belongs to QUESTPIE/Better Auth (lucia)",
			"apps/operator-web/package.json: provider execution belongs to @questpie/ai (openai)",
		]);
	});

	it("rejects source bypasses around auth, realtime, search, and sandbox boundaries", async () => {
		const root = await createFixture({});
		await writeFile(
			join(root, "apps/operator-web/src/bypass.ts"),
			[
				'import { QdrantClient } from "@qdrant/js-client-rest";',
				'import { Queue } from "bullmq";',
				'import { spawn } from "node:child_process";',
				'import { betterAuth } from "better-auth";',
				"betterAuth({});",
				'new WebSocket("wss://example.com");',
				'const query = "SELECT * FROM questpie_search";',
				"void spawn;",
				"void query;",
			].join("\n"),
			"utf8",
		);

		const violations = await auditFrameworkBoundaries({ root });

		expect(violations).toEqual([
			"apps/operator-web/src/bypass.ts: custom search/vector infrastructure belongs to QUESTPIE (@qdrant/js-client-rest)",
			"apps/operator-web/src/bypass.ts: queue/workflow infrastructure belongs to QUESTPIE (bullmq)",
			"apps/operator-web/src/bypass.ts: process execution belongs to QUESTPIE sandbox/executor (node:child_process)",
			"apps/operator-web/src/bypass.ts: Better Auth is consumed through QUESTPIE; only the React client adapter is app-owned",
			"apps/operator-web/src/bypass.ts: app-owned WebSocket transport",
			"apps/operator-web/src/bypass.ts: direct access to the framework search index",
		]);
	});

	it("rejects direct Bun and Deno process execution from product code", async () => {
		const root = await createFixture({});
		await writeFile(
			join(root, "apps/operator-web/src/execute.ts"),
			[
				'Bun.spawn(["sh", "-c", "echo bypass"]);',
				'new Deno.Command("sh", { args: ["-c", "echo bypass"] });',
			].join("\n"),
			"utf8",
		);

		const violations = await auditFrameworkBoundaries({ root });

		expect(violations).toEqual([
			"apps/operator-web/src/execute.ts: direct Bun process execution bypasses QUESTPIE sandbox/executor",
			"apps/operator-web/src/execute.ts: direct Deno process execution bypasses QUESTPIE sandbox/executor",
		]);
	});

	it("rejects raw database escapes from product code", async () => {
		const root = await createFixture({});
		await writeFile(
			join(root, "apps/operator-web/src/raw-db.ts"),
			'import { sql } from "drizzle-orm";\nvoid sql;\n',
			"utf8",
		);

		const violations = await auditFrameworkBoundaries({ root });

		expect(violations).toEqual([
			"apps/operator-web/src/raw-db.ts: direct database access bypasses QUESTPIE collections and typed routes (drizzle-orm)",
		]);
	});

	it("rejects app-local collection definitions for framework-owned infrastructure", async () => {
		const root = await createFixture({});
		await writeFile(
			join(root, "apps/operator-web/src/infrastructure-collections.ts"),
			[
				'import { collection } from "#questpie/factories";',
				'export const search = collection("questpie_search");',
				'export const workflow = collection("wf_instance");',
				'export const run = collection("ai_runs");',
			].join("\n"),
			"utf8",
		);

		expect(await auditFrameworkBoundaries({ root })).toEqual([
			"apps/operator-web/src/infrastructure-collections.ts: app-local collection questpie_search uses a QUESTPIE-owned infrastructure namespace",
			"apps/operator-web/src/infrastructure-collections.ts: app-local collection wf_instance uses a QUESTPIE-owned infrastructure namespace",
			"apps/operator-web/src/infrastructure-collections.ts: app-local collection ai_runs uses a QUESTPIE-owned infrastructure namespace",
		]);
	});

	it("rejects custom QUESTPIE routes that omit an explicit access rule", async () => {
		const root = await createFixture({});
		const routeDirectory = join(root, "apps/operator-web/src/questpie/server/routes/reports");
		await mkdir(routeDirectory, { recursive: true });
		await writeFile(
			join(routeDirectory, "open.ts"),
			[
				'import { route } from "questpie";',
				"export default route().get().handler(async () => ({ ok: true }));",
			].join("\n"),
			"utf8",
		);

		expect(await auditFrameworkBoundaries({ root })).toEqual([
			"apps/operator-web/src/questpie/server/routes/reports/open.ts: custom QUESTPIE routes must declare .access(...) explicitly",
		]);
	});

	it("allows the canonical QUESTPIE packages and thin Better Auth React client", async () => {
		const root = await createFixture({
			"@questpie/ai": "3.16.0",
			"@questpie/mcp": "3.16.0",
			"@questpie/tanstack-query": "3.16.0",
			"@questpie/workflows": "3.16.0",
			"better-auth": "1.6.23",
			questpie: "3.16.0",
		});
		await mkdir(join(root, "apps/operator-web/src/lib"), { recursive: true });
		await writeFile(
			join(root, "apps/operator-web/src/lib/auth-client.ts"),
			'import { createAuthClient } from "better-auth/react";\nvoid createAuthClient;\n',
			"utf8",
		);

		expect(await auditFrameworkBoundaries({ root })).toEqual([]);
	});

	it("protects the UI package from provider and execution ownership", async () => {
		const root = await createFixture({});
		await mkdir(join(root, "packages/ui/src"), { recursive: true });
		await writeFile(
			join(root, "packages/ui/package.json"),
			JSON.stringify({ dependencies: { openai: "5.10.1" } }),
			"utf8",
		);
		await writeFile(
			join(root, "packages/ui/src/execution.ts"),
			'import { generateText } from "ai";\nvoid generateText;\n',
			"utf8",
		);

		expect(await auditFrameworkBoundaries({ root })).toEqual([
			"packages/ui/package.json: provider execution belongs to @questpie/ai (openai)",
			"packages/ui/src/execution.ts: AI execution belongs to @questpie/ai (ai)",
		]);
	});

	it("rejects handwritten data transport and query cache protocols", async () => {
		const root = await createFixture({});
		await writeFile(
			join(root, "apps/operator-web/src/data-bypass.ts"),
			[
				'import { QueryClient } from "@tanstack/react-query";',
				'void fetch("/api/companies");',
				'const options = { queryKey: ["companies"] };',
				"const client = new QueryClient();",
				"void options;",
				"void client;",
			].join("\n"),
			"utf8",
		);

		expect(await auditFrameworkBoundaries({ root })).toEqual([
			"apps/operator-web/src/data-bypass.ts: raw fetch bypasses the typed QUESTPIE client/query adapter",
			"apps/operator-web/src/data-bypass.ts: handwritten query keys bypass @questpie/tanstack-query",
			"apps/operator-web/src/data-bypass.ts: QueryClient construction is request-scoped in lib/query-client.ts",
		]);
	});
});
