import { describe, test, expect } from "bun:test";
import { DagScheduler, DEFAULT_SCHEDULER_POLICY, type SchedulerPolicy } from "../src/core/scheduler.js";
import type { TaskConfig, TaskRunState } from "../src/core/types.js";

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
  return {
    id,
    state: s,
    notes: [],
    runs: [],
    retries: 0,
    validationHistory: [],
    remediationAttempts: 0,
    remediationHistory: [],
  };
}

describe("DagScheduler", () => {
  test("returns empty batch when no ready tasks", () => {
    const scheduler = new DagScheduler();
    const tasks = [task("A", ["B"]), task("B")];
    const states = { A: state("A"), B: state("B", "in_progress") };
    const policy = { ...DEFAULT_SCHEDULER_POLICY, maxParallelTasks: 2 };

    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch).toEqual([]);
  });

  test("returns single ready task with default policy", () => {
    const scheduler = new DagScheduler();
    const tasks = [task("A"), task("B", ["A"])];
    const states = { A: state("A"), B: state("B") };

    const batch = scheduler.getNextBatch(tasks, states, DEFAULT_SCHEDULER_POLICY);
    expect(batch.length).toBe(1);
    expect(batch[0]!.id).toBe("A");
  });

  test("respects maxParallelTasks", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("A", [], "gate"),
      task("B", [], "gate"),
      task("C", [], "gate"),
    ];
    const states = {
      A: state("A"),
      B: state("B"),
      C: state("C"),
    };
    const policy = { ...DEFAULT_SCHEDULER_POLICY, maxParallelTasks: 2 };

    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.length).toBe(2);
  });

  test("gates can run in parallel when policy allows", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("G1", [], "gate"),
      task("G2", [], "gate"),
      task("G3", [], "gate"),
    ];
    const states = {
      G1: state("G1"),
      G2: state("G2"),
      G3: state("G3"),
    };
    const policy: SchedulerPolicy = {
      maxParallelTasks: 5,
      gateParallel: true,
      sidecarParallel: true,
      mainSequential: true,
    };

    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.length).toBe(3);
    expect(batch.map((t) => t.id)).toEqual(["G1", "G2", "G3"]);
  });

  test("gates are limited to 1 when gateParallel is false", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("G1", [], "gate"),
      task("G2", [], "gate"),
    ];
    const states = { G1: state("G1"), G2: state("G2") };
    const policy: SchedulerPolicy = {
      maxParallelTasks: 5,
      gateParallel: false,
      sidecarParallel: true,
      mainSequential: true,
    };

    const batch = scheduler.getNextBatch(tasks, states, policy);
    // 1 gate + possibly mains/sidecars
    expect(batch.filter((t) => t.track === "gate").length).toBe(1);
  });

  test("main tasks are sequential by default", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("M1", [], "main"),
      task("M2", [], "main"),
    ];
    const states = { M1: state("M1"), M2: state("M2") };
    const policy: SchedulerPolicy = {
      maxParallelTasks: 5,
      gateParallel: true,
      sidecarParallel: true,
      mainSequential: true,
    };

    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.filter((t) => t.track === "main").length).toBe(1);
  });

  test("no second main when one is already running", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("M1", [], "main"),
      task("M2", [], "main"),
    ];
    const states = { M1: state("M1"), M2: state("M2") };
    const policy: SchedulerPolicy = {
      maxParallelTasks: 5,
      gateParallel: true,
      sidecarParallel: true,
      mainSequential: true,
    };

    // Mark M1 as running
    scheduler.markRunning("M1");
    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.filter((t) => t.track === "main").length).toBe(0);
  });

  test("sidecars can run in parallel", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("S1", [], "sidecar"),
      task("S2", [], "sidecar"),
      task("S3", [], "sidecar"),
    ];
    const states = {
      S1: state("S1"),
      S2: state("S2"),
      S3: state("S3"),
    };
    const policy: SchedulerPolicy = {
      maxParallelTasks: 5,
      gateParallel: true,
      sidecarParallel: true,
      mainSequential: true,
    };

    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.length).toBe(3);
  });

  test("priority order: gate > main > sidecar", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("S1", [], "sidecar"),
      task("M1", [], "main"),
      task("G1", [], "gate"),
    ];
    const states = {
      S1: state("S1"),
      M1: state("M1"),
      G1: state("G1"),
    };
    const policy: SchedulerPolicy = {
      maxParallelTasks: 1,
      gateParallel: true,
      sidecarParallel: true,
      mainSequential: true,
    };

    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.length).toBe(1);
    expect(batch[0]!.track).toBe("gate");
  });

  test("mixed tracks fill slots in priority order", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("G1", [], "gate"),
      task("M1", [], "main"),
      task("S1", [], "sidecar"),
      task("S2", [], "sidecar"),
    ];
    const states = {
      G1: state("G1"),
      M1: state("M1"),
      S1: state("S1"),
      S2: state("S2"),
    };
    const policy: SchedulerPolicy = {
      maxParallelTasks: 4,
      gateParallel: true,
      sidecarParallel: true,
      mainSequential: true,
    };

    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.length).toBe(4);
    expect(batch[0]!.id).toBe("G1");
    expect(batch[1]!.id).toBe("M1");
    // Sidecars fill remaining 2 slots
    expect(batch.filter((t) => t.track === "sidecar").length).toBe(2);
  });

  test("excludes already-running tasks from batch", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("A", [], "gate"),
      task("B", [], "gate"),
    ];
    const states = { A: state("A"), B: state("B") };
    const policy = { ...DEFAULT_SCHEDULER_POLICY, maxParallelTasks: 5 };

    scheduler.markRunning("A");
    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.length).toBe(1);
    expect(batch[0]!.id).toBe("B");
  });

  test("markDone frees up a slot", () => {
    const scheduler = new DagScheduler();
    const tasks = [
      task("A", [], "main"),
      task("B", [], "main"),
    ];
    const states = { A: state("A", "done"), B: state("B") };
    const policy = { ...DEFAULT_SCHEDULER_POLICY, maxParallelTasks: 1 };

    scheduler.markRunning("A");
    expect(scheduler.getNextBatch(tasks, states, policy).length).toBe(0);

    scheduler.markDone("A");
    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.length).toBe(1);
    expect(batch[0]!.id).toBe("B");
  });

  test("respects dependency graph (join points)", () => {
    const scheduler = new DagScheduler();
    // G1, G2 → M1 (M1 depends on both gates)
    const tasks = [
      task("G1", [], "gate"),
      task("G2", [], "gate"),
      task("M1", ["G1", "G2"], "main"),
    ];
    const states = {
      G1: state("G1"),
      G2: state("G2"),
      M1: state("M1"),
    };
    const policy = { ...DEFAULT_SCHEDULER_POLICY, maxParallelTasks: 3 };

    // Both gates should be in the batch, but not M1
    const batch1 = scheduler.getNextBatch(tasks, states, policy);
    expect(batch1.length).toBe(2);
    expect(batch1.map((t) => t.id).sort()).toEqual(["G1", "G2"]);

    // After both gates done, M1 becomes ready
    states.G1 = state("G1", "done");
    states.G2 = state("G2", "done");
    const batch2 = scheduler.getNextBatch(tasks, states, policy);
    expect(batch2.length).toBe(1);
    expect(batch2[0]!.id).toBe("M1");
  });

  test("returns empty when all slots occupied", () => {
    const scheduler = new DagScheduler();
    const tasks = [task("A"), task("B")];
    const states = { A: state("A"), B: state("B") };
    const policy = { ...DEFAULT_SCHEDULER_POLICY, maxParallelTasks: 1 };

    scheduler.markRunning("A");
    const batch = scheduler.getNextBatch(tasks, states, policy);
    expect(batch.length).toBe(0);
  });

  test("getRunning and isIdle", () => {
    const scheduler = new DagScheduler();
    expect(scheduler.isIdle()).toBe(true);
    expect(scheduler.getRunning()).toEqual([]);

    scheduler.markRunning("A");
    expect(scheduler.isIdle()).toBe(false);
    expect(scheduler.getRunning()).toEqual(["A"]);

    scheduler.markDone("A");
    expect(scheduler.isIdle()).toBe(true);
  });
});
