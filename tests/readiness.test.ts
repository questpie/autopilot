import { describe, test, expect } from "bun:test";
import {
  checkReadiness,
  findReadyTasks,
  findNextTask,
  whatUnblocks,
  deriveEpicState,
} from "../src/core/readiness.js";
import type { TaskConfig, TaskRunState, EpicConfig } from "../src/core/types.js";

function task(
  id: string,
  deps: string[] = [],
  track: TaskConfig["track"] = "main"
): TaskConfig {
  return {
    id,
    title: id,
    epicId: "E-1",
    kind: "implementation",
    track,
    dependsOn: deps,
  };
}

function state(id: string, s: TaskRunState["state"] = "todo"): TaskRunState {
  return { id, state: s, notes: [], runs: [], retries: 0 };
}

describe("readiness", () => {
  test("task with no deps is ready", () => {
    const t = task("A");
    const result = checkReadiness(t, [t], { A: state("A") });
    expect(result.ready).toBe(true);
    expect(result.unmetDeps).toEqual([]);
  });

  test("task with unmet dep is not ready", () => {
    const tasks = [task("A"), task("B", ["A"])];
    const states = { A: state("A", "todo"), B: state("B") };
    const result = checkReadiness(tasks[1]!, tasks, states);
    expect(result.ready).toBe(false);
    expect(result.unmetDeps).toEqual(["A"]);
  });

  test("task with done dep is ready", () => {
    const tasks = [task("A"), task("B", ["A"])];
    const states = { A: state("A", "done"), B: state("B") };
    const result = checkReadiness(tasks[1]!, tasks, states);
    expect(result.ready).toBe(true);
  });

  test("gate dep requires terminal state", () => {
    const tasks = [task("A", [], "gate"), task("B", ["A"])];
    // validated_primary is not terminal for gate
    const states = {
      A: state("A", "validated_primary"),
      B: state("B"),
    };
    const result = checkReadiness(tasks[1]!, tasks, states);
    expect(result.ready).toBe(false);
  });

  test("gate dep committed is terminal", () => {
    const tasks = [task("A", [], "gate"), task("B", ["A"])];
    const states = { A: state("A", "committed"), B: state("B") };
    const result = checkReadiness(tasks[1]!, tasks, states);
    expect(result.ready).toBe(true);
  });

  test("findReadyTasks returns todo tasks with met deps", () => {
    const tasks = [task("A"), task("B", ["A"]), task("C")];
    const states = {
      A: state("A", "todo"),
      B: state("B", "todo"),
      C: state("C", "todo"),
    };
    const ready = findReadyTasks(tasks, states);
    expect(ready.map((t) => t.id)).toEqual(["A", "C"]);
  });

  test("findReadyTasks prioritizes gate > main > sidecar", () => {
    const tasks = [
      task("A", [], "sidecar"),
      task("B", [], "main"),
      task("C", [], "gate"),
    ];
    const states = {
      A: state("A"),
      B: state("B"),
      C: state("C"),
    };
    const ready = findReadyTasks(tasks, states);
    expect(ready.map((t) => t.id)).toEqual(["C", "B", "A"]);
  });

  test("findNextTask returns highest priority ready task", () => {
    const tasks = [task("A", [], "sidecar"), task("B", [], "gate")];
    const states = { A: state("A"), B: state("B") };
    const next = findNextTask(tasks, states);
    expect(next?.id).toBe("B");
  });

  test("findNextTask returns null when nothing ready", () => {
    const tasks = [task("B", ["A"])];
    const states = { A: state("A", "todo"), B: state("B") };
    const next = findNextTask(tasks, states);
    expect(next).toBeNull();
  });

  test("whatUnblocks identifies downstream tasks", () => {
    const tasks = [task("A"), task("B", ["A"]), task("C", ["A"])];
    const states = {
      A: state("A"),
      B: state("B"),
      C: state("C"),
    };
    const unlocked = whatUnblocks("A", tasks, states);
    expect(unlocked.map((t) => t.id).sort()).toEqual(["B", "C"]);
  });
});

describe("epic state derivation", () => {
  const epic: EpicConfig = { id: "E-1", title: "Epic 1", track: "main" };

  test("all todo → todo", () => {
    const tasks = [task("A"), task("B")];
    const states = { A: state("A"), B: state("B") };
    expect(deriveEpicState(epic, tasks, states)).toBe("todo");
  });

  test("some in_progress → in_progress", () => {
    const tasks = [task("A"), task("B")];
    const states = {
      A: state("A", "in_progress"),
      B: state("B"),
    };
    expect(deriveEpicState(epic, tasks, states)).toBe("in_progress");
  });

  test("all done → done", () => {
    const tasks = [task("A"), task("B")];
    const states = {
      A: state("A", "done"),
      B: state("B", "done"),
    };
    expect(deriveEpicState(epic, tasks, states)).toBe("done");
  });

  test("any blocked → blocked", () => {
    const tasks = [task("A"), task("B")];
    const states = {
      A: state("A", "done"),
      B: state("B", "blocked"),
    };
    expect(deriveEpicState(epic, tasks, states)).toBe("blocked");
  });

  test("any failed → failed", () => {
    const tasks = [task("A"), task("B")];
    const states = {
      A: state("A", "done"),
      B: state("B", "failed"),
    };
    expect(deriveEpicState(epic, tasks, states)).toBe("failed");
  });
});
