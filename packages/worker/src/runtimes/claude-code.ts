import type { RuntimeAdapter, RunContext, RuntimeResult, WorkerEvent } from './adapter'

/**
 * Claude Code runtime adapter.
 * Spawns the `claude` CLI as a subprocess, feeds it MCP config + instructions,
 * captures NDJSON output, and normalizes to WorkerEvents.
 */
export class ClaudeCodeAdapter implements RuntimeAdapter {
  private eventHandler: ((event: WorkerEvent) => void) | null = null
  private process: import('bun').Subprocess | null = null

  onEvent(handler: (event: WorkerEvent) => void): void {
    this.eventHandler = handler
  }

  async start(context: RunContext): Promise<RuntimeResult | undefined> {
    // TODO: Implement Claude Code CLI spawning
    // 1. Generate MCP config JSON pointing to orchestrator
    // 2. Spawn: claude --mcp-config <path> --message <instructions>
    // 3. Tail NDJSON output
    // 4. Normalize each line to WorkerEvent
    // 5. Return summary when process exits

    this.emit({ type: 'progress', summary: 'Claude Code adapter not yet implemented' })

    return { summary: 'Claude Code adapter stub — not yet implemented' }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }

  private emit(event: WorkerEvent): void {
    this.eventHandler?.(event)
  }
}
