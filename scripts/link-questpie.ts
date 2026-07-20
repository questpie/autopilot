import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

interface ReleaseContract {
	source: {
		repositoryPath: string;
		branch: string;
		baselineCommit: string;
	};
	localDevelopmentPackages: Record<string, string>;
	runtimeConsumerRoots: string[];
}

const contract = JSON.parse(
	readFileSync(resolve("questpie.release-contract.json"), "utf8"),
) as ReleaseContract;
const frameworkRoot = resolve(
	process.env.QUESTPIE_FRAMEWORK_ROOT ?? contract.source.repositoryPath,
);

if (!existsSync(join(frameworkRoot, "packages", "questpie", "package.json"))) {
	throw new Error(`QUESTPIE framework repository does not exist: ${frameworkRoot}`);
}

const git = (...args: string[]) =>
	execFileSync("git", args, {
		cwd: frameworkRoot,
		encoding: "utf8",
	}).trim();
const branch = git("branch", "--show-current");
if (branch !== contract.source.branch) {
	throw new Error(
		`Refusing to link QUESTPIE branch ${branch || "<detached>"}; expected ${contract.source.branch}.`,
	);
}

try {
	git("merge-base", "--is-ancestor", contract.source.baselineCommit, "HEAD");
} catch {
	throw new Error(
		`Refusing to link source that does not contain baseline ${contract.source.baselineCommit}.`,
	);
}

const head = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain=v1");
console.info(`QUESTPIE source: ${branch}@${head}`);
if (dirty) {
	console.warn(
		`Local development source is dirty (${dirty.split("\n").length} paths); it cannot satisfy the release gate.`,
	);
}

for (const [packageName, folder] of Object.entries(contract.localDevelopmentPackages)) {
	const source = join(frameworkRoot, "packages", folder);

	if (!existsSync(join(source, "package.json"))) {
		throw new Error(`Missing local framework package: ${source}`);
	}

	for (const consumerRoot of [".", ...contract.runtimeConsumerRoots]) {
		const target = resolve(consumerRoot, "node_modules", packageName);
		mkdirSync(dirname(target), { recursive: true });
		if (existsSync(target)) rmSync(target, { recursive: true, force: true });
		symlinkSync(source, target, "dir");
		console.info(`${consumerRoot}:${packageName} -> ${realpathSync(target)}`);
	}
}
