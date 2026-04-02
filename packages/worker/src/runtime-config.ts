/**
 * Runtime configuration — single source of truth for what a worker hosts.
 *
 * Each RuntimeConfig describes one runtime the worker can execute:
 * - which binary to use
 * - which models it supports
 * - MCP / session persistence settings
 * - max concurrency
 *
 * The worker derives both its advertised capabilities AND its adapter
 * instances from these configs. No separate parallel truth.
 */

import { ClaudeCodeAdapter, type ClaudeCodeConfig } from './runtimes/claude-code'
import type { RuntimeAdapter } from './runtimes/adapter'
import type { WorkerCapability } from './worker'

// ─── Config types ──────────────────────────────────────────────────────────

export interface RuntimeConfig {
  /** Runtime kind identifier. */
  runtime: 'claude-code' | 'codex' | 'opencode' | 'direct-api'
  /** Explicit binary path. If omitted, resolved from PATH. */
  binaryPath?: string
  /** Models this runtime supports. */
  models?: string[]
  /** Max concurrent runs for this runtime. Default 1. */
  maxConcurrent?: number
  /** Enable MCP tools. Default true. */
  useMcp?: boolean
  /** Session persistence mode. Default 'local'. */
  sessionPersistence?: 'local' | 'off'
  /** Max agentic turns per run. Default 50. */
  maxTurns?: number
  /** Explicit tags for this runtime (e.g. 'gpu', 'staging'). Merged with worker-level tags. */
  tags?: string[]
}

/** Result of resolving a RuntimeConfig — validated and ready to use. */
export interface ResolvedRuntime {
  config: RuntimeConfig
  /** The actual binary path that will be used (resolved from PATH or explicit). */
  resolvedBinaryPath: string
  /** The adapter instance, ready for registration. */
  adapter: RuntimeAdapter
  /** The capability to advertise to the orchestrator. */
  capability: WorkerCapability
}

// ─── Binary resolution ─────────────────────────────────────────────────────

/**
 * Find a binary in PATH using `which`.
 * Returns the absolute path or null if not found.
 */
function whichSync(name: string): string | null {
  const result = Bun.spawnSync(['which', name], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) return null
  return result.stdout.toString().trim() || null
}

/** Default models per runtime kind. */
const DEFAULT_MODELS: Record<string, string[]> = {
  'claude-code': ['claude-sonnet-4-20250514'],
  codex: [],
  opencode: [],
  'direct-api': [],
}

// ─── Resolve ───────────────────────────────────────────────────────────────

/**
 * Resolve a RuntimeConfig into a validated, ready-to-use ResolvedRuntime.
 *
 * - Validates that the binary exists (explicit path or PATH lookup)
 * - Creates the appropriate adapter instance
 * - Derives the capability for orchestrator registration
 *
 * Throws with a clear operator-facing error if the binary is not found.
 */
export function resolveRuntime(config: RuntimeConfig): ResolvedRuntime {
  const binaryName = getBinaryName(config.runtime)
  const resolvedBinaryPath = resolveBinaryPath(config, binaryName)

  const adapter = createAdapter(config, resolvedBinaryPath)
  const capability = deriveCapability(config)

  return { config, resolvedBinaryPath, adapter, capability }
}

function getBinaryName(runtime: string): string {
  switch (runtime) {
    case 'claude-code':
      return 'claude'
    case 'codex':
      return 'codex'
    case 'opencode':
      return 'opencode'
    default:
      return runtime
  }
}

function resolveBinaryPath(config: RuntimeConfig, binaryName: string): string {
  // Explicit path takes precedence
  if (config.binaryPath) {
    try {
      const result = Bun.spawnSync([config.binaryPath, '--version'], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      if (result.exitCode !== 0) {
        throw new Error(
          `Runtime binary failed validation: ${config.binaryPath}\n` +
            `Configured for runtime '${config.runtime}'. Check the path exists and is executable.`,
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Runtime binary not available: ${config.binaryPath}\n` +
          `Configured for runtime '${config.runtime}'.\n` +
          `Cause: ${msg}`,
      )
    }
    return config.binaryPath
  }

  // PATH resolution
  const found = whichSync(binaryName)
  if (!found) {
    throw new Error(
      `Runtime binary '${binaryName}' not found in PATH.\n` +
        `Required for runtime '${config.runtime}'.\n` +
        `Either install it or set an explicit binaryPath in runtime config.`,
    )
  }
  return found
}

function createAdapter(config: RuntimeConfig, resolvedBinaryPath: string): RuntimeAdapter {
  switch (config.runtime) {
    case 'claude-code': {
      const adapterConfig: ClaudeCodeConfig = {
        binaryPath: resolvedBinaryPath,
        useMcp: config.useMcp ?? true,
        sessionPersistence: config.sessionPersistence ?? 'local',
        maxTurns: config.maxTurns ?? 50,
      }
      return new ClaudeCodeAdapter(adapterConfig)
    }
    default:
      throw new Error(
        `No adapter implementation for runtime '${config.runtime}'.\n` +
          `Supported runtimes: claude-code`,
      )
  }
}

function deriveCapability(config: RuntimeConfig): WorkerCapability {
  return {
    runtime: config.runtime,
    models: config.models ?? DEFAULT_MODELS[config.runtime] ?? [],
    maxConcurrent: config.maxConcurrent ?? 1,
    tags: config.tags ?? [],
  }
}
