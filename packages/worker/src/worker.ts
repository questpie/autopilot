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

interface RegisterResponse {
  workerId: string
}

interface ClaimResponse {
  run: {
    id: string
    agentId: string
    taskId: string | null
    context: Record<string, unknown>
    instructions: string | null
    runtime: string
    model: string | null
  } | null
}

export class AutopilotWorker {
  private workerId: string | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private running = false
  private adapters = new Map<string, RuntimeAdapter>()

  constructor(private config: WorkerConfig) {}

  /** Register a runtime adapter. */
  registerAdapter(runtime: string, adapter: RuntimeAdapter): void {
    this.adapters.set(runtime, adapter)
  }

  /** Start the worker: register, heartbeat, poll for work. */
  async start(): Promise<void> {
    this.running = true

    // Register with orchestrator
    const res = await this.api('/api/workers/register', {
      method: 'POST',
      body: {
        deviceId: this.config.deviceId,
        name: this.config.name,
        capabilities: this.config.capabilities,
      },
    })
    this.workerId = (res as RegisterResponse).workerId
    console.log(`[worker] registered as ${this.workerId}`)

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

    if (this.workerId) {
      try {
        await this.api('/api/workers/deregister', {
          method: 'POST',
          body: { workerId: this.workerId },
        })
      } catch {
        // Best effort
      }
    }
  }

  private async heartbeat(): Promise<void> {
    if (!this.workerId) return
    try {
      await this.api('/api/workers/heartbeat', {
        method: 'POST',
        body: { workerId: this.workerId },
      })
    } catch (err) {
      console.error('[worker] heartbeat failed:', err)
    }
  }

  private async poll(): Promise<void> {
    if (!this.workerId || !this.running) return
    try {
      const res = (await this.api('/api/workers/claim', {
        method: 'POST',
        body: { workerId: this.workerId },
      })) as ClaimResponse

      if (res.run) {
        // Don't await — run in background
        this.executeRun(res.run).catch((err) => {
          console.error('[worker] run failed:', err)
        })
      }
    } catch (err) {
      console.error('[worker] poll failed:', err)
    }
  }

  private async executeRun(run: NonNullable<ClaimResponse['run']>): Promise<void> {
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
      agentId: run.agentId,
      taskId: run.taskId,
      context: run.context,
      instructions: run.instructions,
      model: run.model,
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
