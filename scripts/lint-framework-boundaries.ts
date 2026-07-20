import { join } from "node:path";

const appRoot = "apps/operator-web/src";
const appManifestPath = "apps/operator-web/package.json";
const uiRoot = "packages/ui/src";
const uiManifestPath = "packages/ui/package.json";

type BoundaryRule = {
	pattern: RegExp;
	reason: string;
};

const forbiddenDirectDependencies: BoundaryRule[] = [
	{ pattern: /^ai$/u, reason: "AI execution belongs to @questpie/ai" },
	{ pattern: /^@ai-sdk\//u, reason: "AI execution belongs to @questpie/ai" },
	{ pattern: /^@anthropic-ai\//u, reason: "provider execution belongs to @questpie/ai" },
	{ pattern: /^@openai\//u, reason: "provider execution belongs to @questpie/ai" },
	{
		pattern:
			/^(?:openai|cohere-ai|groq-sdk|ollama|langchain|llamaindex|@mistralai\/mistralai|@google\/(?:genai|generative-ai)|@aws-sdk\/client-bedrock-runtime|@huggingface\/inference|@langchain\/)/u,
		reason: "provider execution belongs to @questpie/ai",
	},
	{
		pattern: /^@modelcontextprotocol\/sdk$/u,
		reason: "MCP protocol ownership belongs to @questpie/mcp",
	},
	{
		pattern:
			/^(?:pgvector|algoliasearch|meilisearch|typesense|weaviate-client|@qdrant\/|@pinecone-database\/|@elastic\/elasticsearch)/u,
		reason: "custom search/vector infrastructure belongs to QUESTPIE",
	},
	{
		pattern: /^(?:pusher-js|socket\.io|ws|ably|centrifuge|@supabase\/realtime-js)/u,
		reason: "custom realtime transport belongs to QUESTPIE",
	},
	{
		pattern: /^(?:bullmq|agenda|inngest|@temporalio\/|@trigger\.dev\/|trigger\.dev)/u,
		reason: "queue/workflow infrastructure belongs to QUESTPIE",
	},
	{
		pattern: /^(?:dockerode|execa|isolated-vm|vm2)$/u,
		reason: "sandbox/executor infrastructure belongs to QUESTPIE",
	},
	{
		pattern: /^(?:lucia|passport(?:-|$)|supertokens-|@auth\/|auth0$)/u,
		reason: "authentication infrastructure belongs to QUESTPIE/Better Auth",
	},
];

const forbiddenImports: BoundaryRule[] = [
	{
		pattern: /^(?:node:)?(?:child_process|worker_threads)$/u,
		reason: "process execution belongs to QUESTPIE sandbox/executor",
	},
	{ pattern: /^ai$/u, reason: "AI SDK execution belongs to @questpie/ai" },
	{ pattern: /^@ai-sdk\//u, reason: "AI SDK adapters belong to @questpie/ai or @questpie/ui" },
	{ pattern: /^@anthropic-ai\//u, reason: "provider SDKs belong to @questpie/ai" },
	{
		pattern: /^@modelcontextprotocol\/sdk$/u,
		reason: "MCP protocol ownership belongs to @questpie/mcp",
	},
	{ pattern: /^@openai\//u, reason: "provider SDKs belong to @questpie/ai" },
	{ pattern: /^pgvector$/u, reason: "vector storage belongs to QUESTPIE SearchAdapter" },
	{ pattern: /^pusher-js$/u, reason: "realtime transport belongs to QUESTPIE" },
	{ pattern: /^socket\.io/u, reason: "realtime transport belongs to QUESTPIE" },
	{ pattern: /^ws$/u, reason: "realtime transport belongs to QUESTPIE" },
	{ pattern: /^next-themes$/u, reason: "theme state belongs to the TanStack Start provider" },
];

const rawDatabaseImportPattern =
	/^(?:drizzle-orm|pg|postgres|@electric-sql\/pglite|better-sqlite3)$/u;

const frameworkOwnedCollectionPattern =
	/\bcollection\s*\(\s*["']((?:questpie_|wf_|ai_)[a-z0-9_-]*)["']\s*\)/gu;

const forbiddenSource: BoundaryRule[] = [
	{
		pattern: /\bfetch\s*\(/u,
		reason: "raw fetch bypasses the typed QUESTPIE client/query adapter",
	},
	{
		pattern: /\b(?:queryKey|mutationKey)\s*:/u,
		reason: "handwritten query keys bypass @questpie/tanstack-query",
	},
	{
		pattern: /\bBun\.spawn(?:Sync)?\s*\(/u,
		reason: "direct Bun process execution bypasses QUESTPIE sandbox/executor",
	},
	{
		pattern: /\bnew\s+Deno\.Command\s*\(/u,
		reason: "direct Deno process execution bypasses QUESTPIE sandbox/executor",
	},
	{ pattern: /\bnew\s+WebSocket\s*\(/u, reason: "app-owned WebSocket transport" },
	{ pattern: /\bnew\s+EventSource\s*\(/u, reason: "app-owned SSE transport" },
	{ pattern: /\bquestpie_search\b/u, reason: "direct access to the framework search index" },
	{ pattern: /<=>/u, reason: "raw pgvector ranking operator" },
	{ pattern: /\bcreateAuth\s*\(/u, reason: "parallel Better Auth server" },
];

type PackageManifest = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};

export interface FrameworkBoundaryAuditOptions {
	root?: string;
}

export async function auditFrameworkBoundaries({
	root = process.cwd(),
}: FrameworkBoundaryAuditOptions = {}): Promise<string[]> {
	const manifest = (await Bun.file(join(root, appManifestPath)).json()) as PackageManifest;
	const dependencyNames = Object.keys({
		...manifest.dependencies,
		...manifest.devDependencies,
	});
	const violations: string[] = [];

	for (const dependency of dependencyNames) {
		const rule = forbiddenDirectDependencies.find(({ pattern }) => pattern.test(dependency));
		if (rule) violations.push(`${appManifestPath}: ${rule.reason} (${dependency})`);
	}

	const importPattern = /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/gu;
	const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx}");

	for await (const relativePath of glob.scan({ cwd: join(root, appRoot) })) {
		if (relativePath.startsWith("questpie/server/.generated/")) continue;
		if (relativePath.startsWith("questpie/server/migrations/")) continue;

		const path = `${appRoot}/${relativePath}`;
		const source = await Bun.file(join(root, path)).text();
		const frameworkOwnedCollections = [...source.matchAll(frameworkOwnedCollectionPattern)];
		for (const match of frameworkOwnedCollections) {
			const collectionName = match[1];
			if (!collectionName) continue;
			violations.push(
				`${path}: app-local collection ${collectionName} uses a QUESTPIE-owned infrastructure namespace`,
			);
		}
		const sourceWithoutOwnedCollectionDeclarations = source.replace(
			frameworkOwnedCollectionPattern,
			"",
		);

		if (
			relativePath.startsWith("questpie/server/routes/") &&
			/\broute\s*\(/u.test(source) &&
			!/\.access\s*\(/u.test(source)
		) {
			violations.push(`${path}: custom QUESTPIE routes must declare .access(...) explicitly`);
		}

		for (const match of source.matchAll(importPattern)) {
			const specifier = match[1];
			if (!specifier) continue;
			if (rawDatabaseImportPattern.test(specifier)) {
				violations.push(
					`${path}: direct database access bypasses QUESTPIE collections and typed routes (${specifier})`,
				);
			}
			const rule = [...forbiddenDirectDependencies, ...forbiddenImports].find(({ pattern }) =>
				pattern.test(specifier),
			);
			if (rule) violations.push(`${path}: ${rule.reason} (${specifier})`);
		}

		if (/from\s+["']better-auth(?:\/[^"']*)?["']/u.test(source)) {
			const allowed =
				relativePath === "lib/auth-client.ts" && /from\s+["']better-auth\/react["']/u.test(source);
			if (!allowed) {
				violations.push(
					`${path}: Better Auth is consumed through QUESTPIE; only the React client adapter is app-owned`,
				);
			}
		}

		for (const rule of forbiddenSource) {
			if (rule.pattern.test(sourceWithoutOwnedCollectionDeclarations)) {
				violations.push(`${path}: ${rule.reason}`);
			}
		}
		if (relativePath !== "lib/query-client.ts" && /\bnew\s+QueryClient\s*\(/u.test(source)) {
			violations.push(`${path}: QueryClient construction is request-scoped in lib/query-client.ts`);
		}
	}

	const uiManifestFile = Bun.file(join(root, uiManifestPath));
	if (await uiManifestFile.exists()) {
		const uiManifest = (await uiManifestFile.json()) as PackageManifest;
		const uiDependencyNames = Object.keys({
			...uiManifest.dependencies,
			...uiManifest.devDependencies,
		});
		for (const dependency of uiDependencyNames) {
			if (dependency === "@ai-sdk/react") continue;
			const rule = forbiddenDirectDependencies.find(({ pattern }) => pattern.test(dependency));
			if (rule) violations.push(`${uiManifestPath}: ${rule.reason} (${dependency})`);
		}

		for await (const relativePath of glob.scan({ cwd: join(root, uiRoot) })) {
			const path = `${uiRoot}/${relativePath}`;
			const source = await Bun.file(join(root, path)).text();

			for (const match of source.matchAll(importPattern)) {
				const specifier = match[1];
				if (!specifier || specifier === "@ai-sdk/react") continue;
				if (rawDatabaseImportPattern.test(specifier)) {
					violations.push(
						`${path}: direct database access bypasses QUESTPIE collections and typed routes (${specifier})`,
					);
				}
				const rule = [...forbiddenDirectDependencies, ...forbiddenImports].find(({ pattern }) =>
					pattern.test(specifier),
				);
				if (rule) violations.push(`${path}: ${rule.reason} (${specifier})`);
				if (/^better-auth(?:\/|$)/u.test(specifier)) {
					violations.push(`${path}: authentication does not belong in the product UI package`);
				}
			}

			for (const rule of forbiddenSource) {
				if (rule.pattern.test(source)) violations.push(`${path}: ${rule.reason}`);
			}
			if (/\bnew\s+QueryClient\s*\(/u.test(source)) {
				violations.push(`${path}: QueryClient construction belongs to the operator app boundary`);
			}
		}
	}

	return violations;
}

if (import.meta.main) {
	const violations = await auditFrameworkBoundaries();
	if (violations.length > 0) {
		console.error(violations.join("\n"));
		process.exit(1);
	}

	console.info("Framework ownership boundaries are clean.");
}
