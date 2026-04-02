import type { RuntimeAdapter, RunContext, RuntimeResult, WorkerEvent } from './adapter'

export interface ClaudeCodeConfig {
  /** Path to claude binary. Defaults to 'claude'. */
  binaryPath?: string
  /** Working directory for Claude execution. */
  workDir?: string
  /** Max agentic turns. Defaults to 50. */
  maxTurns?: number
}

/**
 * Claude Code runtime adapter.
 * Spawns the `claude` CLI as a subprocess in bare mode,
 * captures JSON output, and normalizes to RuntimeResult.
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

    const args = [
      '--bare',
      '-p',
      prompt,
      '--output-format',
      'json',
      '--no-session-persistence',
      '--dangerously-skip-permissions',
      '--max-turns',
      String(this.config.maxTurns ?? 50),
    ]

    this.emit({ type: 'progress', summary: 'Launching Claude Code' })

    const proc = Bun.spawn([binaryPath, ...args], {
      cwd: this.config.workDir ?? process.cwd(),
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
