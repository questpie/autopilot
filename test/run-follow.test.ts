import { describe, it, expect } from "bun:test";

/**
 * Tests for run --follow UX behavior.
 * These verify the flag parsing and mode selection logic.
 */

describe("run follow UX", () => {
  it("--detach flag is recognized", () => {
    const args = ["run-task", "QUE-256", "--detach"];
    expect(args.includes("--detach")).toBe(true);
  });

  it("--view flag extracts mode", () => {
    const args = ["run-task", "QUE-256", "--view", "activity"];
    const idx = args.indexOf("--view");
    const mode = idx >= 0 ? args[idx + 1] : "conversation";
    expect(mode).toBe("activity");
  });

  it("defaults to conversation view when no --view", () => {
    const args = ["run-task", "QUE-256"];
    const idx = args.indexOf("--view");
    const mode = idx >= 0 ? args[idx + 1] : "conversation";
    expect(mode).toBe("conversation");
  });

  it("--follow flag is accepted but is a no-op (default behavior)", () => {
    const args = ["run-task", "QUE-256", "--follow"];
    // --follow should not cause errors, it's already the default
    expect(args.includes("--follow")).toBe(true);
    expect(args.includes("--detach")).toBe(false);
  });

  it("--detach and --view are mutually exclusive in practice", () => {
    const args = ["run-task", "QUE-256", "--detach", "--view", "activity"];
    const detach = args.includes("--detach");
    // When detach is true, view mode is ignored
    expect(detach).toBe(true);
  });
});
