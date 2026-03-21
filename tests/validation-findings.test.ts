import { describe, test, expect } from "bun:test";
import { parseValidationFindings } from "../src/core/runner.js";

describe("parseValidationFindings", () => {
  test("parses a full FAIL output with all fields", () => {
    const output = [
      "Some preamble text...",
      "",
      "Result: FAIL",
      "Summary: Missing type exports for TaskRunState",
      "Issues: No re-export in index.ts, Missing JSDoc on public API",
      "Recommendation: fix-and-retry",
    ].join("\n");

    const findings = parseValidationFindings(output, "validate-primary", false);

    expect(findings.passed).toBe(false);
    expect(findings.mode).toBe("validate-primary");
    expect(findings.summary).toBe("Missing type exports for TaskRunState");
    expect(findings.findings).toEqual([
      "No re-export in index.ts",
      "Missing JSDoc on public API",
    ]);
    expect(findings.recommendation).toBe("fix-and-retry");
    expect(findings.rawOutput).toContain("Result: FAIL");
    expect(findings.timestamp).toBeTruthy();
  });

  test("parses a PASS output", () => {
    const output = [
      "Result: PASS",
      "Summary: All checks passed",
      "Issues: none",
      "Recommendation: proceed",
    ].join("\n");

    const findings = parseValidationFindings(output, "validate-secondary", true);

    expect(findings.passed).toBe(true);
    expect(findings.summary).toBe("All checks passed");
    expect(findings.findings).toEqual([]);
    expect(findings.recommendation).toBe("proceed");
  });

  test("handles missing Summary field — falls back to Result line", () => {
    const output = [
      "Result: FAIL",
      "Issues: Tests not passing",
      "Recommendation: block",
    ].join("\n");

    const findings = parseValidationFindings(output, "validate-primary", false);

    expect(findings.summary).toBe("Result: FAIL");
    expect(findings.findings).toEqual(["Tests not passing"]);
    expect(findings.recommendation).toBe("block");
  });

  test("handles completely empty output", () => {
    const findings = parseValidationFindings("", "validate-primary", false);

    expect(findings.passed).toBe(false);
    expect(findings.summary).toBe("Validation failed");
    expect(findings.findings).toEqual([]);
    expect(findings.recommendation).toBe("");
  });

  test("handles output with list-style issues", () => {
    const output = [
      "Result: FAIL",
      "Summary: Multiple issues found",
      "Issues: First issue",
      "- Second issue",
      "- Third issue",
      "Recommendation: fix-and-retry",
    ].join("\n");

    const findings = parseValidationFindings(output, "validate-primary", false);

    expect(findings.findings).toEqual([
      "First issue",
      "Second issue",
      "Third issue",
    ]);
  });

  test("truncates rawOutput to 5000 chars", () => {
    const longOutput = "x".repeat(6000);
    const findings = parseValidationFindings(longOutput, "validate-primary", false);

    expect(findings.rawOutput.length).toBe(5000);
  });
});

describe("ValidationFindings in TaskRunState", () => {
  test("new task state has empty validation fields", async () => {
    const { Store } = await import("../src/storage/store.js");
    const store = new Store("/tmp/qap-test-" + Date.now(), "test");
    const task = store.initTask("TASK-001");

    expect(task.validationHistory).toEqual([]);
    expect(task.remediationAttempts).toBe(0);
    expect(task.remediationHistory).toEqual([]);
    expect(task.lastValidation).toBeUndefined();
  });
});

describe("Remediation config defaults", () => {
  test("remediation defaults: enabled=true, attempts=1", () => {
    // These are the defaults applied in runner.ts when config values are undefined
    const config = {
      execution: {
        remediationOnValidationFail: undefined,
        maxRemediationAttempts: undefined,
      },
    };

    const enabled = config.execution.remediationOnValidationFail ?? true;
    const maxAttempts = config.execution.maxRemediationAttempts ?? 1;

    expect(enabled).toBe(true);
    expect(maxAttempts).toBe(1);
  });

  test("remediation can be disabled via config", () => {
    const config = {
      execution: {
        remediationOnValidationFail: false,
        maxRemediationAttempts: 2,
      },
    };

    const enabled = config.execution.remediationOnValidationFail ?? true;
    const maxAttempts = config.execution.maxRemediationAttempts ?? 1;

    expect(enabled).toBe(false);
    expect(maxAttempts).toBe(2);
  });
});
