/**
 * Shared MCP config helpers used by all runtime-specific MCP config writers.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Resolve path to the MCP server entry point. */
export function resolveMcpServerEntry(): string {
  const candidates = [
    join(__dirname, '..', '..', 'mcp-server', 'src', 'index.ts'),
    join(__dirname, '..', '..', '..', 'packages', 'mcp-server', 'src', 'index.ts'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return 'autopilot-mcp'
}

/** Resolve MCP command and args from optional binary path. */
export function resolveMcpCommand(mcpBinaryPath?: string): { command: string; args: string[] } {
  if (mcpBinaryPath) {
    return { command: mcpBinaryPath, args: [] }
  }
  return { command: 'bun', args: ['run', resolveMcpServerEntry()] }
}
