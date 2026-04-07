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
import { buildPrompt, extractResult, streamLines, truncate, summarizeToolInput, type Subprocess } from './shared'

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

    // Model override (canonical model resolved by worker modelMap, provider/model format)
    if (context.model) {
      args.push('--model', context.model)
    }

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
        localDev: context.localDev,
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

      // Collect stderr in parallel with streaming stdout
      const stderrPromise = new Response(proc.stderr).text()
      const { sessionId, lastText, tokens } = await this.streamJsonl(proc)
      const stderr = await stderrPromise

      const exitCode = await proc.exited
      this.subprocess = null

      if (exitCode !== 0) {
        const errorMsg = stderr.trim() || `OpenCode exited with code ${exitCode}`
        this.emit({ type: 'error', summary: errorMsg })
        throw new Error(errorMsg)
      }

      this.emit({ type: 'progress', summary: 'OpenCode completed' })

      if (!lastText) {
        return { summary: 'OpenCode completed with no output' }
      }

      const extracted = extractResult(lastText)

      return {
        summary: extracted.summary,
        tokens,
        artifacts: extracted.artifacts.length > 0 ? extracted.artifacts : undefined,
        sessionId: sessionId ?? undefined,
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

  /**
   * Stream JSONL events from OpenCode stdout.
   * Collects session ID, last text output, and token usage.
   */
  private async streamJsonl(proc: Subprocess): Promise<{
    sessionId: string | null
    lastText: string | null
    tokens: { input: number; output: number } | undefined
  }> {
    let sessionId: string | null = null
    let lastText: string | null = null
    let tokens: { input: number; output: number } | undefined

    const stdout = proc.stdout
    if (!stdout || typeof stdout === 'number') return { sessionId, lastText, tokens }

    await streamLines(stdout as ReadableStream<Uint8Array>, (line) => {
      try {
        const event: OpenCodeStreamEvent = JSON.parse(line)
        const result = this.handleOpenCodeEvent(event)
        if (result.sessionId) sessionId = result.sessionId
        if (result.text) lastText = result.text
        if (result.tokens) tokens = result.tokens
      } catch {
        // Not JSON — could be plain text output. Accumulate as lastText.
        lastText = (lastText ? lastText + '\n' : '') + line
      }
    })

    return { sessionId, lastText, tokens }
  }

  /**
   * Handle a single OpenCode JSONL event.
   * Maps to WorkerEvents and extracts session/result data.
   */
  private handleOpenCodeEvent(event: OpenCodeStreamEvent): {
    sessionId?: string
    text?: string
    tokens?: { input: number; output: number }
  } {
    switch (event.type) {
      case 'step_start': {
        if (event.sessionID) {
          // Extract session ID from first step_start
        }
        if (event.part?.type === 'tool' && event.part.name) {
          const detail = summarizeToolInput(event.part.name, event.part.input)
          this.emit({ type: 'tool_use', summary: detail })
        }
        return { sessionId: event.sessionID ?? undefined }
      }

      case 'text': {
        const text = event.text
        if (text) {
          this.emit({ type: 'progress', summary: truncate(text) })
          return { text }
        }
        return {}
      }

      case 'step_finish': {
        const eventTokens = event.tokens
        if (eventTokens) {
          return {
            tokens: {
              input: eventTokens.input ?? 0,
              output: eventTokens.output ?? 0,
            },
          }
        }
        return {}
      }

      default: {
        // Handle any event with content/result/message fields (fallback for single-JSON mode)
        const text = event.content ?? event.result ?? event.message
        if (text) {
          this.emit({ type: 'progress', summary: truncate(text) })
          return {
            text,
            sessionId: event.session_id ?? event.sessionId ?? undefined,
            tokens: event.usage
              ? { input: event.usage.input_tokens ?? 0, output: event.usage.output_tokens ?? 0 }
              : undefined,
          }
        }
        return {}
      }
    }
  }

  private emit(event: WorkerEvent): void {
    this.eventHandler?.(event)
  }
}

// ─── OpenCode JSONL event types (minimal, for parsing) ───────────────────

interface OpenCodeStreamEvent {
  type?: string
  sessionID?: string
  text?: string
  part?: {
    type?: string
    name?: string
    input?: Record<string, unknown>
  }
  tokens?: {
    input?: number
    output?: number
  }
  cost?: number
  // Fallback fields for single-JSON output mode
  content?: string
  result?: string
  message?: string
  session_id?: string
  sessionId?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}
