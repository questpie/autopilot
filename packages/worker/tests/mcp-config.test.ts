import { test, expect, describe } from 'bun:test'
import { createMcpConfig } from '../src/mcp-config'
import { readFile, access } from 'node:fs/promises'

describe('createMcpConfig', () => {
  test('generates valid MCP config file', async () => {
    const { configPath, cleanup } = await createMcpConfig({
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-api-key',
    })

    try {
      const content = await readFile(configPath, 'utf-8')
      const config = JSON.parse(content)

      expect(config.mcpServers).toBeDefined()
      expect(config.mcpServers.autopilot).toBeDefined()
      expect(config.mcpServers.autopilot.type).toBe('sse')
      expect(config.mcpServers.autopilot.url).toBe('http://localhost:7778/mcp/sse')
      expect(config.mcpServers.autopilot.headers.Authorization).toBe('Bearer test-api-key')
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
