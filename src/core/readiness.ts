import type { TaskConfig, TaskRunState, TaskState, EpicConfig, EpicState } from "./types.js";

const DONE_STATES: TaskState[] = ["done", "committed", "validated_secondary", "validated_primary"];
const TERMINAL_STATES: TaskState[] = ["done", "committed"];

export interface ReadinessResult {
  ready: boolean;
  unmetDeps: string[];
  blockedBy: string[];
}

/**
 * Check if a task is ready to start based on dependency graph.
 * A task is ready when all its hard dependencies are in a "done enough" state.
 */
export function checkReadiness(
  task: TaskConfig,
  allTasks: TaskConfig[],
  states: Record<string, TaskRunState>
): ReadinessResult {
  const unmetDeps: string[] = [];
  const blockedBy: string[] = [];

  for (const depId of task.dependsOn ?? []) {
    const depState = states[depId]?.state ?? "todo";

    // Gate tasks must be fully done
    const depTask = allTasks.find((t) => t.id === depId);
    const requiredStates =
      depTask?.track === "gate" ? TERMINAL_STATES : DONE_STATES;

    if (!requiredStates.includes(depState)) {
      unmetDeps.push(depId);
      if (depState === "blocked" || depState === "failed") {
        blockedBy.push(depId);
      }
    }
  }

  return {
    ready: unmetDeps.length === 0,
    unmetDeps,
    blockedBy,
  };
}

/**
 * Find all tasks that are ready to execute right now.
 * Returns them sorted by track priority: gate > main > sidecar
 */
export function findReadyTasks(
  tasks: TaskConfig[],
  states: Record<string, TaskRunState>
): TaskConfig[] {
  const trackPriority: Record<string, number> = {
    gate: 0,
    main: 1,
    sidecar: 2,
  };

  return tasks
    .filter((t) => {
      const currentState = states[t.id]?.state ?? "todo";
      if (currentState !== "todo" && currentState !== "ready") return false;
      return checkReadiness(t, tasks, states).ready;
    })
    .sort((a, b) => (trackPriority[a.track] ?? 9) - (trackPriority[b.track] ?? 9));
}

/**
 * Find the single best next task to execute.
 */
export function findNextTask(
  tasks: TaskConfig[],
  states: Record<string, TaskRunState>
): TaskConfig | null {
  const ready = findReadyTasks(tasks, states);
  return ready[0] ?? null;
}

/**
 * What tasks would become ready if taskId is completed?
 */
export function whatUnblocks(
  taskId: string,
  tasks: TaskConfig[],
  states: Record<string, TaskRunState>
): TaskConfig[] {
  // Simulate this task being done
  const simStates = { ...states };
  simStates[taskId] = { ...simStates[taskId]!, state: "done" };

  return tasks.filter((t) => {
    const currentState = states[t.id]?.state ?? "todo";
    if (currentState !== "todo") return false;

    const wasReady = checkReadiness(t, tasks, states).ready;
    const wouldBeReady = checkReadiness(t, tasks, simStates).ready;

    return !wasReady && wouldBeReady;
  });
}

/**
 * Derive epic state from its tasks.
 */
export function deriveEpicState(
  epic: EpicConfig,
  tasks: TaskConfig[],
  states: Record<string, TaskRunState>
): EpicState {
  const epicTasks = tasks.filter((t) => t.epicId === epic.id);
  if (epicTasks.length === 0) return "todo";

  const taskStates = epicTasks.map((t) => states[t.id]?.state ?? "todo");

  if (taskStates.every((s) => s === "done")) return "done";
  if (taskStates.some((s) => s === "blocked")) return "blocked";
  if (taskStates.some((s) => s === "failed")) return "failed";
  if (
    taskStates.every((s) =>
      ["done", "committed", "validated_secondary", "validated_primary"].includes(s)
    )
  )
    return "ready_for_validation";
  if (
    taskStates.every((s) => ["done", "committed", "validated_secondary"].includes(s))
  )
    return "validated";
  if (taskStates.some((s) => s !== "todo")) return "in_progress";

  return "todo";
}
