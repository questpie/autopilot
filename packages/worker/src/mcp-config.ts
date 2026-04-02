import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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
  const mcpBinary = opts.mcpBinaryPath ?? 'bun'
  const mcpArgs = opts.mcpBinaryPath
    ? []
    : ['run', resolveMcpServerEntry()]

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

/** Resolve path to the MCP server entry point. */
function resolveMcpServerEntry(): string {
  // Try to find the mcp-server package relative to worker
  const candidates = [
    join(__dirname, '..', '..', 'mcp-server', 'src', 'index.ts'),
    join(__dirname, '..', '..', '..', 'packages', 'mcp-server', 'src', 'index.ts'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  // Fallback — assume it's available in PATH
  return 'autopilot-mcp'
}
