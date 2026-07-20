import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = join(import.meta.dir, "..", "..");
const scenarioHarnessDir = join(appRoot, "tests", "scenario-harness");
const realHarnessDir = join(appRoot, "tests", "scenarios", "harness", "real");

const listTsFiles = (dir: string): string[] => {
	if (!existsSync(dir)) return [];
	return Array.from(new Bun.Glob("**/*.ts").scanSync({ cwd: dir })).map((rel) => join(dir, rel));
};

const harnessSources = () => [...listTsFiles(scenarioHarnessDir), ...listTsFiles(realHarnessDir)];

describe("scenario-harness wiring guards", () => {
	it("guard (a): tests/scenario-harness contains at least one *.test.ts file", () => {
		const testFiles = listTsFiles(scenarioHarnessDir).filter((f) => f.endsWith(".test.ts"));
		expect(testFiles.length).toBeGreaterThanOrEqual(1);
	});

	it("guard (b): no .skip/.todo/skipIf/todoIf/.only/.if tokens in harness sources", () => {
		const forbidden = /\.(skip|todo|only)\b|\bskipIf\b|\btodoIf\b|\b(?:test|it|describe)\.if\s*\(/;
		for (const file of harnessSources()) {
			const violates = forbidden.test(readFileSync(file, "utf8"));
			expect({ file, violates }).toEqual({ file, violates: false });
		}
	});

	it("guard (c): only real/drain-queue.entry.ts may import #questpie or .generated", () => {
		const allowed = join(realHarnessDir, "drain-queue.entry.ts");
		for (const file of harnessSources()) {
			if (file === allowed) continue;
			const source = readFileSync(file, "utf8");
			const violates =
				source.includes("#questpie") || source.includes("src/questpie/server/.generated");
			expect({ file, violates }).toEqual({ file, violates: false });
		}
	});

	it("guard (d): default test script keeps both path-ignore patterns", () => {
		const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts.test).toContain("--path-ignore-patterns='tests/scenario-harness/**'");
		expect(pkg.scripts.test).toContain(
			"--path-ignore-patterns='tests/scenarios/phase-0/organization-db.test.ts'",
		);
		expect(pkg.scripts["test:scenario-harness"]).toContain("tests/scenario-harness");
	});

	it("guard (e): every child-spawn site is allowlist-built, no process.env spread", () => {
		const spawnSites = [
			join(realHarnessDir, "server-process.ts"),
			join(realHarnessDir, "disposable-db.ts"),
			join(scenarioHarnessDir, "organization-db-contract.test.ts"),
			join(scenarioHarnessDir, "qprobe-replay.test.ts"),
		];
		for (const file of spawnSites) {
			expect({ file, exists: existsSync(file) }).toEqual({ file, exists: true });
			const source = readFileSync(file, "utf8");
			expect(source).toMatch(/env:\s*\{/);
			expect(source).not.toContain("...process.env");
		}
	});

	it("guard (f): test:phase-0 keeps the organization-db path-ignore pattern", () => {
		const pkg = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8")) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts["test:phase-0"]).toContain(
			"--path-ignore-patterns='tests/scenarios/phase-0/organization-db.test.ts'",
		);
	});

	it("guard (g): the excluded organization-db contract keeps an executing wrapper", () => {
		const wrapper = join(scenarioHarnessDir, "organization-db-contract.test.ts");
		expect(existsSync(wrapper)).toBe(true);
		expect(readFileSync(wrapper, "utf8")).toContain("organization-db.test.ts");
	});
});
