import type { TaskState, TaskRunState } from "./types.js";
import { TRANSITIONS } from "./types.js";

export class InvalidTransitionError extends Error {
  constructor(taskId: string, from: TaskState, to: TaskState) {
    super(`Invalid transition for ${taskId}: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * Validate and apply a state transition.
 */
export function transition(
  task: TaskRunState,
  to: TaskState
): TaskRunState {
  const from = task.state;
  const allowed = TRANSITIONS[from];

  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(task.id, from, to);
  }

  const updated: TaskRunState = { ...task, state: to };

  if (to === "in_progress" && !updated.startedAt) {
    updated.startedAt = new Date().toISOString();
  }

  if (to === "done" || to === "committed") {
    updated.completedAt = new Date().toISOString();
  }

  if (to === "failed") {
    updated.retries = (updated.retries ?? 0) + 1;
  }

  return updated;
}

/**
 * Check if a transition is valid.
 */
export function canTransition(from: TaskState, to: TaskState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Get all possible next states from current state.
 */
export function nextStates(from: TaskState): TaskState[] {
  return TRANSITIONS[from];
}
