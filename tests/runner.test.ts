import { describe, test, expect } from "bun:test";
import { ClaudeRunner, DEFAULT_CLAUDE_CONFIG } from "../src/runners/claude.js";
import { CodexRunner, DEFAULT_CODEX_CONFIG } from "../src/runners/codex.js";

describe("ClaudeRunner", () => {
  const runner = new ClaudeRunner(DEFAULT_CLAUDE_CONFIG);

  test("builds safe args", () => {
    const args = runner.buildArgs("test prompt", "safe");
    expect(args).toContain("-p");
    expect(args).toContain("test prompt");
    expect(args).toContain("--output-format");
    expect(args).not.toContain("--dangerously-skip-permissions");
  });

  test("builds max args", () => {
    const args = runner.buildArgs("test prompt", "max");
    expect(args).toContain("--dangerously-skip-permissions");
    expect(args).toContain("--output-format");
    expect(args).toContain("--verbose");
  });

  test("builds elevated args", () => {
    const args = runner.buildArgs("test prompt", "elevated");
    expect(args).toContain("--verbose");
    expect(args).not.toContain("--dangerously-skip-permissions");
  });

  test("parses JSON output", () => {
    const output = runner.parseOutput(JSON.stringify({ result: "hello" }));
    expect(output).toBe("hello");
  });

  test("returns raw on invalid JSON", () => {
    const output = runner.parseOutput("raw text output");
    expect(output).toBe("raw text output");
  });
});

describe("CodexRunner", () => {
  const runner = new CodexRunner(DEFAULT_CODEX_CONFIG);

  test("builds safe args", () => {
    const args = runner.buildArgs("test prompt", "safe");
    expect(args).toContain("--approval-mode");
    expect(args).toContain("suggest");
  });

  test("builds max args", () => {
    const args = runner.buildArgs("test prompt", "max");
    expect(args).toContain("--full-auto");
  });

  test("parseOutput returns raw", () => {
    expect(runner.parseOutput("output")).toBe("output");
  });
});
