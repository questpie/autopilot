import { createMcpConfig } from '../mcp-config'
import type { RuntimeAdapter, RunContext, RuntimeResult, WorkerEvent } from './adapter'

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
  private subprocess: ReturnType<typeof Bun.spawn> | null = null
  private config: ClaudeCodeConfig

  constructor(config?: ClaudeCodeConfig) {
    this.config = config ?? {}
  }

  onEvent(handler: (event: WorkerEvent) => void): void {
    this.eventHandler = handler
  }

  async start(context: RunContext): Promise<RuntimeResult | undefined> {
    const prompt = this.buildPrompt(context)
    const binaryPath = this.config.binaryPath ?? 'claude'
    const persistence = this.config.sessionPersistence ?? 'local'
    const isResume = !!context.runtimeSessionRef

    const args: string[] = ['--bare']

    // Resume vs fresh run
    if (isResume) {
      args.push('--resume', context.runtimeSessionRef!)
    }

    args.push('-p', prompt, '--output-format', 'json')

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

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()

      const exitCode = await proc.exited
      this.subprocess = null

      if (exitCode !== 0) {
        const errorMsg = stderr.trim() || `Claude exited with code ${exitCode}`
        this.emit({ type: 'error', summary: errorMsg })
        throw new Error(errorMsg)
      }

      // Parse JSON output from claude --output-format json
      let result: {
        result?: string
        session_id?: string
        usage?: { input_tokens?: number; output_tokens?: number }
      }
      try {
        result = JSON.parse(stdout)
      } catch {
        // If not valid JSON, treat stdout as plain text result
        result = { result: stdout.trim() }
      }

      this.emit({ type: 'progress', summary: 'Claude Code completed' })

      return {
        summary: result.result ?? stdout.trim(),
        tokens: result.usage
          ? {
              input: result.usage.input_tokens ?? 0,
              output: result.usage.output_tokens ?? 0,
            }
          : undefined,
        sessionId: persistence === 'local' ? result.session_id : undefined,
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

  private buildPrompt(context: RunContext): string {
    const parts: string[] = []

    if (context.taskTitle) {
      parts.push(`# Task: ${context.taskTitle}`)
    }
    if (context.taskDescription) {
      parts.push(context.taskDescription)
    }
    if (context.instructions) {
      parts.push(`## Instructions\n${context.instructions}`)
    }

    if (parts.length === 0) {
      parts.push(`Execute run ${context.runId} for agent ${context.agentId}`)
    }

    return parts.join('\n\n')
  }

  private emit(event: WorkerEvent): void {
    this.eventHandler?.(event)
  }
}
