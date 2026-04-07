import type { ClaimedRun, WorkerClaimResponse, WorkerRegisterResponse, WorkerEvent, RunCompletion, WorkerEnrollResponse, RunArtifact } from '@questpie/autopilot-spec'
import type { RuntimeAdapter, RunContext } from './runtimes/adapter'
import { executeActions, mergeOutputs, type ActionsMergedResult } from './actions/webhook'
import { collectPreviewFiles } from './preview'
import { WorkspaceManager, type WorkspaceInfo } from './workspace'
import { resolveRuntime, resolveModel, type RuntimeConfig, type ResolvedRuntime } from './runtime-config'
import { loadCredential, saveCredential, type StoredCredential } from './credentials'
import { startWorkerApi, type WorkerApiConfig, type WorkerApiServer } from './api'

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
  /** Worker app API config. If set, starts the worker-plane HTTP server. */
  workerApi?: WorkerApiConfig | boolean
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
  private apiServer: WorkerApiServer | null = null

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

    // ── Start worker app API if configured ──────────────────────────
    if (this.config.workerApi) {
      const apiConfig = typeof this.config.workerApi === 'boolean' ? {} : this.config.workerApi
      const workerTags = this.config.tags ?? []
      this.apiServer = startWorkerApi(
        {
          workerId: this.workerId,
          deviceId: this.config.deviceId,
          name: this.config.name,
          repoRoot: this.config.repoRoot ?? null,
          tags: workerTags,
          isLocalDev: this.isLocalDev,
          getActiveRunId: () => this.activeRunId,
          getResolvedRuntimes: () => this.resolvedRuntimes,
          getWorkspace: () => this.workspace,
        },
        apiConfig,
      )
    }
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)

    if (this.apiServer) {
      this.apiServer.stop()
      this.apiServer = null
    }

    try {
      await this.api('/api/workers/deregister', {
        method: 'POST',
        body: { worker_id: this.workerId },
      })
    } catch (err) {
      console.warn('[worker] deregister failed (best effort):', err)
    }
  }

  /** Get the worker app API server info (token, port) if running. */
  getApiServer(): WorkerApiServer | null {
    return this.apiServer
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
          taskId: run.task_id,
          resumedFromRunId: run.resumed_from_run_id,
          baseBranch: run.parent_branch,
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

    // Resolve canonical model through worker-local modelMap
    const runtimeConfig = this.resolvedRuntimes.find((r) => r.config.runtime === run.runtime)?.config
    const resolvedModel = runtimeConfig
      ? resolveModel(runtimeConfig, run.model)
      : (run.model ?? null)

    const context: RunContext = {
      runId: run.id,
      agentId: run.agent_id,
      agentName: run.agent_name ?? null,
      agentRole: run.agent_role ?? null,
      taskId: run.task_id,
      taskTitle: run.task_title ?? null,
      taskDescription: run.task_description ?? null,
      instructions: run.instructions ?? null,
      orchestratorUrl: this.config.orchestratorUrl,
      apiKey: this.machineSecret ?? '',
      runtimeSessionRef: run.runtime_session_ref ?? null,
      workDir: ws?.path ?? null,
      capabilities: run.resolved_capabilities ?? null,
      model: resolvedModel,
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

      // Collect preview files from worktree before cleanup
      let allArtifacts: RunArtifact[] = result?.artifacts ?? []
      if (ws && this.config.repoRoot) {
        const previewFiles = await collectPreviewFiles(ws.path, this.config.repoRoot)
        if (previewFiles.length > 0) {
          allArtifacts = [...allArtifacts, ...previewFiles]
        }
      }

      // Execute post-run external actions from targeting (before completing)
      const actionResult = await this.runPostActions(run, ws?.path ?? null, allArtifacts)

      // Merge script action results into the completion
      if (actionResult) {
        allArtifacts = [...allArtifacts, ...actionResult.artifacts]
      }

      const mergedOutputs = mergeOutputs(
        result?.outputs ?? {},
        actionResult?.outputs ?? {},
      )
      const finalSummary = actionResult?.summary ?? result?.summary

      await this.completeRun(run.id, {
        status: 'completed',
        summary: finalSummary,
        tokens: result?.tokens,
        artifacts: allArtifacts.length > 0 ? allArtifacts : undefined,
        runtime_session_ref: result?.sessionId,
        resumable,
        outputs: Object.keys(mergedOutputs).length > 0 ? mergedOutputs : undefined,
      })

      if (ws && this.workspace) {
        await this.workspace.release({ runId: run.id, taskId: run.task_id, resumable })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      await this.postEvent(run.id, { type: 'error', summary: errorMsg })
      await this.completeRun(run.id, { status: 'failed', error: errorMsg })

      if (ws && this.workspace) {
        await this.workspace.release({ runId: run.id, taskId: run.task_id, resumable: false })
      }
    }
  }

  /** Execute post-run external actions from the claim response. */
  private async runPostActions(
    run: ClaimedRun,
    workspacePath: string | null,
    runArtifacts: RunArtifact[],
  ): Promise<ActionsMergedResult | null> {
    const actions = run.actions ?? []
    if (actions.length === 0) return null

    return executeActions({
      actions,
      emitEvent: (event) => { this.postEvent(run.id, event).catch((err) => console.warn('[worker] failed to post action event:', err)) },
      secretRefs: run.secret_refs ?? [],
      preResolvedSharedSecrets: run.resolved_shared_secrets ?? {},
      workspacePath: workspacePath ?? undefined,
      runArtifacts,
    })
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
