import { ExternalActionSchema, SecretRefSchema } from '@questpie/autopilot-spec'
import type { ClaimedRun, WorkerClaimResponse, WorkerRegisterResponse, WorkerEvent, RunCompletion, WorkerEnrollResponse } from '@questpie/autopilot-spec'
import { z } from 'zod'
import type { RuntimeAdapter, RunContext } from './runtimes/adapter'
import { executeActions } from './actions/webhook'
import { WorkspaceManager, type WorkspaceInfo } from './workspace'
import { resolveRuntime, type RuntimeConfig, type ResolvedRuntime } from './runtime-config'
import { loadCredential, saveCredential, type StoredCredential } from './credentials'

export interface WorkerCapability {
  runtime: 'claude-code' | 'codex' | 'opencode' | 'direct-api'
  models: string[]
  maxConcurrent: number
  tags: string[]
}

export interface WorkerConfig {
  orchestratorUrl: string
  deviceId: string
  name: string
  runtimes: RuntimeConfig[]
  heartbeatInterval?: number // ms, default 30_000
  pollInterval?: number // ms, default 5_000
  repoRoot?: string
  /**
   * Join token for initial enrollment. Used once, then durable credential takes over.
   * Not needed if worker already has a stored credential for this orchestrator.
   */
  joinToken?: string
  /**
   * Local dev mode — skips enrollment, uses X-Local-Dev header.
   * Only for `autopilot start` convenience. Not for real multi-machine use.
   */
  localDev?: boolean
  /** Explicit worker-level tags (e.g. 'staging', 'prod'). Merged with per-runtime tags. */
  tags?: string[]
}

export class AutopilotWorker {
  private workerId: string | null = null
  private machineSecret: string | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private running = false
  private activeRunId: string | null = null
  private adapters = new Map<string, RuntimeAdapter>()
  private resolvedCapabilities: WorkerCapability[] = []
  private workspace: WorkspaceManager | null = null
  private resolvedRuntimes: ResolvedRuntime[] = []
  private isLocalDev: boolean

  constructor(private config: WorkerConfig) {
    this.isLocalDev = config.localDev ?? false

    if (config.repoRoot) {
      this.workspace = new WorkspaceManager({ repoRoot: config.repoRoot })
    }

    if (config.runtimes.length === 0) {
      throw new Error('WorkerConfig.runtimes must contain at least one runtime config.')
    }

    const workerTags = config.tags ?? []
    for (const rtConfig of config.runtimes) {
      const resolved = resolveRuntime(rtConfig)
      this.resolvedRuntimes.push(resolved)
      this.adapters.set(rtConfig.runtime, resolved.adapter)
      // Merge worker-level tags into per-runtime capability
      const mergedCap: WorkerCapability = {
        ...resolved.capability,
        tags: [...new Set([...workerTags, ...resolved.capability.tags])],
      }
      this.resolvedCapabilities.push(mergedCap)
    }
  }

  getResolvedRuntimes(): ReadonlyArray<ResolvedRuntime> {
    return this.resolvedRuntimes
  }

  getWorkerId(): string | null {
    return this.workerId
  }

  isEnrolled(): boolean {
    return this.machineSecret !== null
  }

  /** Start the worker: authenticate/enroll, register, heartbeat, poll. */
  async start(): Promise<void> {
    this.running = true

    // ── Resolve identity ─────────────────────────────────────────────
    if (this.isLocalDev) {
      // Local dev bypass: generate a local worker ID, no enrollment
      this.workerId = `worker-local-${this.config.deviceId}-${Math.random().toString(36).slice(2, 8)}`
    } else {
      await this.resolveIdentity()
    }

    // ── Register with orchestrator ───────────────────────────────────
    const res = (await this.api('/api/workers/register', {
      method: 'POST',
      body: {
        id: this.workerId,
        device_id: this.config.deviceId,
        name: this.config.name,
        capabilities: this.resolvedCapabilities,
      },
    })) as WorkerRegisterResponse
    console.log(`[worker] registered as ${res.workerId}`)

    this.heartbeatTimer = setInterval(
      () => this.heartbeat(),
      this.config.heartbeatInterval ?? 30_000,
    )

    this.pollTimer = setInterval(
      () => this.poll(),
      this.config.pollInterval ?? 5_000,
    )
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)

    try {
      await this.api('/api/workers/deregister', {
        method: 'POST',
        body: { worker_id: this.workerId },
      })
    } catch (err) {
      console.warn('[worker] deregister failed (best effort):', err)
    }
  }

  // ─── Identity resolution ──────────────────────────────────────────

  private async resolveIdentity(): Promise<void> {
    // 1. Try stored credential
    const stored = loadCredential(this.config.orchestratorUrl)
    if (stored) {
      this.workerId = stored.workerId
      this.machineSecret = stored.machineSecret
      console.log(`[worker] using stored credential for ${stored.workerId}`)
      return
    }

    // 2. Enroll with join token
    if (!this.config.joinToken) {
      throw new Error(
        'No stored credential and no join token provided.\n' +
          'First-time workers must use --token <join-token> to enroll.\n' +
          'Get a token from: autopilot workers token create',
      )
    }

    console.log('[worker] enrolling with join token...')
    const result = (await this.rawFetch('/api/enrollment/enroll', {
      method: 'POST',
      body: {
        token: this.config.joinToken,
        name: this.config.name,
        device_id: this.config.deviceId,
        capabilities: this.resolvedCapabilities,
      },
    })) as WorkerEnrollResponse

    this.workerId = result.worker_id
    this.machineSecret = result.machine_secret

    // Persist credential locally
    saveCredential({
      orchestratorUrl: this.config.orchestratorUrl,
      workerId: result.worker_id,
      machineSecret: result.machine_secret,
      enrolledAt: new Date().toISOString(),
    })

    console.log(`[worker] enrolled as ${result.worker_id}`)
  }

  // ─── Internals ────────────────────────────────────────────────────

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
    if (this.activeRunId !== null) return

    try {
      const res = (await this.api('/api/workers/claim', {
        method: 'POST',
        body: { worker_id: this.workerId },
      })) as WorkerClaimResponse

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

  private async executeRun(run: ClaimedRun): Promise<void> {
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

    let ws: WorkspaceInfo | null = null
    if (this.workspace) {
      try {
        ws = await this.workspace.acquire({
          runId: run.id,
          resumedFromRunId: run.resumed_from_run_id,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await this.postEvent(run.id, {
          type: 'error',
          summary: `Workspace setup failed: ${msg}`,
        })
        await this.completeRun(run.id, {
          status: 'failed',
          error: `Workspace setup failed: ${msg}`,
        })
        return
      }
    }

    const context: RunContext = {
      runId: run.id,
      agentId: run.agent_id,
      taskId: run.task_id,
      taskTitle: run.task_title ?? null,
      taskDescription: run.task_description ?? null,
      instructions: run.instructions ?? null,
      orchestratorUrl: this.config.orchestratorUrl,
      apiKey: this.machineSecret ?? '',
      runtimeSessionRef: run.runtime_session_ref ?? null,
      workDir: ws?.path ?? null,
    }

    const isResume = !!run.resumed_from_run_id
    await this.postEvent(run.id, {
      type: 'started',
      summary: isResume
        ? `Resuming ${run.runtime} session from run ${run.resumed_from_run_id}`
        : `Starting ${run.runtime}`,
      metadata: ws
        ? { workspace_path: ws.path, workspace_branch: ws.branch, workspace_created: ws.created, workspace_degraded: ws.degraded }
        : undefined,
    })

    try {
      adapter.onEvent((event) => {
        this.postEvent(run.id, event).catch((err) => console.warn('[worker] failed to post event:', err))
      })

      const result = await adapter.start(context)
      const resumable = !!result?.sessionId

      // Execute post-run external actions from targeting (before completing)
      await this.runPostActions(run)

      await this.completeRun(run.id, {
        status: 'completed',
        summary: result?.summary,
        tokens: result?.tokens,
        artifacts: result?.artifacts,
        runtime_session_ref: result?.sessionId,
        resumable,
      })

      if (ws && this.workspace) {
        await this.workspace.release({ runId: run.id, resumable })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      await this.postEvent(run.id, { type: 'error', summary: errorMsg })
      await this.completeRun(run.id, { status: 'failed', error: errorMsg })

      if (ws && this.workspace) {
        await this.workspace.release({ runId: run.id, resumable: false })
      }
    }
  }

  private static TargetingExtrasSchema = z.object({
    actions: z.array(ExternalActionSchema).default([]),
    secret_refs: z.array(SecretRefSchema).default([]),
  }).passthrough()

  /** Execute post-run external actions if targeting includes them. */
  private async runPostActions(run: ClaimedRun): Promise<void> {
    if (!run.targeting) return

    const parsed = AutopilotWorker.TargetingExtrasSchema.safeParse(run.targeting)
    if (!parsed.success) {
      console.warn(`[worker] invalid targeting for run=${run.id}:`, parsed.error.message)
      return
    }

    const { actions, secret_refs } = parsed.data
    if (actions.length === 0) return

    await executeActions(
      actions,
      (event) => { this.postEvent(run.id, event).catch((err) => console.warn('[worker] failed to post action event:', err)) },
      secret_refs,
    )
  }

  private async postEvent(runId: string, event: WorkerEvent): Promise<void> {
    await this.api(`/api/runs/${runId}/events`, {
      method: 'POST',
      body: event,
    })
  }

  private async completeRun(runId: string, completion: RunCompletion): Promise<void> {
    await this.api(`/api/runs/${runId}/complete`, {
      method: 'POST',
      body: completion,
    })
  }

  /** Authenticated API call (uses machine secret or local dev bypass). */
  private async api(path: string, opts: { method: string; body?: unknown }): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.isLocalDev) {
      headers['X-Local-Dev'] = 'true'
    } else if (this.machineSecret) {
      headers['X-Worker-Secret'] = this.machineSecret
    }

    const res = await fetch(`${this.config.orchestratorUrl}${path}`, {
      method: opts.method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${await res.text()}`)
    }
    return res.json()
  }

  /** Unauthenticated fetch for enrollment (before we have a credential). */
  private async rawFetch(path: string, opts: { method: string; body?: unknown }): Promise<unknown> {
    const res = await fetch(`${this.config.orchestratorUrl}${path}`, {
      method: opts.method,
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Enrollment failed (${res.status}): ${text}`)
    }
    return res.json()
  }
}
