import type { WorkerEvent } from '@questpie/autopilot-spec'
export type { WorkerEvent } from '@questpie/autopilot-spec'

/** Context passed to a runtime adapter when starting a run. */
export interface RunContext {
  runId: string
  agentId: string
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
}

import type { RunArtifact } from '@questpie/autopilot-spec'

/** Result returned by a runtime adapter after completing. */
export interface RuntimeResult {
  summary?: string
  tokens?: { input: number; output: number }
  artifacts?: RunArtifact[]
  /** Worker-local session ID for future resume. */
  sessionId?: string
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
