import { describe, test, expect } from "bun:test";
import { transition, canTransition, nextStates, InvalidTransitionError } from "../src/core/state.js";
import type { TaskRunState } from "../src/core/types.js";

function makeTask(state: TaskRunState["state"] = "todo"): TaskRunState {
  return { id: "T-1", state, notes: [], runs: [], retries: 0 };
}

describe("state machine", () => {
  test("todo → ready", () => {
    const result = transition(makeTask("todo"), "ready");
    expect(result.state).toBe("ready");
  });

  test("ready → in_progress sets startedAt", () => {
    const result = transition(makeTask("ready"), "in_progress");
    expect(result.state).toBe("in_progress");
    expect(result.startedAt).toBeDefined();
  });

  test("in_progress → implemented", () => {
    const result = transition(makeTask("in_progress"), "implemented");
    expect(result.state).toBe("implemented");
  });

  test("full happy path", () => {
    let t = makeTask("todo");
    t = transition(t, "ready");
    t = transition(t, "in_progress");
    t = transition(t, "implemented");
    t = transition(t, "validated_primary");
    t = transition(t, "validated_secondary");
    t = transition(t, "committed");
    t = transition(t, "done");
    expect(t.state).toBe("done");
    expect(t.completedAt).toBeDefined();
  });

  test("in_progress → failed increments retries", () => {
    const result = transition(makeTask("in_progress"), "failed");
    expect(result.state).toBe("failed");
    expect(result.retries).toBe(1);
  });

  test("failed → ready (recovery)", () => {
    const result = transition(makeTask("failed"), "ready");
    expect(result.state).toBe("ready");
  });

  test("invalid transition throws", () => {
    expect(() => transition(makeTask("todo"), "done")).toThrow(
      InvalidTransitionError
    );
  });

  test("done has no next states", () => {
    expect(nextStates("done")).toEqual([]);
  });

  test("canTransition", () => {
    expect(canTransition("todo", "ready")).toBe(true);
    expect(canTransition("todo", "done")).toBe(false);
    expect(canTransition("in_progress", "failed")).toBe(true);
  });

  test("any active state can go to blocked", () => {
    for (const state of ["todo", "ready"] as const) {
      expect(canTransition(state, "blocked")).toBe(true);
    }
  });

  test("any active state can go to failed", () => {
    for (const state of [
      "in_progress",
      "implemented",
      "validated_primary",
      "validated_secondary",
    ] as const) {
      expect(canTransition(state, "failed")).toBe(true);
    }
  });
});
