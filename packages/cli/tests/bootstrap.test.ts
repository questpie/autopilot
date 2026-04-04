import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse as parseYaml } from 'yaml'
import { CompanyScopeSchema, ProjectScopeSchema, AgentSchema, WorkflowSchema, PATHS } from '@questpie/autopilot-spec'

/**
 * Tests for `autopilot bootstrap` scaffolding logic.
 *
 * These tests exercise the scaffold functions directly rather than spawning
 * the CLI process, to keep tests fast and avoid interactive prompt issues.
 * The bootstrap module is structured so the scaffolding logic is testable
 * independently from the Commander action handler.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────

async function makeTempDir(prefix = 'autopilot-bootstrap-'): Promise<string> {
	return mkdtemp(join(tmpdir(), prefix))
}

/** Run a non-interactive bootstrap by invoking the CLI with --yes. */
async function runBootstrap(cwd: string, extraArgs: string[] = []): Promise<string> {
	const cliEntry = join(import.meta.dir, '..', 'bin', 'autopilot.ts')
	const proc = Bun.spawn(['bun', 'run', cliEntry, 'bootstrap', '--yes', '--cwd', cwd, ...extraArgs], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
		env: { ...process.env, NO_COLOR: '1' },
	})
	const stdout = await new Response(proc.stdout).text()
	const stderr = await new Response(proc.stderr).text()
	await proc.exited
	return stdout + stderr
}

// ─── Scaffold Tests ───────────────────────────────────────────────────────

describe('autopilot bootstrap', () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await makeTempDir()
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
	})

	it('scaffolds expected files for local-first + bounded-dev', async () => {
		await runBootstrap(tempDir)

		// Core files should exist
		expect(existsSync(join(tempDir, PATHS.COMPANY_CONFIG))).toBe(true)
		expect(existsSync(join(tempDir, PATHS.PROJECT_CONFIG))).toBe(true)
		expect(existsSync(join(tempDir, '.autopilot', 'agents', 'dev.yaml'))).toBe(true)
		expect(existsSync(join(tempDir, '.autopilot', 'workflows', 'bounded-dev.yaml'))).toBe(true)
		expect(existsSync(join(tempDir, '.autopilot', 'context', 'company.md'))).toBe(true)
		expect(existsSync(join(tempDir, '.autopilot', 'context', 'project.md'))).toBe(true)
	})

	it('company.yaml validates against schema', async () => {
		await runBootstrap(tempDir, ['--company-name', 'Test Corp', '--company-slug', 'test-corp'])

		const raw = readFileSync(join(tempDir, PATHS.COMPANY_CONFIG), 'utf-8')
		const config = CompanyScopeSchema.parse(parseYaml(raw))

		expect(config.name).toBe('Test Corp')
		expect(config.slug).toBe('test-corp')
		expect(config.defaults.runtime).toBe('claude-code')
		expect(config.defaults.workflow).toBe('bounded-dev')
		expect(config.defaults.task_assignee).toBe('dev')
	})

	it('project.yaml validates against schema', async () => {
		await runBootstrap(tempDir, ['--project-name', 'My Project'])

		const raw = readFileSync(join(tempDir, PATHS.PROJECT_CONFIG), 'utf-8')
		const config = ProjectScopeSchema.parse(parseYaml(raw))
		expect(config.name).toBe('My Project')
	})

	it('agent yaml validates against schema', async () => {
		await runBootstrap(tempDir)

		const raw = readFileSync(join(tempDir, '.autopilot', 'agents', 'dev.yaml'), 'utf-8')
		const agent = AgentSchema.parse(parseYaml(raw))
		expect(agent.id).toBe('dev')
		expect(agent.role).toBe('developer')
	})

	it('bounded-dev workflow validates against schema', async () => {
		await runBootstrap(tempDir, ['--workflow', 'bounded-dev'])

		const raw = readFileSync(join(tempDir, '.autopilot', 'workflows', 'bounded-dev.yaml'), 'utf-8')
		const workflow = WorkflowSchema.parse(parseYaml(raw))
		expect(workflow.id).toBe('bounded-dev')
		expect(workflow.steps.length).toBeGreaterThanOrEqual(3)
		expect(workflow.steps.some((s) => s.type === 'human_approval')).toBe(true)
	})

	it('simple workflow validates against schema', async () => {
		await runBootstrap(tempDir, ['--workflow', 'simple'])

		const raw = readFileSync(join(tempDir, '.autopilot', 'workflows', 'simple.yaml'), 'utf-8')
		const workflow = WorkflowSchema.parse(parseYaml(raw))
		expect(workflow.id).toBe('simple')
		expect(workflow.steps.some((s) => s.type === 'human_approval')).toBe(true)
	})

	it('does not overwrite existing authored files', async () => {
		// Pre-create company.yaml
		mkdirSync(join(tempDir, '.autopilot'), { recursive: true })
		writeFileSync(join(tempDir, PATHS.COMPANY_CONFIG), 'name: Existing\nslug: existing\n')

		await runBootstrap(tempDir)

		// Original content preserved
		const raw = readFileSync(join(tempDir, PATHS.COMPANY_CONFIG), 'utf-8')
		expect(raw).toContain('name: Existing')

		// Other files still created
		expect(existsSync(join(tempDir, PATHS.PROJECT_CONFIG))).toBe(true)
		expect(existsSync(join(tempDir, '.autopilot', 'agents', 'dev.yaml'))).toBe(true)
	})

	it('imports README.md into context', async () => {
		writeFileSync(join(tempDir, 'README.md'), '# My Awesome Project\n\nSome docs here.')

		await runBootstrap(tempDir)

		const contextPath = join(tempDir, '.autopilot', 'context', 'readme.md')
		expect(existsSync(contextPath)).toBe(true)
		expect(readFileSync(contextPath, 'utf-8')).toContain('My Awesome Project')
	})

	it('imports CLAUDE.md into context', async () => {
		writeFileSync(join(tempDir, 'CLAUDE.md'), '# Claude Instructions\n\nDo the thing.')

		await runBootstrap(tempDir)

		const contextPath = join(tempDir, '.autopilot', 'context', 'claude.md')
		expect(existsSync(contextPath)).toBe(true)
		expect(readFileSync(contextPath, 'utf-8')).toContain('Claude Instructions')
	})

	it('does not import context when --no-import-context is set', async () => {
		writeFileSync(join(tempDir, 'README.md'), '# Readme')

		await runBootstrap(tempDir, ['--no-import-context'])

		expect(existsSync(join(tempDir, '.autopilot', 'context', 'readme.md'))).toBe(false)
		// But generated context files should still exist
		expect(existsSync(join(tempDir, '.autopilot', 'context', 'company.md'))).toBe(true)
	})

	it('does not overwrite already-imported context files', async () => {
		mkdirSync(join(tempDir, '.autopilot', 'context'), { recursive: true })
		writeFileSync(join(tempDir, '.autopilot', 'context', 'readme.md'), 'custom content')
		writeFileSync(join(tempDir, 'README.md'), '# New Readme')

		await runBootstrap(tempDir)

		expect(readFileSync(join(tempDir, '.autopilot', 'context', 'readme.md'), 'utf-8')).toBe('custom content')
	})

	it('output mentions real commands with correct syntax', async () => {
		const output = await runBootstrap(tempDir)

		expect(output).toContain('autopilot sync')
		expect(output).toContain('autopilot start')
		expect(output).toContain('autopilot auth setup')
		// Task create must use real -t and --type flags
		expect(output).toContain('tasks create -t')
		expect(output).toContain('--type feature')
	})

	it('claude-code surface mentions MCP setup with real package name', async () => {
		const output = await runBootstrap(tempDir, ['--surface', 'claude-code'])

		expect(output).toContain('MCP')
		expect(output).toContain('@questpie/autopilot-mcp')
		expect(output).toContain('.mcp.json')
		// Must NOT contain the old fake package name
		expect(output).not.toContain('autopilot-mcp-server')
	})

	it('cli surface does not mention MCP', async () => {
		const output = await runBootstrap(tempDir, ['--surface', 'cli'])

		expect(output).not.toContain('MCP')
	})

	it('join-existing mode prints token-based enrollment flow', async () => {
		const output = await runBootstrap(tempDir, ['--mode', 'join-existing'])

		expect(output).toContain('autopilot auth setup')
		expect(output).toContain('worker token create')
		expect(output).toContain('--token')
		expect(output).toContain('autopilot worker start')
		// Should still create .autopilot/ directory
		expect(existsSync(join(tempDir, PATHS.AUTOPILOT_DIR))).toBe(true)
	})

	it('join-existing does not scaffold company.yaml', async () => {
		const output = await runBootstrap(tempDir, ['--mode', 'join-existing'])

		expect(existsSync(join(tempDir, PATHS.COMPANY_CONFIG))).toBe(false)
	})

	it('uses directory name as default company/project name', async () => {
		await runBootstrap(tempDir)

		const raw = readFileSync(join(tempDir, PATHS.COMPANY_CONFIG), 'utf-8')
		const config = CompanyScopeSchema.parse(parseYaml(raw))
		// The temp dir name will be used as default
		expect(config.name).toBeTruthy()
		expect(config.slug).toMatch(/^[a-z0-9-]+$/)
	})

	it('custom runtime is reflected in company.yaml', async () => {
		await runBootstrap(tempDir, ['--runtime', 'codex'])

		const raw = readFileSync(join(tempDir, PATHS.COMPANY_CONFIG), 'utf-8')
		const config = CompanyScopeSchema.parse(parseYaml(raw))
		expect(config.defaults.runtime).toBe('codex')
	})
})
