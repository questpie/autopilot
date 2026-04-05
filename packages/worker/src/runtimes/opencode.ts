/**
 * OpenCode runtime adapter.
 *
 * Spawns `opencode run` as a subprocess in CLI mode (non-interactive),
 * captures JSON output, and normalizes to RuntimeResult.
 *
 * Supported modes:
 * - Fresh run: `opencode run "prompt" --format json`
 * - Resume: `opencode run --continue --session <id> "prompt" --format json`
 *
 * Key differences from Claude Code:
 * - Output is a single JSON object (not streaming)
 * - Model format uses provider/model (e.g. anthropic/claude-sonnet-4-5)
 * - MCP config uses opencode.jsonc with different format
 * - No max-turns equivalent
 * - Session persistence cannot be disabled
 * - Event model is sparser (start + completion only in CLI mode)
 */

import { createOpenCodeMcpConfig } from '../mcp-config-opencode'
import type { RuntimeAdapter, RunContext, RuntimeResult, WorkerEvent } from './adapter'
import { buildPrompt, extractResult, type Subprocess } from './shared'

export interface OpenCodeConfig {
  /** Path to opencode binary. Defaults to 'opencode'. */
  binaryPath?: string
  /** Working directory for OpenCode execution. */
  workDir?: string
  /** If true, generate and use MCP config. */
  useMcp?: boolean
  /** Custom path to MCP server binary. */
  mcpBinaryPath?: string
  /**
   * Session persistence mode.
   * Note: OpenCode does not support disabling session persistence.
   * If set to 'off', a warning is logged and sessions persist anyway.
   */
  sessionPersistence?: 'local' | 'off'
}

/**
 * OpenCode runtime adapter.
 * Spawns `opencode run` in CLI mode, captures JSON output, and normalizes to RuntimeResult.
 */
export class OpenCodeAdapter implements RuntimeAdapter {
  private eventHandler: ((event: WorkerEvent) => void) | null = null
  private subprocess: Subprocess | null = null
  private config: OpenCodeConfig

  constructor(config?: OpenCodeConfig) {
    this.config = config ?? {}

    if (this.config.sessionPersistence === 'off') {
      console.warn(
        '[opencode] sessionPersistence="off" is not supported by OpenCode CLI — sessions will persist locally',
      )
    }
  }

  onEvent(handler: (event: WorkerEvent) => void): void {
    this.eventHandler = handler
  }

  async start(context: RunContext): Promise<RuntimeResult | undefined> {
    const prompt = buildPrompt(context)
    const binaryPath = this.config.binaryPath ?? 'opencode'
    const isResume = !!context.runtimeSessionRef

    const args: string[] = ['run']

    // Resume: --continue --session <id> before the prompt
    if (isResume) {
      args.push('--continue', '--session', context.runtimeSessionRef!)
    }

    // Prompt is a positional argument
    args.push(prompt)

    // Output format
    args.push('--format', 'json')

    // MCP config injection
    let mcpCleanup: (() => Promise<void>) | null = null
    const effectiveWorkDir = context.workDir ?? this.config.workDir ?? process.cwd()

    if (this.config.useMcp) {
      const mcp = await createOpenCodeMcpConfig({
        orchestratorUrl: context.orchestratorUrl,
        apiKey: context.apiKey,
        mcpBinaryPath: this.config.mcpBinaryPath,
        workDir: effectiveWorkDir,
      })
      mcpCleanup = mcp.cleanup
    }

    this.emit({
      type: 'progress',
      summary: isResume
        ? `Resuming OpenCode session ${context.runtimeSessionRef}`
        : 'Launching OpenCode',
    })

    try {
      const proc = Bun.spawn([binaryPath, ...args], {
        cwd: effectiveWorkDir,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env },
      })
      this.subprocess = proc

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()

      const exitCode = await proc.exited
      this.subprocess = null

      if (exitCode !== 0) {
        const errorMsg = stderr.trim() || `OpenCode exited with code ${exitCode}`
        this.emit({ type: 'error', summary: errorMsg })
        throw new Error(errorMsg)
      }

      this.emit({ type: 'progress', summary: 'OpenCode completed' })

      // Parse JSON output
      let result: {
        content?: string
        result?: string
        message?: string
        session_id?: string
        sessionId?: string
        usage?: { input_tokens?: number; output_tokens?: number }
        tokens?: { input?: number; output?: number }
      }
      try {
        result = JSON.parse(stdout)
      } catch {
        // If not valid JSON, treat as plain text
        result = { content: stdout.trim() }
      }

      // Extract text content — try multiple possible field names
      const rawText = result.content ?? result.result ?? result.message ?? stdout.trim()

      // Extract session ID — try multiple possible field names
      const sessionId = result.session_id ?? result.sessionId ?? undefined

      // Extract token usage — try multiple possible shapes
      let tokens: { input: number; output: number } | undefined
      if (result.usage) {
        tokens = { input: result.usage.input_tokens ?? 0, output: result.usage.output_tokens ?? 0 }
      } else if (result.tokens) {
        tokens = { input: result.tokens.input ?? 0, output: result.tokens.output ?? 0 }
      }

      const extracted = extractResult(rawText)

      return {
        summary: extracted.summary,
        tokens,
        artifacts: extracted.artifacts.length > 0 ? extracted.artifacts : undefined,
        sessionId,
        outputs: extracted.outputs,
      }
    } finally {
      if (mcpCleanup) await mcpCleanup()
    }
  }

  async stop(): Promise<void> {
    if (this.subprocess) {
      this.subprocess.kill()
      this.subprocess = null
    }
  }

  private emit(event: WorkerEvent): void {
    this.eventHandler?.(event)
  }
}
