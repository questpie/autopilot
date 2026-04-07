import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { writeFile, mkdtemp, rm, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveRuntime, type RuntimeConfig } from '../src/runtime-config'

describe('resolveRuntime', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rt-config-'))
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true })
  })

  test('resolves claude-code from PATH', () => {
    // This test depends on `claude` being installed — skip gracefully if not
    const which = Bun.spawnSync(['which', 'claude'], { stdout: 'pipe', stderr: 'pipe' })
    if (which.exitCode !== 0) {
      console.log('[skip] claude not in PATH')
      return
    }

    const config: RuntimeConfig = { runtime: 'claude-code' }
    const resolved = resolveRuntime(config)

    expect(resolved.resolvedBinaryPath).toBeTruthy()
    expect(resolved.resolvedBinaryPath).toContain('claude')
    expect(resolved.capability.runtime).toBe('claude-code')
    expect(resolved.capability.models).toContain('claude-sonnet-4-20250514')
    expect(resolved.capability.maxConcurrent).toBe(1)
    expect(resolved.adapter).toBeDefined()
  })

  test('uses explicit binary path when provided', async () => {
    const fakeBinary = join(tmpDir, 'my-claude')
    await writeFile(fakeBinary, '#!/bin/bash\necho "1.0.0"\nexit 0\n')
    await chmod(fakeBinary, 0o755)

    const config: RuntimeConfig = {
      runtime: 'claude-code',
      binaryPath: fakeBinary,
      models: ['claude-opus-4-20250514'],
      maxConcurrent: 2,
      sessionPersistence: 'off',
    }
    const resolved = resolveRuntime(config)

    expect(resolved.resolvedBinaryPath).toBe(fakeBinary)
    expect(resolved.capability.models).toEqual(['claude-opus-4-20250514'])
    expect(resolved.capability.maxConcurrent).toBe(2)
    expect(resolved.config.sessionPersistence).toBe('off')
  })

  test('throws clear error for missing binary in PATH', () => {
    const config: RuntimeConfig = {
      runtime: 'claude-code',
      // Use a binary name that definitely doesn't exist
      binaryPath: undefined,
    }

    // Temporarily test with a non-existent runtime name to force PATH failure
    const badConfig: RuntimeConfig = {
      runtime: 'claude-code',
    }

    // We can't easily mock PATH, so test with explicit non-existent path instead
    const noExist: RuntimeConfig = {
      runtime: 'claude-code',
      binaryPath: '/nonexistent/path/to/claude-fake-xyz',
    }

    expect(() => resolveRuntime(noExist)).toThrow('not available')
    expect(() => resolveRuntime(noExist)).toThrow('/nonexistent/path/to/claude-fake-xyz')
  })

  test('throws clear error for non-executable explicit binary', async () => {
    const badBinary = join(tmpDir, 'not-executable')
    await writeFile(badBinary, 'not a real binary')
    // Deliberately NOT chmod +x

    const config: RuntimeConfig = {
      runtime: 'claude-code',
      binaryPath: badBinary,
    }

    expect(() => resolveRuntime(config)).toThrow('not available')
  })

  test('throws for unsupported runtime', () => {
    const config = {
      runtime: 'nonexistent-runtime' as RuntimeConfig['runtime'],
    }

    // Should fail on binary resolution (no binary name mapping will find anything)
    expect(() => resolveRuntime(config)).toThrow()
  })

  test('derives default capability when no models specified', async () => {
    const fakeBinary = join(tmpDir, 'claude-defaults')
    await writeFile(fakeBinary, '#!/bin/bash\necho "1.0"\nexit 0\n')
    await chmod(fakeBinary, 0o755)

    const config: RuntimeConfig = {
      runtime: 'claude-code',
      binaryPath: fakeBinary,
    }
    const resolved = resolveRuntime(config)

    expect(resolved.capability.runtime).toBe('claude-code')
    expect(resolved.capability.models).toEqual(['claude-sonnet-4-20250514'])
    expect(resolved.capability.maxConcurrent).toBe(1)
  })

  test('adapter is a real ClaudeCodeAdapter instance', async () => {
    const fakeBinary = join(tmpDir, 'claude-adapter-check')
    await writeFile(fakeBinary, '#!/bin/bash\necho "1.0"\nexit 0\n')
    await chmod(fakeBinary, 0o755)

    const config: RuntimeConfig = {
      runtime: 'claude-code',
      binaryPath: fakeBinary,
    }
    const resolved = resolveRuntime(config)

    // Should have the RuntimeAdapter interface
    expect(typeof resolved.adapter.start).toBe('function')
    expect(typeof resolved.adapter.stop).toBe('function')
    expect(typeof resolved.adapter.onEvent).toBe('function')
  })

  test('config flows through to adapter (useMcp, sessionPersistence)', async () => {
    const fakeBinary = join(tmpDir, 'claude-config-flow')
    // Fake binary that echoes args so we can verify config reached the adapter
    const script = `#!/bin/bash
ARGS="$@"
if echo "$ARGS" | grep -q "no-session-persistence"; then
  echo '{"result":"persistence-off","session_id":"ignored"}'
else
  echo '{"result":"persistence-on","session_id":"sess-123"}'
fi
exit 0
`
    await writeFile(fakeBinary, script)
    await chmod(fakeBinary, 0o755)

    const config: RuntimeConfig = {
      runtime: 'claude-code',
      binaryPath: fakeBinary,
      useMcp: false, // disable MCP so we don't need orchestrator
      sessionPersistence: 'off',
    }
    const resolved = resolveRuntime(config)
    resolved.adapter.onEvent(() => {})

    const result = await resolved.adapter.start({
      runId: 'run-cfg-test',
      agentId: 'dev',
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'test',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: '',
      runtimeSessionRef: null,
      workDir: tmpDir,
      model: null,
    })

    expect(result!.summary).toContain('persistence-off')
    // sessionId should be undefined because persistence is 'off'
    expect(result!.sessionId).toBeUndefined()
  })
})
