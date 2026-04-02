import { test, expect, describe } from 'bun:test'
import { createMcpConfig } from '../src/mcp-config'
import { readFile, access } from 'node:fs/promises'

describe('createMcpConfig', () => {
  test('generates valid stdio MCP config file', async () => {
    const { configPath, cleanup } = await createMcpConfig({
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-api-key',
      mcpBinaryPath: '/usr/local/bin/fake-mcp',
    })

    try {
      const content = await readFile(configPath, 'utf-8')
      const config = JSON.parse(content)

      expect(config.mcpServers).toBeDefined()
      expect(config.mcpServers.autopilot).toBeDefined()
      expect(config.mcpServers.autopilot.type).toBe('stdio')
      expect(config.mcpServers.autopilot.command).toBe('/usr/local/bin/fake-mcp')
      expect(config.mcpServers.autopilot.args).toEqual([])
      expect(config.mcpServers.autopilot.env.AUTOPILOT_API_URL).toBe('http://localhost:7778')
      expect(config.mcpServers.autopilot.env.AUTOPILOT_API_KEY).toBe('test-api-key')
    } finally {
      await cleanup()
    }
  })

  test('uses bun + resolved entry when no mcpBinaryPath given', async () => {
    const { configPath, cleanup } = await createMcpConfig({
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
    })

    try {
      const content = await readFile(configPath, 'utf-8')
      const config = JSON.parse(content)

      expect(config.mcpServers.autopilot.type).toBe('stdio')
      expect(config.mcpServers.autopilot.command).toBe('bun')
      expect(config.mcpServers.autopilot.args[0]).toBe('run')
      // The second arg should be the resolved mcp-server entry path
      expect(config.mcpServers.autopilot.args[1]).toContain('mcp-server')
    } finally {
      await cleanup()
    }
  })

  test('cleanup removes temp directory', async () => {
    const { configPath, cleanup } = await createMcpConfig({
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
    })

    await cleanup()

    // File should no longer exist
    await expect(access(configPath)).rejects.toThrow()
  })
})
