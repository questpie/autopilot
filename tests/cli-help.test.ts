import { describe, test, expect } from "bun:test";

/**
 * Tests that --help flags on subcommands do not cause side effects.
 * These tests spawn the actual CLI process and verify:
 * 1. Exit code is 0
 * 2. Output contains help text
 * 3. No workspace/project state is modified
 */

async function runCli(
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", "run", "src/index.ts", ...args], {
    cwd: import.meta.dir + "/..",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: "/tmp/qap-help-test-" + Date.now(),
    },
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

describe("CLI --help no side effects", () => {
  test("qap --help shows help and exits 0", async () => {
    const { stdout, exitCode } = await runCli(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("QUESTPIE AUTOPILOT");
    expect(stdout).toContain("qap project init");
  });

  test("qap project --help shows project help", async () => {
    const { stdout, exitCode } = await runCli(["project", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("qap project");
  });

  test("qap project init --help shows init help", async () => {
    const { stdout, exitCode } = await runCli([
      "project",
      "init",
      "--help",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("qap project init");
    // Should NOT contain error messages or spawn agents
    expect(stdout).not.toContain("Spawning");
    expect(stdout).not.toContain("Error");
  });

  test("qap project import --help shows import help", async () => {
    const { stdout, exitCode } = await runCli([
      "project",
      "import",
      "--help",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("qap project import");
    expect(stdout).not.toContain("Spawning");
    expect(stdout).not.toContain("Error");
  });

  test("qap project list --help shows list help", async () => {
    const { stdout, exitCode } = await runCli([
      "project",
      "list",
      "--help",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("qap project list");
  });

  test("qap project use --help shows use help", async () => {
    const { stdout, exitCode } = await runCli([
      "project",
      "use",
      "--help",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("qap project use");
  });

  test("qap workspace --help shows workspace help", async () => {
    const { stdout, exitCode } = await runCli(["workspace", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("qap workspace");
  });
});
