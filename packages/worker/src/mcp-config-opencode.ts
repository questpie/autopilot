/**
 * MCP config writer for OpenCode.
 *
 * OpenCode reads MCP servers from `opencode.jsonc` in the project root.
 * Format uses `"mcp"` key with `"type": "local"` and `"command"` as array.
 *
 * If a config already exists in the workspace, we back it up and restore on cleanup.
 */

import { writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { McpConfigOptions } from './mcp-config'
import { resolveMcpCommand } from './mcp-config-shared'

const CONFIG_FILENAME = 'opencode.jsonc'
const BACKUP_SUFFIX = '.autopilot-backup'

interface McpConfigResult {
  configPath: string
  cleanup: () => Promise<void>
}

/**
 * Generate an OpenCode MCP config in the run workspace.
 *
 * Writes `opencode.jsonc` with autopilot MCP server.
 * Backs up any existing config and restores on cleanup.
 */
export async function createOpenCodeMcpConfig(
  opts: McpConfigOptions & { workDir: string },
): Promise<McpConfigResult> {
  const configPath = join(opts.workDir, CONFIG_FILENAME)
  const backupPath = configPath + BACKUP_SUFFIX

  // Backup existing config
  let hadExisting = false
  if (existsSync(configPath)) {
    hadExisting = true
    const existing = await readFile(configPath, 'utf-8')
    await writeFile(backupPath, existing)
  }

  // Resolve MCP server command
  const { command, args } = resolveMcpCommand(opts.mcpBinaryPath)

  // Build env for MCP process
  const mcpEnv: Record<string, string> = {
    AUTOPILOT_API_URL: opts.orchestratorUrl,
  }
  if (opts.localDev) {
    mcpEnv.AUTOPILOT_LOCAL_DEV = 'true'
  } else {
    mcpEnv.AUTOPILOT_API_KEY = opts.apiKey
  }

  // Build config object — OpenCode format
  const config = {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      autopilot: {
        type: 'local' as const,
        command: [command, ...args],
        environment: mcpEnv,
      },
    },
  }

  await writeFile(configPath, JSON.stringify(config, null, 2))

  return {
    configPath,
    cleanup: async () => {
      try {
        if (hadExisting) {
          // Restore backup
          if (existsSync(backupPath)) {
            const backup = await readFile(backupPath, 'utf-8')
            await writeFile(configPath, backup)
            await rm(backupPath)
          }
        } else {
          // We created this config — remove it
          await rm(configPath)
        }
      } catch {
        // Best effort cleanup
      }
    },
  }
}
