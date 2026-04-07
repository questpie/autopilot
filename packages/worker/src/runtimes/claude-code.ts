import { createMcpConfig } from '../mcp-config'
import type { RuntimeAdapter, RunContext, RuntimeResult, WorkerEvent } from './adapter'
import { buildPrompt, extractResult, streamLines, truncate, type Subprocess } from './shared'

export interface ClaudeCodeConfig {
  /** Path to claude binary. Defaults to 'claude'. */
  binaryPath?: string
  /** Working directory for Claude execution. */
  workDir?: string
  /** Max agentic turns. Defaults to 50. */
  maxTurns?: number
  /** If true, generate and use MCP config. Requires orchestratorUrl and apiKey in RunContext. */
  useMcp?: boolean
  /** Custom path to MCP server binary. */
  mcpBinaryPath?: string
  /**
   * Session persistence mode.
   * - 'local': sessions saved to disk, can be resumed (default for dogfooding)
   * - 'off': no session persistence, each run is ephemeral
   */
  sessionPersistence?: 'local' | 'off'
}

/** MCP tool names exposed by the autopilot MCP server. */
const MCP_TOOL_NAMES = [
  'mcp__autopilot__task_list',
  'mcp__autopilot__task_get',
  'mcp__autopilot__task_create',
  'mcp__autopilot__task_update',
  'mcp__autopilot__task_spawn_children',
  'mcp__autopilot__task_children',
  'mcp__autopilot__task_parents',
  'mcp__autopilot__run_list',
  'mcp__autopilot__run_get',
].join(',')

/**
 * Claude Code runtime adapter.
 * Spawns the `claude` CLI as a subprocess,
 * captures JSON output, and normalizes to RuntimeResult.
 *
 * Supports two modes:
 * - Fresh run: spawns with -p (print mode) and a prompt
 * - Resume: spawns with --resume <session-id> -p and a continuation message
 */
export class ClaudeCodeAdapter implements RuntimeAdapter {
  private eventHandler: ((event: WorkerEvent) => void) | null = null
  private subprocess: Subprocess | null = null
  private config: ClaudeCodeConfig

  constructor(config?: ClaudeCodeConfig) {
    this.config = config ?? {}
  }

  onEvent(handler: (event: WorkerEvent) => void): void {
    this.eventHandler = handler
  }

  async start(context: RunContext): Promise<RuntimeResult | undefined> {
    const prompt = buildPrompt(context)
    const binaryPath = this.config.binaryPath ?? 'claude'
    const persistence = this.config.sessionPersistence ?? 'local'
    const isResume = !!context.runtimeSessionRef

    const args: string[] = []

    // Resume vs fresh run
    if (isResume) {
      args.push('--resume', context.runtimeSessionRef!)
    }

    args.push('-p', prompt, '--output-format', 'stream-json')

    // Model override (canonical model resolved by worker modelMap)
    if (context.model) {
      args.push('--model', context.model)
    }

    // Session persistence
    if (persistence === 'off') {
      args.push('--no-session-persistence')
    }

    args.push(
      '--dangerously-skip-permissions',
      '--max-turns',
      String(this.config.maxTurns ?? 50),
    )

    // Add MCP config if enabled
    let mcpCleanup: (() => Promise<void>) | null = null
    if (this.config.useMcp) {
      const mcp = await createMcpConfig({
        orchestratorUrl: context.orchestratorUrl,
        apiKey: context.apiKey,
        mcpBinaryPath: this.config.mcpBinaryPath,
      })
      args.push('--mcp-config', mcp.configPath, '--strict-mcp-config')
      args.push('--allowedTools', MCP_TOOL_NAMES)
      mcpCleanup = mcp.cleanup
    }

    this.emit({
      type: 'progress',
      summary: isResume ? `Resuming Claude Code session ${context.runtimeSessionRef}` : 'Launching Claude Code',
    })

    try {
      const proc = Bun.spawn([binaryPath, ...args], {
        cwd: context.workDir ?? this.config.workDir ?? process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
        },
      })
      this.subprocess = proc

      // Collect stderr in parallel with streaming stdout
      const stderrPromise = new Response(proc.stderr).text()
      const { sessionId, lastResult, tokens } = await this.streamJsonl(proc)
      const stderr = await stderrPromise

      const exitCode = await proc.exited
      this.subprocess = null

      if (exitCode !== 0) {
        const errorMsg = stderr.trim() || `Claude exited with code ${exitCode}`
        this.emit({ type: 'error', summary: errorMsg })
        throw new Error(errorMsg)
      }

      this.emit({ type: 'progress', summary: 'Claude Code completed' })

      if (!lastResult) {
        return { summary: 'Claude Code completed with no output' }
      }

      const extracted = extractResult(lastResult)

      return {
        summary: extracted.summary,
        tokens,
        artifacts: extracted.artifacts.length > 0 ? extracted.artifacts : undefined,
        sessionId: persistence === 'local' ? (sessionId ?? undefined) : undefined,
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
   * Stream JSONL events from Claude Code's stream-json stdout.
   * Collects session ID, last result text, and token usage.
   */
  private async streamJsonl(proc: Subprocess): Promise<{
    sessionId: string | null
    lastResult: string | null
    tokens: { input: number; output: number } | undefined
  }> {
    let sessionId: string | null = null
    let lastResult: string | null = null
    let tokens: { input: number; output: number } | undefined

    const stdout = proc.stdout
    if (!stdout || typeof stdout === 'number') return { sessionId, lastResult, tokens }

    await streamLines(stdout as ReadableStream<Uint8Array>, (line) => {
      try {
        const event: ClaudeStreamEvent = JSON.parse(line)
        const result = this.handleClaudeEvent(event)
        if (result.sessionId) sessionId = result.sessionId
        if (result.resultText) lastResult = result.resultText
        if (result.tokens) tokens = result.tokens
      } catch {
        console.warn('[claude-code] skipping malformed JSONL line:', line.slice(0, 100))
      }
    })

    return { sessionId, lastResult, tokens }
  }

  /**
   * Handle a single Claude stream-json event.
   * Maps to WorkerEvents and extracts session/result data.
   */
  private handleClaudeEvent(event: ClaudeStreamEvent): {
    sessionId?: string
    resultText?: string
    tokens?: { input: number; output: number }
  } {
    switch (event.type) {
      case 'system': {
        if (event.subtype === 'init' && event.session_id) {
          const model = event.model ? ` (model: ${event.model})` : ''
          this.emit({ type: 'progress', summary: `Claude Code initialized${model}` })
          return { sessionId: event.session_id }
        }
        return {}
      }

      case 'assistant': {
        const content = event.message?.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              this.emit({ type: 'progress', summary: truncate(block.text) })
            } else if (block.type === 'tool_use' && block.name) {
              this.emit({ type: 'tool_use', summary: block.name })
            }
          }
        }
        return {}
      }

      case 'result': {
        if (event.subtype === 'error') {
          this.emit({ type: 'error', summary: event.error ?? 'Claude Code result error' })
          return {}
        }
        // subtype === 'success'
        const resultTokens = event.usage
          ? { input: event.usage.input_tokens ?? 0, output: event.usage.output_tokens ?? 0 }
          : undefined
        return {
          resultText: event.result ?? undefined,
          sessionId: event.session_id ?? undefined,
          tokens: resultTokens,
        }
      }

      default:
        return {}
    }
  }

  private emit(event: WorkerEvent): void {
    this.eventHandler?.(event)
  }
}

// ─── Claude stream-json event types (minimal, for parsing) ───────────────

interface ClaudeStreamEvent {
  type: string
  subtype?: string
  session_id?: string
  model?: string
  tools?: unknown[]
  message?: {
    content?: Array<{
      type?: string
      text?: string
      name?: string
    }>
  }
  result?: string
  error?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}
