/** Context passed to a runtime adapter when starting a run. */
export interface RunContext {
  runId: string
  agentId: string
  taskId: string | null
  context: Record<string, unknown>
  instructions: string | null
  model: string | null
  orchestratorUrl: string
  apiKey: string
}

/** Result returned by a runtime adapter after completing. */
export interface RuntimeResult {
  summary?: string
  tokens?: { input: number; output: number }
  artifacts?: Array<{ path: string; action: string }>
}

/** Normalized event from runtime adapter -> worker -> orchestrator. */
export interface WorkerEvent {
  type: string
  summary: string
  metadata?: Record<string, unknown>
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
