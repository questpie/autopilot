import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export interface McpConfigOptions {
  orchestratorUrl: string
  apiKey: string
}

/**
 * Generate a temporary MCP config file for Claude Code.
 * Points Claude at the orchestrator's MCP server so it can use
 * task, search, and file tools.
 *
 * Returns the path to the config file and a cleanup function.
 */
export async function createMcpConfig(opts: McpConfigOptions): Promise<{
  configPath: string
  cleanup: () => Promise<void>
}> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'autopilot-mcp-'))
  const configPath = join(tmpDir, 'mcp.json')

  const config = {
    mcpServers: {
      autopilot: {
        type: 'sse' as const,
        url: `${opts.orchestratorUrl}/mcp/sse`,
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
        },
      },
    },
  }

  await writeFile(configPath, JSON.stringify(config, null, 2))

  return {
    configPath,
    cleanup: async () => {
      try {
        await rm(tmpDir, { recursive: true })
      } catch {
        // best effort cleanup
      }
    },
  }
}
