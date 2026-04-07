import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { writeFile, mkdtemp, rm, readFile, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ClaudeCodeAdapter } from '../src/runtimes/claude-code'
import type { RunContext } from '../src/runtimes/adapter'

describe('MCP-wired Claude runtime', () => {
  let tmpDir: string
  let fakeBinaryPath: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mcp-wire-test-'))
    fakeBinaryPath = join(tmpDir, 'claude')

    // Fake claude binary that captures args to a file and outputs stream-json
    const argsFile = join(tmpDir, 'captured-args.txt')
    const script = `#!/bin/bash
# Capture all args to file for test verification
echo "$@" > "${argsFile}"

# Output as stream-json JSONL (simple result)
echo '{"type":"result","subtype":"success","result":"ok","usage":{"input_tokens":10,"output_tokens":5}}'
exit 0
`
    await writeFile(fakeBinaryPath, script)
    await chmod(fakeBinaryPath, 0o755)
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true })
  })

  test('passes --mcp-config and --strict-mcp-config when useMcp=true', async () => {
    const fakeMcpBinary = join(tmpDir, 'fake-mcp')
    await writeFile(fakeMcpBinary, '#!/bin/bash\necho "fake mcp"')
    await chmod(fakeMcpBinary, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: fakeBinaryPath,
      workDir: tmpDir,
      useMcp: true,
      mcpBinaryPath: fakeMcpBinary,
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-mcp-test',
      agentId: 'developer',
      taskId: null,
      taskTitle: 'Test MCP wiring',
      taskDescription: null,
      instructions: 'Verify MCP config is passed',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key-123',
      runtimeSessionRef: null,
      workDir: null,
      model: null,
    }

    await adapter.start(context)

    // Verify --mcp-config was in captured args
    const argsFile = join(tmpDir, 'captured-args.txt')
    const capturedArgs = await Bun.file(argsFile).text()
    expect(capturedArgs).toContain('--mcp-config')
    expect(capturedArgs).toContain('--strict-mcp-config')
    expect(capturedArgs).toContain('--allowedTools')
  })

  test('does NOT pass --mcp-config when useMcp=false', async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: fakeBinaryPath,
      workDir: tmpDir,
      useMcp: false,
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-no-mcp',
      agentId: 'developer',
      taskId: null,
      taskTitle: 'No MCP',
      taskDescription: null,
      instructions: null,
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      model: null,
    }

    await adapter.start(context)

    const argsFile = join(tmpDir, 'captured-args.txt')
    const capturedArgs = await Bun.file(argsFile).text()
    expect(capturedArgs).not.toContain('--mcp-config')
    expect(capturedArgs).not.toContain('--strict-mcp-config')
  })

  test('MCP config contains correct orchestrator URL and transport', async () => {
    const { createMcpConfig } = await import('../src/mcp-config')

    const fakeMcpBinary = join(tmpDir, 'fake-mcp-2')
    await writeFile(fakeMcpBinary, '#!/bin/bash\necho "fake"')
    await chmod(fakeMcpBinary, 0o755)

    const { configPath, cleanup } = await createMcpConfig({
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'secret-key',
      mcpBinaryPath: fakeMcpBinary,
    })

    try {
      const content = JSON.parse(await readFile(configPath, 'utf-8'))

      // Verify stdio transport
      expect(content.mcpServers.autopilot.type).toBe('stdio')
      expect(content.mcpServers.autopilot.command).toBe(fakeMcpBinary)

      // Verify env vars passed to MCP server
      expect(content.mcpServers.autopilot.env.AUTOPILOT_API_URL).toBe('http://localhost:7778')
      expect(content.mcpServers.autopilot.env.AUTOPILOT_API_KEY).toBe('secret-key')
    } finally {
      await cleanup()
    }
  })
})
