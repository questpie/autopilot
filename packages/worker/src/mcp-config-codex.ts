/**
 * MCP config writer for Codex CLI.
 *
 * Codex reads MCP servers from project-scoped `.codex/config.toml`.
 * We write the autopilot MCP server entry there.
 *
 * If a config already exists in the workspace, we back it up and restore on cleanup.
 */

import { writeFile, readFile, rm, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { McpConfigOptions } from './mcp-config'
import { resolveMcpCommand } from './mcp-config-shared'

const CONFIG_RELATIVE = '.codex/config.toml'
const BACKUP_SUFFIX = '.autopilot-backup'

interface McpConfigResult {
  configPath: string
  cleanup: () => Promise<void>
}

/**
 * Generate a Codex MCP config in the run workspace.
 *
 * Writes `.codex/config.toml` with autopilot MCP server.
 * Backs up any existing config and restores on cleanup.
 */
export async function createCodexMcpConfig(
  opts: McpConfigOptions & { workDir: string },
): Promise<McpConfigResult> {
  const configPath = join(opts.workDir, CONFIG_RELATIVE)
  const backupPath = configPath + BACKUP_SUFFIX
  const configDir = dirname(configPath)
  const createdDir = !existsSync(configDir)

  // Ensure .codex/ directory exists
  await mkdir(configDir, { recursive: true })

  // Backup existing config
  let hadExisting = false
  if (existsSync(configPath)) {
    hadExisting = true
    const existing = await readFile(configPath, 'utf-8')
    await writeFile(backupPath, existing)
  }

  // Resolve MCP server command
  const { command, args } = resolveMcpCommand(opts.mcpBinaryPath)

  // Write TOML config
  const toml = buildToml(command, args, {
    AUTOPILOT_API_URL: opts.orchestratorUrl,
    AUTOPILOT_API_KEY: opts.apiKey,
  })
  await writeFile(configPath, toml)

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
          // Remove .codex/ dir only if we created it and it's now empty
          if (createdDir) {
            try {
              await rm(configDir, { recursive: false })
            } catch {
              // Directory not empty — leave it
            }
          }
        }
      } catch {
        // Best effort cleanup
      }
    },
  }
}

/**
 * Build a minimal TOML config for Codex MCP server.
 *
 * Format:
 * ```toml
 * [mcp_servers.autopilot]
 * command = "bun"
 * args = ["run", "/path/to/mcp-server/src/index.ts"]
 *
 * [mcp_servers.autopilot.env]
 * AUTOPILOT_API_URL = "http://..."
 * AUTOPILOT_API_KEY = "secret"
 * ```
 */
function buildToml(command: string, args: string[], env: Record<string, string>): string {
  const lines: string[] = []
  lines.push('[mcp_servers.autopilot]')
  lines.push(`command = ${tomlString(command)}`)
  lines.push(`args = [${args.map(tomlString).join(', ')}]`)
  lines.push('')
  lines.push('[mcp_servers.autopilot.env]')
  for (const [k, v] of Object.entries(env)) {
    lines.push(`${k} = ${tomlString(v)}`)
  }
  lines.push('')
  return lines.join('\n')
}

function tomlString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
