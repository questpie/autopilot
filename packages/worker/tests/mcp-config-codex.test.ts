import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCodexMcpConfig } from '../src/mcp-config-codex'

describe('createCodexMcpConfig', () => {
  let workDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'codex-mcp-test-'))
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true }).catch(() => {})
  })

  test('creates .codex/config.toml with autopilot MCP server', async () => {
    const result = await createCodexMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'test-key',
      workDir,
    })

    expect(result.configPath).toBe(join(workDir, '.codex/config.toml'))
    expect(existsSync(result.configPath)).toBe(true)

    const content = await readFile(result.configPath, 'utf-8')
    expect(content).toContain('[mcp_servers.autopilot]')
    expect(content).toContain('command = "bun"')
    expect(content).toContain('[mcp_servers.autopilot.env]')
    expect(content).toContain('AUTOPILOT_API_URL = "http://localhost:4800"')
    expect(content).toContain('AUTOPILOT_API_KEY = "test-key"')

    await result.cleanup()
  })

  test('cleanup removes config when none existed before', async () => {
    const result = await createCodexMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'test-key',
      workDir,
    })

    expect(existsSync(result.configPath)).toBe(true)
    await result.cleanup()
    expect(existsSync(result.configPath)).toBe(false)
  })

  test('backs up existing config and restores on cleanup', async () => {
    const configPath = join(workDir, '.codex/config.toml')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(workDir, '.codex'), { recursive: true })

    const originalContent = '[some_other]\nkey = "value"\n'
    await writeFile(configPath, originalContent)

    const result = await createCodexMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'test-key',
      workDir,
    })

    // Should have overwritten with MCP config
    const mcpContent = await readFile(configPath, 'utf-8')
    expect(mcpContent).toContain('[mcp_servers.autopilot]')
    expect(mcpContent).not.toContain('[some_other]')

    // Backup should exist
    expect(existsSync(configPath + '.autopilot-backup')).toBe(true)

    // Cleanup should restore original
    await result.cleanup()
    const restored = await readFile(configPath, 'utf-8')
    expect(restored).toBe(originalContent)
    expect(existsSync(configPath + '.autopilot-backup')).toBe(false)
  })

  test('localDev mode sets AUTOPILOT_LOCAL_DEV instead of AUTOPILOT_API_KEY', async () => {
    const result = await createCodexMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'some-key',
      localDev: true,
      workDir,
    })

    const content = await readFile(result.configPath, 'utf-8')
    expect(content).toContain('AUTOPILOT_LOCAL_DEV = "true"')
    expect(content).not.toContain('AUTOPILOT_API_KEY')

    await result.cleanup()
  })

  test('uses custom mcpBinaryPath when provided', async () => {
    const result = await createCodexMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'test-key',
      mcpBinaryPath: '/custom/mcp-binary',
      workDir,
    })

    const content = await readFile(result.configPath, 'utf-8')
    expect(content).toContain('command = "/custom/mcp-binary"')
    expect(content).toContain('args = []')

    await result.cleanup()
  })

  test('escapes special characters in TOML strings', async () => {
    const result = await createCodexMcpConfig({
      orchestratorUrl: 'http://localhost:4800',
      apiKey: 'key-with-"quotes"-and-\\backslash',
      workDir,
    })

    const content = await readFile(result.configPath, 'utf-8')
    expect(content).toContain('AUTOPILOT_API_KEY = "key-with-\\"quotes\\"-and-\\\\backslash"')

    await result.cleanup()
  })
})
