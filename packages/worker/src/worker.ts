import { randomBytes } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import type { ClaimedRun, WorkerClaimResponse, WorkerRegisterResponse, WorkerEvent, RunCompletion, WorkerEnrollResponse, RunArtifact } from '@questpie/autopilot-spec'
import type { RuntimeAdapter, RunContext } from './runtimes/adapter'
import { executeActions, mergeOutputs, type ActionsMergedResult } from './actions/webhook'
import { collectPreviewFiles } from './preview'
import { WorkspaceManager, type WorkspaceInfo } from './workspace'
import { resolveRuntime, resolveModel, createAdapter, type RuntimeConfig, type ResolvedRuntime } from './runtime-config'
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
   * Maximum number of concurrent runs this worker will execute.
   * Each run gets its own worktree and runtime session.
   * Default 1 (backward compatible).
   */
  maxConcurrentRuns?: number
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

export function runUsesSharedCheckout(
  run: Pick<ClaimedRun, 'task_id' | 'workspace_mode'>,
  opts: {
    sharedCheckoutEnabled: boolean
    worktreeIsolationAvailable: boolean
  },
): boolean {
  if (!opts.sharedCheckoutEnabled) return false
  if (!run.task_id) return true
  if (!opts.worktreeIsolationAvailable) return true
  return run.workspace_mode === 'none'
}

export class AutopilotWorker {
  private workerId: string | null = null
  private machineSecret: string | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private running = false
  private polling = false
  private activeRunIds = new Set<string>()
  private activeSharedCheckoutRunIds = new Set<string>()
  private maxConcurrentRuns: number
  private adapters = new Map<string, RuntimeAdapter>()
  private resolvedCapabilities: WorkerCapability[] = []
  private workspace: WorkspaceManager | null = null
  private resolvedRuntimes: ResolvedRuntime[] = []
  private isLocalDev: boolean
  private apiServer: WorkerApiServer | null = null
  private worktreeCleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(private config: WorkerConfig) {
    this.isLocalDev = config.localDev ?? false
    this.maxConcurrentRuns = config.maxConcurrentRuns ?? 1

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
      // Merge worker-level tags and concurrency into per-runtime capability
      const mergedCap: WorkerCapability = {
        ...resolved.capability,
        maxConcurrent: this.maxConcurrentRuns,
        tags: [...new Set([...workerTags, ...resolved.capability.tags])],
      }
      this.resolvedCapabilities.push(mergedCap)
    }
  }

  getResolvedRuntimes(): ReadonlyArray<ResolvedRuntime> {
    return this.resolvedRuntimes
  }

  getCapabilities(): ReadonlyArray<WorkerCapability> {
    return this.resolvedCapabilities
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
      this.workerId = `worker-local-${this.config.deviceId}-${randomBytes(4).toString('hex')}`
    } else {
      await this.resolveIdentity()
    }

    // ── Clear stale state from previous instance ─────────────────────
    // If we have an existing identity (stored credential or local dev),
    // deregister first so the orchestrator can clean up stale leases.
    if (this.workerId) {
      try {
        await this.api('/api/workers/deregister', {
          method: 'POST',
          body: { worker_id: this.workerId },
        })
        console.log('[worker] deregistered stale previous instance')
      } catch (err) {
        // Best effort — orchestrator may not know this worker yet
        console.debug('[worker] pre-start deregister (best effort):', err instanceof Error ? err.message : String(err))
      }
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
          maxConcurrentRuns: this.maxConcurrentRuns,
          getActiveRunIds: () => this.activeRunIds,
          getResolvedRuntimes: () => this.resolvedRuntimes,
          getWorkspace: () => this.workspace,
        },
        apiConfig,
      )
    }

    // ── Periodic worktree cleanup (every 5 min) ────────────────────
    if (this.workspace) {
      this.worktreeCleanupTimer = setInterval(() => {
        this.cleanupStaleWorktrees().catch((err) => {
          console.warn('[worker] worktree cleanup error:', err instanceof Error ? err.message : String(err))
        })
      }, 5 * 60_000)
      this.worktreeCleanupTimer.unref()
    }
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.worktreeCleanupTimer) clearInterval(this.worktreeCleanupTimer)

    // Wait for all active runs to complete (with timeout)
    if (this.activeRunIds.size > 0) {
      console.log(`[worker] waiting for ${this.activeRunIds.size} active run(s) to finish...`)
      const SHUTDOWN_TIMEOUT = 60_000 // 60 seconds
      const deadline = Date.now() + SHUTDOWN_TIMEOUT
      while (this.activeRunIds.size > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      if (this.activeRunIds.size > 0) {
        console.warn(`[worker] shutdown timeout — ${this.activeRunIds.size} run(s) still active`)
      }
    }

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
    if (this.polling) return // prevent overlapping polls
    this.polling = true

    try {
      const sharedCheckoutEnabled = !!this.workspace
      const worktreeIsolationAvailable = this.workspace?.supportsIsolation() ?? false

      // Claim runs until at capacity or no more work available
      while (this.running && this.activeRunIds.size < this.maxConcurrentRuns) {
        try {
          const res = (await this.api('/api/workers/claim', {
            method: 'POST',
            body: {
              worker_id: this.workerId,
              shared_checkout_locked: this.activeSharedCheckoutRunIds.size > 0,
              shared_checkout_enabled: sharedCheckoutEnabled,
              worktree_isolation_available: worktreeIsolationAvailable,
            },
          })) as WorkerClaimResponse

          if (!res.run) break // no more work available

          this.activeRunIds.add(res.run.id)
          const runId = res.run.id
          const usesSharedCheckout = runUsesSharedCheckout(res.run, {
            sharedCheckoutEnabled,
            worktreeIsolationAvailable,
          })
          if (usesSharedCheckout) {
            this.activeSharedCheckoutRunIds.add(runId)
          }
          this.executeRun(res.run)
            .catch((err) => {
              console.error(`[worker] run ${runId} failed:`, err)
            })
            .finally(() => {
              this.activeRunIds.delete(runId)
              this.activeSharedCheckoutRunIds.delete(runId)
            })
        } catch (err) {
          console.error('[worker] poll failed:', err)
          break
        }
      }
    } finally {
      this.polling = false
    }
  }

  private async executeRun(run: ClaimedRun): Promise<void> {
    // Find the resolved runtime config for this run's runtime type
    const resolved = this.resolvedRuntimes.find((r) => r.config.runtime === run.runtime)
    if (!resolved) {
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

    // Create a fresh adapter per run — adapters are stateful (subprocess, event handler)
    // and cannot be shared across concurrent runs
    const adapter = createAdapter(resolved.config, resolved.resolvedBinaryPath)

    let ws: WorkspaceInfo | null = null
    // Only isolated_worktree runs need a dedicated worktree.
    // Mutable queries and workspace_mode:none tasks use the shared checkout repoRoot.
    const needsWorktree = run.workspace_mode === 'isolated_worktree'
    if (this.workspace && needsWorktree) {
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

    // Shared-checkout runs use the main repo checkout as their workDir.
    if (!ws && this.workspace && run.workspace_mode === 'none') {
      ws = {
        path: this.workspace.repoRoot,
        branch: '',
        created: false,
        runId: run.id,
        degraded: true,
      }
    }

    // Resolve canonical model through worker-local modelMap
    const resolvedModel = resolveModel(resolved.config, run.model)

    // Verify workspace directory exists before launching runtime
    if (ws?.path && !existsSync(ws.path)) {
      const msg = `Workspace directory missing: ${ws.path} — worktree may have been removed externally`
      await this.postEvent(run.id, { type: 'error', summary: msg })
      await this.completeRun(run.id, { status: 'failed', error: msg })
      return
    }

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
      localDev: this.isLocalDev,
      runtimeSessionRef: run.runtime_session_ref ?? null,
      workDir: ws?.path ?? null,
      capabilities: run.resolved_capabilities ?? null,
      model: resolvedModel,
      injectedContext: run.injected_context ?? null,
      contextHints: run.context_hints ?? null,
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
      // Skip when workspace is degraded (no real worktree diff to collect from)
      let allArtifacts: RunArtifact[] = result?.artifacts ?? []
      if (ws && !ws.degraded && this.config.repoRoot) {
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

      if (ws && !ws.degraded && this.workspace) {
        await this.workspace.release({ runId: run.id, taskId: run.task_id, resumable })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      await this.postEvent(run.id, { type: 'error', summary: errorMsg })
      await this.completeRun(run.id, { status: 'failed', error: errorMsg })

      if (ws && !ws.degraded && this.workspace) {
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
      resolvedScripts: run.resolved_scripts ?? [],
    })
  }

  /** Scan .worktrees/ and remove any whose task is in terminal state (done/failed). */
  private async cleanupStaleWorktrees(): Promise<void> {
    if (!this.workspace) return
    const base = this.workspace.getWorktreeBase()
    if (!existsSync(base)) return

    let entries: string[]
    try {
      entries = readdirSync(base)
    } catch {
      return
    }

    for (const entry of entries) {
      // Skip worktrees for currently active runs
      if (this.activeRunIds.has(entry)) continue

      // Query orchestrator for run status
      try {
        const run = (await this.api(`/api/runs/${encodeURIComponent(entry)}`, { method: 'GET' })) as {
          id: string
          task_id?: string
          status: string
        }
        if (run.status === 'completed' || run.status === 'failed') {
          await this.workspace.release({
            runId: entry,
            taskId: run.task_id,
            resumable: false,
          })
          console.log(`[worker] cleaned up worktree for terminal run ${entry}`)
        }
      } catch {
        // Run not found or API error — skip this entry
      }
    }
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
