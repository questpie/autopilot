import { describe, test, expect } from "bun:test";
import { classifyAgentOutput } from "../src/reporters/linear.js";

describe("classifyAgentOutput", () => {
  // ── Success path ──────────────────────────────────────────
  test("success: agent outputs Done marker", () => {
    const result = classifyAgentOutput(
      true,
      'Done: QUE-246 → In Progress',
      undefined
    );
    expect(result.outcome).toBe("success");
    expect(result.reason).toContain("Done:");
  });

  test("success: Done marker with comment confirmation", () => {
    const result = classifyAgentOutput(
      true,
      'Done: QUE-246 → Done + comment',
      undefined
    );
    expect(result.outcome).toBe("success");
  });

  test("success: Done marker is case insensitive", () => {
    const result = classifyAgentOutput(
      true,
      'done: summary posted',
      undefined
    );
    expect(result.outcome).toBe("success");
  });

  // ── Noop path ─────────────────────────────────────────────
  test("noop: issue already in desired state", () => {
    const result = classifyAgentOutput(
      true,
      'Error: issue QUE-246 is already in "Done" state',
      undefined
    );
    expect(result.outcome).toBe("noop");
  });

  test("noop: already set keyword", () => {
    const result = classifyAgentOutput(
      true,
      'The status is already set to In Progress, no change needed.',
      undefined
    );
    expect(result.outcome).toBe("noop");
  });

  test("noop: no change", () => {
    const result = classifyAgentOutput(
      true,
      'No change required.',
      undefined
    );
    expect(result.outcome).toBe("noop");
  });

  // ── Unavailable path ──────────────────────────────────────
  test("unavailable: MCP tools not available on exit failure", () => {
    const result = classifyAgentOutput(
      false,
      '',
      'Linear MCP tools not available'
    );
    expect(result.outcome).toBe("unavailable");
  });

  test("unavailable: MCP not found", () => {
    const result = classifyAgentOutput(
      false,
      'Could not find Linear MCP server',
      undefined
    );
    expect(result.outcome).toBe("unavailable");
  });

  test("unavailable: no tools in output", () => {
    const result = classifyAgentOutput(
      true,
      'No tools available to interact with Linear',
      undefined
    );
    expect(result.outcome).toBe("unavailable");
  });

  test("unavailable: tool_not_found", () => {
    const result = classifyAgentOutput(
      false,
      'tool_not_found: linear_save_issue',
      'tool_not_found'
    );
    expect(result.outcome).toBe("unavailable");
  });

  // ── Failed path ───────────────────────────────────────────
  test("failed: agent exit non-zero without unavailability", () => {
    const result = classifyAgentOutput(
      false,
      'Something went wrong',
      'Process exited with code 1'
    );
    expect(result.outcome).toBe("failed");
    expect(result.reason).toContain("Process exited");
  });

  test("failed: explicit error in output", () => {
    const result = classifyAgentOutput(
      true,
      'Error: permission denied for issue QUE-246',
      undefined
    );
    expect(result.outcome).toBe("failed");
    expect(result.reason).toContain("Error:");
  });

  // ── Unverified path ───────────────────────────────────────
  test("unverified: exit 0 but no markers", () => {
    const result = classifyAgentOutput(
      true,
      'I updated the issue status as requested.',
      undefined
    );
    expect(result.outcome).toBe("unverified");
    expect(result.reason).toContain("no confirmed mutation marker");
  });

  test("unverified: empty output with exit 0", () => {
    const result = classifyAgentOutput(
      true,
      '',
      undefined
    );
    expect(result.outcome).toBe("unverified");
  });

  test("unverified: verbose output without Done/Error", () => {
    const result = classifyAgentOutput(
      true,
      'I have successfully completed the task. The Linear issue has been updated to reflect the current status.',
      undefined
    );
    expect(result.outcome).toBe("unverified");
  });
});

describe("LinearReporter disabled/noop paths", () => {
  // We test the extractIssueId and overall noop behavior through
  // classifyAgentOutput since LinearReporter methods now return
  // structured results rather than void.

  test("extractIssueId from issueUrl", async () => {
    const { extractIssueId } = await import("../src/reporters/linear.js");
    expect(
      extractIssueId({
        id: "task-1",
        title: "Test",
        epicId: "E1",
        kind: "implementation",
        track: "main",
        issueUrl: "https://linear.app/team/issue/QUE-246/some-title",
      })
    ).toBe("QUE-246");
  });

  test("extractIssueId from task id", async () => {
    const { extractIssueId } = await import("../src/reporters/linear.js");
    expect(
      extractIssueId({
        id: "QUE-123",
        title: "Test",
        epicId: "E1",
        kind: "implementation",
        track: "main",
      })
    ).toBe("QUE-123");
  });

  test("extractIssueId returns null for non-Linear id", async () => {
    const { extractIssueId } = await import("../src/reporters/linear.js");
    expect(
      extractIssueId({
        id: "task-1",
        title: "Test",
        epicId: "E1",
        kind: "implementation",
        track: "main",
      })
    ).toBeNull();
  });
});

describe("TrackerSyncResult type shape", () => {
  test("syncResult has expected fields", () => {
    const result = classifyAgentOutput(true, "Done: QUE-1 → Done", undefined);
    expect(result).toHaveProperty("outcome");
    expect(result).toHaveProperty("reason");
    expect(["success", "noop", "unavailable", "failed", "unverified"]).toContain(
      result.outcome
    );
  });
});
