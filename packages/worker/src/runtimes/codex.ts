/**
 * Codex CLI runtime adapter.
 *
 * Spawns `codex exec --json` as a subprocess, streams JSONL events from stdout,
 * and normalizes output to RuntimeResult.
 *
 * Supported modes:
 * - Fresh run: `codex exec --json --ask-for-approval never --sandbox <mode> "prompt"`
 * - Resume: `codex exec --json ... resume <thread_id> "prompt"`
 *
 * Key differences from Claude Code:
 * - Output is JSONL (newline-delimited JSON events), not a single JSON object
 * - Session ID comes from `thread.started` event's `thread_id`
 * - No max-turns equivalent
 * - Session persistence cannot be disabled
 */

import { createCodexMcpConfig } from '../mcp-config-codex'
import type { RuntimeAdapter, RunContext, RuntimeResult, WorkerEvent } from './adapter'
import { buildPrompt, extractResult, streamLines, truncate, summarizeToolInput, type Subprocess } from './shared'

export interface CodexConfig {
  /** Path to codex binary. Defaults to 'codex'. */
  binaryPath?: string
  /** Working directory for Codex execution. */
  workDir?: string
  /** If true, generate and use MCP config. */
  useMcp?: boolean
  /** Custom path to MCP server binary. */
  mcpBinaryPath?: string
  /**
   * Session persistence mode.
   * Note: Codex does not support disabling session persistence.
   * If set to 'off', a warning is logged and sessions persist anyway.
   */
  sessionPersistence?: 'local' | 'off'
  /**
   * Sandbox mode for file access control.
   * - 'read-only': no file writes
   * - 'workspace-write': writes within workspace only (default)
   * - 'danger-full-access': unrestricted file access
   */
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'
}

/**
 * Codex CLI runtime adapter.
 * Streams JSONL events from `codex exec --json` and normalizes to WorkerEvents + RuntimeResult.
 */
export class CodexAdapter implements RuntimeAdapter {
  private eventHandler: ((event: WorkerEvent) => void) | null = null
  private subprocess: Subprocess | null = null
  private config: CodexConfig

  constructor(config?: CodexConfig) {
    this.config = config ?? {}

    if (this.config.sessionPersistence === 'off') {
      console.warn(
        '[codex] sessionPersistence="off" is not supported by Codex CLI — sessions will persist locally',
      )
    }
  }

  onEvent(handler: (event: WorkerEvent) => void): void {
    this.eventHandler = handler
  }

  async start(context: RunContext): Promise<RuntimeResult | undefined> {
    const prompt = buildPrompt(context)
    const binaryPath = this.config.binaryPath ?? 'codex'
    const isResume = !!context.runtimeSessionRef
    const sandbox = this.config.sandboxMode ?? 'workspace-write'

    const args: string[] = ['exec', '--json']

    // Approval and sandbox
    args.push('--ask-for-approval', 'never')
    args.push('--sandbox', sandbox)

    // Model override (canonical model resolved by worker modelMap)
    if (context.model) {
      args.push('--model', context.model)
    }

    // Resume vs fresh
    if (isResume) {
      args.push('resume', context.runtimeSessionRef!)
    }

    // Prompt is the last positional argument
    args.push(prompt)

    // MCP config injection
    let mcpCleanup: (() => Promise<void>) | null = null
    const effectiveWorkDir = context.workDir ?? this.config.workDir ?? process.cwd()

    if (this.config.useMcp) {
      const mcp = await createCodexMcpConfig({
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
        ? `Resuming Codex session ${context.runtimeSessionRef}`
        : 'Launching Codex',
    })

    try {
      const proc = Bun.spawn([binaryPath, ...args], {
        cwd: effectiveWorkDir,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env },
      })
      this.subprocess = proc

      // Stream and parse JSONL events
      const { sessionId, lastAgentMessage, tokens } = await this.streamJsonl(proc)

      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited
      this.subprocess = null

      if (exitCode !== 0) {
        const errorMsg = stderr.trim() || `Codex exited with code ${exitCode}`
        this.emit({ type: 'error', summary: errorMsg })
        throw new Error(errorMsg)
      }

      this.emit({ type: 'progress', summary: 'Codex completed' })

      // Extract structured output from the last agent message
      if (!lastAgentMessage) {
        return { summary: 'Codex completed with no output' }
      }

      const extracted = extractResult(lastAgentMessage)

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
   * Stream JSONL events from Codex stdout.
   * Collects session ID, last agent message, and token usage.
   */
  private async streamJsonl(proc: Subprocess): Promise<{
    sessionId: string | null
    lastAgentMessage: string | null
    tokens: { input: number; output: number } | undefined
  }> {
    let sessionId: string | null = null
    let lastAgentMessage: string | null = null
    let tokens: { input: number; output: number } | undefined

    const stdout = proc.stdout
    if (!stdout || typeof stdout === 'number') return { sessionId, lastAgentMessage, tokens }

    await streamLines(stdout as ReadableStream<Uint8Array>, (line) => {
      try {
        const event = JSON.parse(line)
        const result = this.handleCodexEvent(event)
        if (result.sessionId) sessionId = result.sessionId
        if (result.agentMessage) lastAgentMessage = result.agentMessage
        if (result.tokens) tokens = result.tokens
      } catch {
        console.warn('[codex] skipping malformed JSONL line:', line.slice(0, 100))
      }
    })

    return { sessionId, lastAgentMessage, tokens }
  }

  /**
   * Handle a single Codex JSONL event.
   * Maps to WorkerEvents and extracts session/result data.
   */
  private handleCodexEvent(event: CodexEvent): {
    sessionId?: string
    agentMessage?: string
    tokens?: { input: number; output: number }
  } {
    switch (event.type) {
      case 'thread.started':
        return { sessionId: event.thread_id }

      case 'item.started': {
        const itemType = event.item?.type
        if (itemType === 'mcp_tool_call') {
          const detail = summarizeToolInput(event.item!.name ?? 'tool call', event.item!.arguments)
          this.emit({ type: 'tool_use', summary: `MCP: ${detail}` })
        } else if (itemType === 'command_execution') {
          this.emit({ type: 'tool_use', summary: `Command: ${truncate(String(event.item!.command ?? 'executing'), 150)}` })
        }
        return {}
      }

      case 'item.completed':
        if (event.item?.type === 'agent_message') {
          const content = extractAgentMessageContent(event.item)
          if (content) {
            this.emit({
              type: 'progress',
              summary: truncate(content),
            })
            return { agentMessage: content }
          }
        }
        return {}

      case 'turn.completed': {
        const usage = event.usage
        if (usage) {
          return {
            tokens: {
              input: usage.input_tokens ?? 0,
              output: usage.output_tokens ?? 0,
            },
          }
        }
        return {}
      }

      case 'turn.failed':
        this.emit({
          type: 'error',
          summary: event.error?.message ?? 'Codex turn failed',
        })
        return {}

      default:
        return {}
    }
  }

  private emit(event: WorkerEvent): void {
    this.eventHandler?.(event)
  }
}

// ─── Codex JSONL event types (minimal, for parsing) ───────────────────────

interface CodexEvent {
  type: string
  thread_id?: string
  item?: {
    type?: string
    name?: string
    command?: string
    arguments?: Record<string, unknown>
    content?: unknown
    text?: string
  }
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  error?: {
    message?: string
  }
}

/** Extract text content from an agent_message item. */
function extractAgentMessageContent(item: CodexEvent['item']): string | null {
  if (!item) return null

  // Content can be a string or an array of content blocks
  if (typeof item.content === 'string') return item.content
  if (typeof item.text === 'string') return item.text

  if (Array.isArray(item.content)) {
    const texts: string[] = []
    for (const block of item.content) {
      if (typeof block === 'object' && block !== null && 'text' in block && typeof block.text === 'string') {
        texts.push(block.text)
      }
    }
    return texts.length > 0 ? texts.join('\n') : null
  }

  return null
}
