const commands = [
	["bun", "run", "--cwd", "packages/ui", "check-types"],
	["bun", "run", "--cwd", "packages/ui", "test"],
	[
		"bun",
		"run",
		"--cwd",
		"packages/ui",
		"test-storybook",
		"--",
		"src/object-row.stories.tsx",
		"src/object-list.stories.tsx",
		"src/work-list-parts.stories.tsx",
	],
	["bun", "run", "format:check"],
	["bun", "run", "lint"],
	["bun", "run", "check-types"],
	["bun", "run", "test"],
	// The default sweep path-ignores tests/scenario-harness; this row is what makes
	// that exclusion honest — the heavy real-server suite stays mandatory here.
	["bun", "run", "--cwd", "apps/operator-web", "test:scenario-harness"],
	["bun", "run", "storybook:test"],
] as const;

for (const command of commands) {
	console.log(`\n$ ${command.join(" ")}`);
	const child = Bun.spawn(command, {
		cwd: import.meta.dir + "/..",
		stdout: "inherit",
		stderr: "inherit",
	});
	const exitCode = await child.exited;
	if (exitCode !== 0) process.exit(exitCode);
}
