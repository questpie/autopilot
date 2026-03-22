import type { TaskConfig, TaskRunState } from "./types.js";
import { findReadyTasks } from "./readiness.js";

// ── Scheduler Policy ────────────────────────────────────────

export interface SchedulerPolicy {
  maxParallelTasks: number;
  /** Allow gate tasks to run in parallel with each other (default: true) */
  gateParallel: boolean;
  /** Allow sidecar tasks to run in parallel with each other (default: true) */
  sidecarParallel: boolean;
  /** Keep main tasks sequential — only one main at a time (default: true) */
  mainSequential: boolean;
}

export const DEFAULT_SCHEDULER_POLICY: SchedulerPolicy = {
  maxParallelTasks: 1,
  gateParallel: true,
  sidecarParallel: true,
  mainSequential: true,
};

// ── DAG Scheduler ───────────────────────────────────────────

/**
 * DAG-aware task scheduler with track-based parallel policy.
 *
 * Priority order: gate > main > sidecar
 * Within the same track tier, tasks run in parallel if policy allows.
 * Total concurrent tasks capped by maxParallelTasks.
 *
 * The scheduler does not own state transitions — it only advises
 * which tasks to start. The engine is responsible for execution.
 */
export class DagScheduler {
  private running = new Set<string>();

  /**
   * Get the next batch of tasks to start based on:
   * 1. DAG readiness (all deps satisfied)
   * 2. Track-based parallel policy
   * 3. Available execution slots
   *
   * Returns an empty array when no tasks can be started.
   */
  getNextBatch(
    tasks: TaskConfig[],
    states: Record<string, TaskRunState>,
    policy: SchedulerPolicy
  ): TaskConfig[] {
    const availableSlots = policy.maxParallelTasks - this.running.size;
    if (availableSlots <= 0) return [];

    // Get ready tasks, excluding ones already running
    const ready = findReadyTasks(tasks, states).filter(
      (t) => !this.running.has(t.id)
    );
    if (ready.length === 0) return [];

    // Group by track (already sorted by priority: gate > main > sidecar)
    const gates = ready.filter((t) => t.track === "gate");
    const mains = ready.filter((t) => t.track === "main");
    const sidecars = ready.filter((t) => t.track === "sidecar");

    const batch: TaskConfig[] = [];

    // Priority 1: gates
    if (gates.length > 0) {
      const take = policy.gateParallel
        ? Math.min(gates.length, availableSlots - batch.length)
        : 1;
      batch.push(...gates.slice(0, take));
    }

    // Priority 2: mains (sequential by default)
    if (batch.length < availableSlots && mains.length > 0) {
      const mainRunning = this.hasRunningTrack(tasks, "main");
      if (!mainRunning || !policy.mainSequential) {
        batch.push(mains[0]!);
      }
    }

    // Priority 3: sidecars — fill remaining slots
    if (batch.length < availableSlots && sidecars.length > 0) {
      const remaining = availableSlots - batch.length;
      const take = policy.sidecarParallel
        ? Math.min(sidecars.length, remaining)
        : Math.min(1, remaining);
      batch.push(...sidecars.slice(0, take));
    }

    return batch.slice(0, availableSlots);
  }

  markRunning(taskId: string): void {
    this.running.add(taskId);
  }

  markDone(taskId: string): void {
    this.running.delete(taskId);
  }

  getRunning(): string[] {
    return [...this.running];
  }

  getRunningCount(): number {
    return this.running.size;
  }

  isIdle(): boolean {
    return this.running.size === 0;
  }

  private hasRunningTrack(tasks: TaskConfig[], track: string): boolean {
    for (const id of this.running) {
      const t = tasks.find((t) => t.id === id);
      if (t?.track === track) return true;
    }
    return false;
  }
}
