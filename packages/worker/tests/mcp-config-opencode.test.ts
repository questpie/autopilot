import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createOpenCodeMcpConfig } from '../src/mcp-config-opencode'

describe('createOpenCodeMcpConfig', () => {
  let workDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'opencode-mcp-test-'))
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true }).catch(() => {})
  })

  test('creates opencode.jsonc with autopilot MCP server', async () => {
    const result = await createOpenCodeMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'test-key',
      workDir,
    })

    expect(result.configPath).toBe(join(workDir, 'opencode.jsonc'))
    expect(existsSync(result.configPath)).toBe(true)

    const content = await readFile(result.configPath, 'utf-8')
    const parsed = JSON.parse(content)

    expect(parsed.$schema).toBe('https://opencode.ai/config.json')
    expect(parsed.mcp.autopilot.type).toBe('local')
    expect(parsed.mcp.autopilot.command).toBeInstanceOf(Array)
    expect(parsed.mcp.autopilot.command[0]).toBe('bun')
    expect(parsed.mcp.autopilot.environment.AUTOPILOT_API_URL).toBe('http://localhost:4800')
    expect(parsed.mcp.autopilot.environment.AUTOPILOT_API_KEY).toBe('test-key')

    await result.cleanup()
  })

  test('cleanup removes config when none existed before', async () => {
    const result = await createOpenCodeMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'test-key',
      workDir,
    })

    expect(existsSync(result.configPath)).toBe(true)
    await result.cleanup()
    expect(existsSync(result.configPath)).toBe(false)
  })

  test('backs up existing config and restores on cleanup', async () => {
    const configPath = join(workDir, 'opencode.jsonc')
    const originalContent = '{ "model": "anthropic/claude-sonnet-4-5" }\n'
    await writeFile(configPath, originalContent)

    const result = await createOpenCodeMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'test-key',
      workDir,
    })

    // Should have overwritten with MCP config
    const mcpContent = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(mcpContent)
    expect(parsed.mcp).toBeDefined()

    // Backup should exist
    expect(existsSync(configPath + '.autopilot-backup')).toBe(true)

    // Cleanup should restore original
    await result.cleanup()
    const restored = await readFile(configPath, 'utf-8')
    expect(restored).toBe(originalContent)
    expect(existsSync(configPath + '.autopilot-backup')).toBe(false)
  })

  test('uses custom mcpBinaryPath when provided', async () => {
    const result = await createOpenCodeMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'test-key',
      mcpBinaryPath: '/custom/mcp-binary',
      workDir,
    })

    const content = await readFile(result.configPath, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed.mcp.autopilot.command).toEqual(['/custom/mcp-binary'])

    await result.cleanup()
  })

  test('config uses correct OpenCode format (not Claude format)', async () => {
    const result = await createOpenCodeMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'test-key',
      workDir,
    })

    const content = await readFile(result.configPath, 'utf-8')
    const parsed = JSON.parse(content)

    // OpenCode uses "mcp" not "mcpServers"
    expect(parsed.mcpServers).toBeUndefined()
    expect(parsed.mcp).toBeDefined()

    // OpenCode uses "local" not "stdio"
    expect(parsed.mcp.autopilot.type).toBe('local')

    // OpenCode uses "environment" not "env"
    expect(parsed.mcp.autopilot.env).toBeUndefined()
    expect(parsed.mcp.autopilot.environment).toBeDefined()

    // OpenCode uses command as array
    expect(Array.isArray(parsed.mcp.autopilot.command)).toBe(true)

    await result.cleanup()
  })
})
