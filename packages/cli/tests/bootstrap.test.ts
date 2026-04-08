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

	it('claude-code surface mentions MCP setup with real package', async () => {
		const output = await runBootstrap(tempDir, ['--surface', 'claude-code'])

		expect(output).toContain('MCP')
		expect(output).toContain('.mcp.json')
		expect(output).toContain('@questpie/autopilot-mcp')
		// Must NOT contain the old fake package name
		expect(output).not.toContain('autopilot-mcp-server')
	})

	it('cli surface does not mention MCP', async () => {
		const output = await runBootstrap(tempDir, ['--surface', 'cli'])

		expect(output).not.toContain('MCP')
	})

	it('join-existing mode prints login + token-based enrollment flow', async () => {
		const output = await runBootstrap(tempDir, ['--mode', 'join-existing'])

		// Auth: login is default, setup mentioned as first-time alternative
		expect(output).toContain('autopilot auth login')
		expect(output).toContain('auth setup')
		expect(output).toContain('First-time owner')
		// Worker enrollment
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

	it('scaffolds autopilot-operator.md context file', async () => {
		await runBootstrap(tempDir)

		const operatorPath = join(tempDir, '.autopilot', 'context', 'autopilot-operator.md')
		expect(existsSync(operatorPath)).toBe(true)
		const content = readFileSync(operatorPath, 'utf-8')
		expect(content).toContain('Query vs Task')
		expect(content).toContain('/direct')
		expect(content).toContain('/build')
	})

	it('scaffolds docs/README.md', async () => {
		await runBootstrap(tempDir)

		const docsPath = join(tempDir, '.autopilot', 'docs', 'README.md')
		expect(existsSync(docsPath)).toBe(true)
		const content = readFileSync(docsPath, 'utf-8')
		expect(content).toContain('Autopilot Documentation')
		expect(content).toContain('company.yaml')
	})

	it('scaffolds direct.yaml workflow alongside chosen workflow', async () => {
		await runBootstrap(tempDir, ['--workflow', 'bounded-dev'])

		const directPath = join(tempDir, '.autopilot', 'workflows', 'direct.yaml')
		expect(existsSync(directPath)).toBe(true)
		const raw = readFileSync(directPath, 'utf-8')
		const workflow = WorkflowSchema.parse(parseYaml(raw))
		expect(workflow.id).toBe('direct')

		// Also confirm the chosen workflow exists alongside
		expect(existsSync(join(tempDir, '.autopilot', 'workflows', 'bounded-dev.yaml'))).toBe(true)
	})

	it('bounded-dev workflow has isolated_worktree workspace mode', async () => {
		await runBootstrap(tempDir, ['--workflow', 'bounded-dev'])

		const raw = readFileSync(join(tempDir, '.autopilot', 'workflows', 'bounded-dev.yaml'), 'utf-8')
		const parsed = parseYaml(raw)
		expect(parsed.workspace?.mode).toBe('isolated_worktree')
	})

	it('company.yaml includes context_hints', async () => {
		await runBootstrap(tempDir)

		const raw = readFileSync(join(tempDir, PATHS.COMPANY_CONFIG), 'utf-8')
		const parsed = parseYaml(raw)
		expect(parsed.context_hints).toBeDefined()
		expect(parsed.context_hints.specs).toBe('specs/')
		expect(parsed.context_hints.autopilot_docs).toBe('.autopilot/docs/')
	})

	it('company.yaml includes conversation_commands', async () => {
		await runBootstrap(tempDir)

		const raw = readFileSync(join(tempDir, PATHS.COMPANY_CONFIG), 'utf-8')
		const parsed = parseYaml(raw)
		expect(parsed.conversation_commands).toBeDefined()
		expect(parsed.conversation_commands.direct).toBeDefined()
		expect(parsed.conversation_commands.direct.action).toBe('task.create')
		expect(parsed.conversation_commands.direct.workflow_id).toBe('direct')
		expect(parsed.conversation_commands.build).toBeDefined()
		expect(parsed.conversation_commands.build.workflow_id).toBe('bounded-dev')
		expect(parsed.conversation_commands.task).toBeDefined()
	})

	it('conversation_commands validate against CompanyScopeSchema', async () => {
		await runBootstrap(tempDir)

		const raw = readFileSync(join(tempDir, PATHS.COMPANY_CONFIG), 'utf-8')
		const config = CompanyScopeSchema.parse(parseYaml(raw))
		expect(config.conversation_commands.direct).toBeDefined()
		expect(config.conversation_commands.direct.action).toBe('task.create')
		expect(config.conversation_commands.build.type).toBe('feature')
	})

	it('custom runtime is reflected in company.yaml', async () => {
		await runBootstrap(tempDir, ['--runtime', 'codex'])

		const raw = readFileSync(join(tempDir, PATHS.COMPANY_CONFIG), 'utf-8')
		const config = CompanyScopeSchema.parse(parseYaml(raw))
		expect(config.defaults.runtime).toBe('codex')
	})
})
