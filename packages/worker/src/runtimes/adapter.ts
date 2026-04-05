import type { WorkerEvent, RunArtifact, ResolvedCapabilities } from '@questpie/autopilot-spec'
export type { WorkerEvent } from '@questpie/autopilot-spec'

/**
 * Context passed to a runtime adapter when starting a run.
 *
 * Fields come from two sources:
 * - Orchestrator (via ClaimedRun): run/task/agent identity, instructions, session refs, capabilities
 * - Worker-local: orchestratorUrl, apiKey, workDir
 *
 * The runtime adapter should not need to resolve config or walk filesystems.
 */
export interface RunContext {
  runId: string
  agentId: string
  agentName: string | null
  agentRole: string | null
  taskId: string | null
  taskTitle: string | null
  taskDescription: string | null
  instructions: string | null
  orchestratorUrl: string
  apiKey: string
  /** For continuation runs: the worker-local session ID to resume. */
  runtimeSessionRef: string | null
  /** Per-run isolated workspace path. Overrides adapter's default workDir. */
  workDir: string | null
  /** Resolved capability intent from merged agent + step profiles. */
  capabilities: ResolvedCapabilities | null
}

/** Result returned by a runtime adapter after completing. */
export interface RuntimeResult {
  summary?: string
  tokens?: { input: number; output: number }
  artifacts?: RunArtifact[]
  /** Worker-local session ID for future resume. */
  sessionId?: string
  /** Structured output fields extracted from the agent's result block.
   *  Used by the workflow engine for generic transition matching.
   *  E.g. { outcome: 'approved', priority: 'high' }. */
  outputs?: Record<string, string>
}

/**
 * Interface for runtime adapters.
 * Each adapter handles the transport-specific details of a runtime
 * (CLI subprocess, stdio JSON-RPC, HTTP, etc.) and normalizes output
 * into WorkerEvents.
 */
export interface RuntimeAdapter {
  /** Start executing a run. Returns when the runtime finishes. */
  start(context: RunContext): Promise<RuntimeResult | undefined>

  /** Register event handler for normalized events. */
  onEvent(handler: (event: WorkerEvent) => void): void

  /** Force stop the runtime. */
  stop(): Promise<void>
}
