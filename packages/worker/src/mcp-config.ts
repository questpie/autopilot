import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveMcpCommand } from './mcp-config-shared'

export interface McpConfigOptions {
  orchestratorUrl: string
  apiKey: string
  /** Path to the autopilot-mcp binary. Defaults to finding it in node_modules. */
  mcpBinaryPath?: string
}

/**
 * Generate a temporary MCP config file for Claude Code.
 * Uses stdio transport — Claude will spawn the MCP server as a child process.
 * The MCP server connects to the orchestrator over HTTP.
 */
export async function createMcpConfig(opts: McpConfigOptions): Promise<{
  configPath: string
  tmpDir: string
  cleanup: () => Promise<void>
}> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'autopilot-mcp-'))
  const configPath = join(tmpDir, 'mcp.json')

  // Resolve MCP server binary path
  const { command: mcpBinary, args: mcpArgs } = resolveMcpCommand(opts.mcpBinaryPath)

  const config = {
    mcpServers: {
      autopilot: {
        type: 'stdio' as const,
        command: mcpBinary,
        args: mcpArgs,
        env: {
          AUTOPILOT_API_URL: opts.orchestratorUrl,
          AUTOPILOT_API_KEY: opts.apiKey,
        },
      },
    },
  }

  await writeFile(configPath, JSON.stringify(config, null, 2))

  return {
    configPath,
    tmpDir,
    cleanup: async () => {
      try {
        await rm(tmpDir, { recursive: true })
      } catch {
        // best effort cleanup
      }
    },
  }
}

