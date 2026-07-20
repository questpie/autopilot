import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

interface PackageManifest {
	version?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

interface ReleaseContract {
	source: {
		repositoryPath: string;
		branch: string;
		baselineCommit: string;
	};
	versions: {
		publishedBaseline: string;
		targetRelease: string;
	};
	localDevelopmentPackages: Record<string, string>;
	appRuntimePackages: string[];
	runtimeConsumerRoots: string[];
}

const contract = JSON.parse(
	readFileSync(resolve("questpie.release-contract.json"), "utf8"),
) as ReleaseContract;
const frameworkRoot = resolve(
	process.env.QUESTPIE_FRAMEWORK_ROOT ?? contract.source.repositoryPath,
);
const releaseGate = process.argv.includes("--release-gate");
const failures: string[] = [];
const warnings: string[] = [];
const appManifest = JSON.parse(
	readFileSync(resolve("apps/operator-web/package.json"), "utf8"),
) as PackageManifest;
const lockfile = readFileSync(resolve("bun.lock"), "utf8");

const readManifest = (path: string) => JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
const frameworkPackagesRoot = realpathSync(join(frameworkRoot, "packages"));
const isFrameworkLink = (path: string) => path.startsWith(`${frameworkPackagesRoot}/`);
const installed = new Map<string, { version: string; path: string; linked: boolean }>();

for (const consumerRoot of [".", ...contract.runtimeConsumerRoots]) {
	for (const packageName of contract.appRuntimePackages) {
		const key = `${consumerRoot}:${packageName}`;
		const packagePath = resolve(consumerRoot, "node_modules", packageName);
		if (!existsSync(packagePath)) {
			failures.push(`${key} is not installed`);
			continue;
		}

		const path = realpathSync(packagePath);
		const version = readManifest(join(path, "package.json")).version ?? "<missing>";
		installed.set(key, {
			version,
			path,
			linked: isFrameworkLink(path),
		});
	}
}

const linkedCount = [...installed.values()].filter(({ linked }) => linked).length;
const localMode = linkedCount > 0;
if (localMode && linkedCount !== installed.size) {
	failures.push("mixed released and local-linked QUESTPIE runtime packages");
}

if (localMode) {
	if (releaseGate) {
		failures.push("local-linked QUESTPIE packages are forbidden at the release gate");
	}

	for (const packageName of contract.appRuntimePackages) {
		const folder = contract.localDevelopmentPackages[packageName];
		if (!folder) {
			failures.push(`${packageName} is missing from localDevelopmentPackages`);
			continue;
		}
		const expectedPath = realpathSync(join(frameworkRoot, "packages", folder));
		for (const consumerRoot of [".", ...contract.runtimeConsumerRoots]) {
			const packagePath = resolve(consumerRoot, "node_modules", packageName);
			if (!existsSync(packagePath)) {
				failures.push(`${consumerRoot}:${packageName} local link is missing`);
				continue;
			}
			const actualPath = realpathSync(packagePath);
			if (actualPath !== expectedPath) {
				failures.push(
					`${consumerRoot}:${packageName} resolves to ${actualPath}; expected ${expectedPath}`,
				);
			}
		}
	}

	const git = (...args: string[]) =>
		execFileSync("git", args, {
			cwd: frameworkRoot,
			encoding: "utf8",
		}).trim();
	const branch = git("branch", "--show-current");
	const head = git("rev-parse", "HEAD");
	if (branch !== contract.source.branch) {
		failures.push(`source branch is ${branch || "<detached>"}; expected ${contract.source.branch}`);
	}
	try {
		git("merge-base", "--is-ancestor", contract.source.baselineCommit, "HEAD");
	} catch {
		failures.push(`source HEAD does not contain baseline ${contract.source.baselineCommit}`);
	}
	const dirty = git("status", "--porcelain=v1");
	if (dirty) {
		warnings.push(
			`source ${branch}@${head} is dirty (${dirty.split("\n").length} paths) and is development-only`,
		);
	}
	console.info(`source: ${branch}@${head}`);
} else {
	for (const [packageName, resolved] of installed) {
		const allowedVersions = releaseGate
			? [contract.versions.targetRelease]
			: [contract.versions.publishedBaseline, contract.versions.targetRelease];
		if (!allowedVersions.includes(resolved.version)) {
			failures.push(
				`${packageName} installed at ${resolved.version}; expected ${allowedVersions.join(" or ")}`,
			);
		}
	}
}

if (releaseGate) {
	const operatorWorkspaceStart = lockfile.indexOf('"apps/operator-web":');
	const nextWorkspaceStart = lockfile.indexOf('"packages/ui":', operatorWorkspaceStart);
	const operatorWorkspaceLock = lockfile.slice(operatorWorkspaceStart, nextWorkspaceStart);
	if (operatorWorkspaceStart < 0 || nextWorkspaceStart < 0) {
		failures.push("bun.lock does not contain the operator-web workspace");
	}

	for (const packageName of contract.appRuntimePackages) {
		const declared =
			appManifest.dependencies?.[packageName] ?? appManifest.devDependencies?.[packageName];
		if (declared !== contract.versions.targetRelease) {
			failures.push(
				`${packageName} app pin is ${declared ?? "<missing>"}; expected exact ${contract.versions.targetRelease}`,
			);
		}
		const lockPin = `"${packageName}": "${contract.versions.targetRelease}"`;
		if (!operatorWorkspaceLock.includes(lockPin)) {
			failures.push(
				`${packageName} operator-web lock pin is not exact ${contract.versions.targetRelease}`,
			);
		}
		const resolution = `"${packageName}": ["${packageName}@${contract.versions.targetRelease}"`;
		if (!lockfile.includes(resolution)) {
			failures.push(`${packageName} lock resolution is not ${contract.versions.targetRelease}`);
		}
	}
}

for (const [packageName, state] of installed) {
	console.info(
		`${state.linked ? "local-linked" : "released-package"}: ${packageName}@${state.version} -> ${state.path}`,
	);
}
for (const warning of warnings) console.warn(`warning: ${warning}`);

if (failures.length > 0) {
	for (const failure of failures) console.error(`error: ${failure}`);
	process.exit(1);
}

console.info(
	releaseGate
		? `release-gate: exact QUESTPIE ${contract.versions.targetRelease} package train`
		: localMode
			? `development-contract: QUESTPIE ${contract.versions.publishedBaseline} baseline`
			: "released-contract: homogeneous QUESTPIE package train",
);
