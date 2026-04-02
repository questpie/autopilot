import type { RuntimeAdapter, RunContext } from './runtimes/adapter'

export interface WorkerCapability {
  runtime: 'claude-code' | 'codex' | 'opencode' | 'direct-api'
  models: string[]
  maxConcurrent: number
}

export interface WorkerConfig {
  orchestratorUrl: string
  apiKey: string
  deviceId: string
  name: string
  capabilities: WorkerCapability[]
  heartbeatInterval?: number // ms, default 30_000
  pollInterval?: number // ms, default 5_000
}

interface ClaimResponseRun {
  id: string
  agent_id: string
  task_id: string | null
  runtime: string
  status: string
  task_title: string | null
  task_description: string | null
  instructions: string | null
}

interface ClaimResponse {
  run: ClaimResponseRun | null
  lease_id: string | null
}

export class AutopilotWorker {
  private workerId: string
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private running = false
  private activeRunId: string | null = null
  private adapters = new Map<string, RuntimeAdapter>()

  constructor(private config: WorkerConfig) {
    // Worker generates its own id at construction
    this.workerId = `worker-${config.deviceId}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** Register a runtime adapter. */
  registerAdapter(runtime: string, adapter: RuntimeAdapter): void {
    this.adapters.set(runtime, adapter)
  }

  /** Start the worker: register, heartbeat, poll for work. */
  async start(): Promise<void> {
    this.running = true

    // Register with orchestrator using shared contract
    const res = (await this.api('/api/workers/register', {
      method: 'POST',
      body: {
        id: this.workerId,
        device_id: this.config.deviceId,
        name: this.config.name,
        capabilities: this.config.capabilities,
      },
    })) as { workerId: string; status: string }
    console.log(`[worker] registered as ${res.workerId}`)

    // Start heartbeat
    this.heartbeatTimer = setInterval(
      () => this.heartbeat(),
      this.config.heartbeatInterval ?? 30_000,
    )

    // Start polling for work
    this.pollTimer = setInterval(
      () => this.poll(),
      this.config.pollInterval ?? 5_000,
    )
  }

  /** Stop the worker gracefully. */
  async stop(): Promise<void> {
    this.running = false
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)

    try {
      await this.api('/api/workers/deregister', {
        method: 'POST',
        body: { worker_id: this.workerId },
      })
    } catch {
      // Best effort
    }
  }

  private async heartbeat(): Promise<void> {
    try {
      await this.api('/api/workers/heartbeat', {
        method: 'POST',
        body: { worker_id: this.workerId },
      })
    } catch (err) {
      console.error('[worker] heartbeat failed:', err)
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return

    // Concurrency: don't poll when already running a task
    if (this.activeRunId !== null) return

    try {
      const res = (await this.api('/api/workers/claim', {
        method: 'POST',
        body: { worker_id: this.workerId },
      })) as ClaimResponse

      if (res.run) {
        this.activeRunId = res.run.id
        this.executeRun(res.run)
          .catch((err) => {
            console.error('[worker] run failed:', err)
          })
          .finally(() => {
            this.activeRunId = null
          })
      }
    } catch (err) {
      console.error('[worker] poll failed:', err)
    }
  }

  private async executeRun(run: ClaimResponseRun): Promise<void> {
    const adapter = this.adapters.get(run.runtime)
    if (!adapter) {
      await this.postEvent(run.id, {
        type: 'error',
        summary: `No adapter for runtime: ${run.runtime}`,
      })
      await this.completeRun(run.id, {
        status: 'failed',
        error: `No adapter for runtime: ${run.runtime}`,
      })
      return
    }

    const context: RunContext = {
      runId: run.id,
      agentId: run.agent_id,
      taskId: run.task_id,
      context: {
        task_title: run.task_title,
        task_description: run.task_description,
      },
      instructions: run.instructions,
      model: null,
      orchestratorUrl: this.config.orchestratorUrl,
      apiKey: this.config.apiKey,
    }

    await this.postEvent(run.id, { type: 'started', summary: `Starting ${run.runtime}` })

    try {
      adapter.onEvent((event) => {
        this.postEvent(run.id, event).catch(() => {})
      })

      const result = await adapter.start(context)
      await this.completeRun(run.id, {
        status: 'completed',
        summary: result?.summary,
        tokens: result?.tokens,
        artifacts: result?.artifacts,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      await this.postEvent(run.id, { type: 'error', summary: errorMsg })
      await this.completeRun(run.id, { status: 'failed', error: errorMsg })
    }
  }

  private async postEvent(
    runId: string,
    event: { type: string; summary: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    await this.api(`/api/runs/${runId}/events`, {
      method: 'POST',
      body: event,
    })
  }

  private async completeRun(runId: string, completion: Record<string, unknown>): Promise<void> {
    await this.api(`/api/runs/${runId}/complete`, {
      method: 'POST',
      body: completion,
    })
  }

  private async api(path: string, opts: { method: string; body?: unknown }): Promise<unknown> {
    const res = await fetch(`${this.config.orchestratorUrl}${path}`, {
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${await res.text()}`)
    }
    return res.json()
  }
}
