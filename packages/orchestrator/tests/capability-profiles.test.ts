/**
 * Tests for capability profiles V1.
 *
 * Covers:
 * - CapabilityProfile schema parsing
 * - Agent and workflow step capability_profiles field
 * - Merge behavior: agent-level + step-level profiles
 * - Resolved capabilities in ClaimedRun contract
 * - No-profile backward compatibility
 * - Missing profile warns but doesn't crash
 *
 * Non-goals for V1 (documented here):
 * - Per-step skill sandboxing for every runtime
 * - Broad runtime parity
 * - Dynamic capability marketplace
 * - Auto-discovery of repo contents
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import {
	CapabilityProfileSchema,
	ResolvedCapabilitiesSchema,
	AgentSchema,
	WorkflowStepSchema,
	WorkflowSchema,
	ClaimedRunSchema,
} from '@questpie/autopilot-spec'
import type { CapabilityProfile, ResolvedCapabilities, Agent, Workflow } from '@questpie/autopilot-spec'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkerService, WorkflowEngine, SecretService } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { AppEnv, Services } from '../src/api/app'
import type { Actor } from '../src/auth/types'
import { workers as workersRoute } from '../src/api/routes/workers'

// ─── Schema Parsing ─────────────────────────────────────────────────────────

describe('CapabilityProfile Schema', () => {
	test('parses minimal profile', () => {
		const result = CapabilityProfileSchema.safeParse({ id: 'basic' })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.id).toBe('basic')
			expect(result.data.skills).toEqual([])
			expect(result.data.mcp_servers).toEqual([])
			expect(result.data.context).toEqual([])
			expect(result.data.prompts).toEqual([])
		}
	})

	test('parses full profile', () => {
		const result = CapabilityProfileSchema.safeParse({
			id: 'code-review',
			description: 'Code review capabilities',
			skills: ['lint-check', 'test-runner'],
			mcp_servers: ['autopilot', 'github'],
			context: ['coding-standards'],
			prompts: ['Always check for security issues.'],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.skills).toEqual(['lint-check', 'test-runner'])
			expect(result.data.mcp_servers).toEqual(['autopilot', 'github'])
			expect(result.data.context).toEqual(['coding-standards'])
			expect(result.data.prompts).toEqual(['Always check for security issues.'])
		}
	})

	test('rejects empty id', () => {
		const result = CapabilityProfileSchema.safeParse({ id: '' })
		expect(result.success).toBe(false)
	})
})

describe('ResolvedCapabilities Schema', () => {
	test('parses with defaults', () => {
		const result = ResolvedCapabilitiesSchema.safeParse({})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.skills).toEqual([])
			expect(result.data.mcp_servers).toEqual([])
		}
	})

	test('parses populated capabilities', () => {
		const result = ResolvedCapabilitiesSchema.safeParse({
			skills: ['a', 'b'],
			mcp_servers: ['autopilot'],
			context: ['project'],
			prompts: ['Be thorough.'],
		})
		expect(result.success).toBe(true)
	})
})

// ─── Agent & Step Schema ─────────────────────────────────────────────────────

describe('Agent capability_profiles', () => {
	test('defaults to empty array', () => {
		const result = AgentSchema.safeParse({ id: 'dev', name: 'Dev', role: 'developer' })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.capability_profiles).toEqual([])
		}
	})

	test('accepts profile references', () => {
		const result = AgentSchema.safeParse({
			id: 'dev',
			name: 'Dev',
			role: 'developer',
			capability_profiles: ['code-review', 'testing'],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.capability_profiles).toEqual(['code-review', 'testing'])
		}
	})
})

describe('WorkflowStep capability_profiles', () => {
	test('defaults to empty array', () => {
		const result = WorkflowStepSchema.safeParse({ id: 'plan', type: 'agent', agent_id: 'dev' })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.capability_profiles).toEqual([])
		}
	})

	test('accepts profile references', () => {
		const result = WorkflowStepSchema.safeParse({
			id: 'implement',
			type: 'agent',
			agent_id: 'dev',
			capability_profiles: ['testing'],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.capability_profiles).toEqual(['testing'])
		}
	})
})

// ─── Merge Behavior ─────────────────────────────────────────────────────────

describe('Capability Profile Merge', () => {
	// Simulate the merge logic from workflow-engine.resolveCapabilities
	function resolveCapabilities(
		profiles: Map<string, CapabilityProfile>,
		agentProfileIds: string[],
		stepProfileIds: string[],
	): ResolvedCapabilities | undefined {
		if (agentProfileIds.length === 0 && stepProfileIds.length === 0) return undefined

		const seen = new Set<string>()
		const profileIds: string[] = []
		for (const id of [...agentProfileIds, ...stepProfileIds]) {
			if (seen.has(id)) continue
			seen.add(id)
			profileIds.push(id)
		}

		const skills = new Set<string>()
		const mcpServers = new Set<string>()
		const context = new Set<string>()
		const prompts: string[] = []

		for (const profileId of profileIds) {
			const profile = profiles.get(profileId)
			if (!profile) continue
			for (const s of profile.skills) skills.add(s)
			for (const m of profile.mcp_servers) mcpServers.add(m)
			for (const c of profile.context) context.add(c)
			for (const p of profile.prompts) prompts.push(p)
		}

		return {
			skills: [...skills],
			mcp_servers: [...mcpServers],
			context: [...context],
			prompts,
		}
	}

	const profiles = new Map<string, CapabilityProfile>([
		['code-review', {
			id: 'code-review',
			description: '',
			skills: ['lint', 'test-runner'],
			mcp_servers: ['autopilot'],
			context: ['coding-standards'],
			prompts: ['Check for security issues.'],
		}],
		['ops', {
			id: 'ops',
			description: '',
			skills: ['deploy', 'lint'],
			mcp_servers: ['autopilot', 'infra'],
			context: ['runbooks'],
			prompts: ['Follow runbook procedures.'],
		}],
	])

	test('no profiles returns undefined', () => {
		expect(resolveCapabilities(profiles, [], [])).toBeUndefined()
	})

	test('agent-only profiles resolve correctly', () => {
		const result = resolveCapabilities(profiles, ['code-review'], [])
		expect(result).toBeDefined()
		expect(result!.skills).toEqual(['lint', 'test-runner'])
		expect(result!.mcp_servers).toEqual(['autopilot'])
	})

	test('step-only profiles resolve correctly', () => {
		const result = resolveCapabilities(profiles, [], ['ops'])
		expect(result).toBeDefined()
		expect(result!.skills).toEqual(['deploy', 'lint'])
	})

	test('step extends agent profiles (deduplicated)', () => {
		const result = resolveCapabilities(profiles, ['code-review'], ['ops'])
		expect(result).toBeDefined()
		// Skills: lint (from code-review), test-runner, deploy (from ops) — lint deduplicated
		expect(result!.skills).toEqual(['lint', 'test-runner', 'deploy'])
		// MCP: autopilot (from code-review), infra (from ops) — autopilot deduplicated
		expect(result!.mcp_servers).toEqual(['autopilot', 'infra'])
		// Context: both
		expect(result!.context).toEqual(['coding-standards', 'runbooks'])
		// Prompts: ordered, not deduplicated
		expect(result!.prompts).toEqual(['Check for security issues.', 'Follow runbook procedures.'])
	})

	test('duplicate profile IDs are deduplicated', () => {
		const result = resolveCapabilities(profiles, ['code-review'], ['code-review', 'ops'])
		expect(result).toBeDefined()
		// code-review processed once, then ops
		expect(result!.skills).toEqual(['lint', 'test-runner', 'deploy'])
		expect(result!.prompts).toHaveLength(2)
	})

	test('missing profile is silently skipped', () => {
		const result = resolveCapabilities(profiles, ['nonexistent'], ['code-review'])
		expect(result).toBeDefined()
		expect(result!.skills).toEqual(['lint', 'test-runner'])
	})
})

// ─── ClaimedRun Contract ────────────────────────────────────────────────────

describe('ClaimedRun resolved_capabilities', () => {
	test('accepts resolved_capabilities field', () => {
		const result = ClaimedRunSchema.safeParse({
			id: 'run-1',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
			resolved_capabilities: {
				skills: ['lint'],
				mcp_servers: ['autopilot'],
				context: [],
				prompts: [],
			},
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.resolved_capabilities?.skills).toEqual(['lint'])
		}
	})

	test('omitted resolved_capabilities is undefined (backward compat)', () => {
		const result = ClaimedRunSchema.safeParse({
			id: 'run-1',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.resolved_capabilities).toBeUndefined()
		}
	})
})

// ─── Workflow Schema Backward Compatibility ─────────────────────────────────

describe('Workflow backward compatibility', () => {
	test('existing workflow without capability_profiles still parses', () => {
		const result = WorkflowSchema.safeParse({
			id: 'simple',
			name: 'Simple',
			steps: [
				{ id: 'implement', type: 'agent', agent_id: 'dev' },
				{ id: 'review', type: 'human_approval', on_approve: 'done', on_reply: 'implement' },
				{ id: 'done', type: 'done' },
			],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.steps[0]!.capability_profiles).toEqual([])
		}
	})

	test('workflow with capability_profiles on step parses', () => {
		const result = WorkflowSchema.safeParse({
			id: 'enhanced',
			name: 'Enhanced',
			steps: [
				{
					id: 'implement',
					type: 'agent',
					agent_id: 'dev',
					capability_profiles: ['code-review'],
				},
				{ id: 'done', type: 'done' },
			],
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.steps[0]!.capability_profiles).toEqual(['code-review'])
		}
	})
})

// ─── Integration: workflow engine → run.targeting → claim ───────────────────

describe('Full pipeline: workflow engine → DB → claim route → response', () => {
	let testDir: string
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService
	let workerService: WorkerService
	let engine: WorkflowEngine
	let app: Hono<AppEnv>

	const capProfiles = new Map<string, CapabilityProfile>([
		['code-review', {
			id: 'code-review',
			description: 'Code review tools',
			skills: ['lint-check', 'test-runner'],
			mcp_servers: ['autopilot'],
			context: ['coding-standards'],
			prompts: ['Always check for security issues.'],
		}],
		['deploy-tools', {
			id: 'deploy-tools',
			description: 'Deployment',
			skills: ['deploy-script'],
			mcp_servers: [],
			context: [],
			prompts: ['Follow rollback procedures.'],
		}],
	])

	const agents: Agent[] = [
		{
			id: 'dev', name: 'Developer', role: 'developer', description: '',
			triggers: [], capability_profiles: ['code-review'],
		},
	]

	const workflow: Workflow = {
		id: 'cap-test',
		name: 'Capability Test',
		description: '',
		steps: [
			{
				id: 'implement',
				type: 'agent',
				agent_id: 'dev',
				instructions: 'Implement the feature',
				capability_profiles: ['deploy-tools'],
			},
			{ id: 'done', type: 'done' },
		],
	}

	const authoredConfig: AuthoredConfig = {
		company: {
			name: 'Test', slug: 'test', description: '', timezone: 'UTC',
			language: 'en', owner: { name: 'T', email: 't@t.com' },
			defaults: { runtime: 'claude-code' },
		},
		agents: new Map(agents.map((a) => [a.id, a])),
		workflows: new Map([['cap-test', workflow]]),
		environments: new Map(),
		providers: new Map(),
		capabilityProfiles: capProfiles,
		skills: new Map(),
		context: new Map(),
		defaults: { runtime: 'claude-code', workflow: 'cap-test', task_assignee: 'dev' },
	}

	beforeAll(async () => {
		testDir = join(tmpdir(), `autopilot-cap-integ-${Date.now()}`)
		await mkdir(testDir, { recursive: true })
		dbResult = await createCompanyDb(testDir)

		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
		workerService = new WorkerService(dbResult.db)
		const secretService = new SecretService(dbResult.db)

		engine = new WorkflowEngine(authoredConfig, taskService, runService)

		// Build a real Hono app with the workers route (same as production)
		const services = {
			taskService,
			runService,
			workerService,
			secretService,
			sessionMessageService: {} as any,
			workflowEngine: engine,
		} as unknown as Services

		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('companyRoot', testDir)
			c.set('db', dbResult.db)
			c.set('auth', {} as never)
			c.set('services', services)
			c.set('authoredConfig', authoredConfig)
			c.set('actor', { id: 'test', type: 'human', name: 'T', role: 'owner', source: 'api' } as Actor)
			c.set('workerId', null)
			await next()
		})
		app.route('/api/workers', workersRoute)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(testDir, { recursive: true, force: true })
	})

	function post(body: unknown): RequestInit {
		return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
	}

	test('workflow engine stores resolved_capabilities in run targeting', async () => {
		const taskId = `task-cap-${Date.now()}`
		await taskService.create({
			id: taskId,
			title: 'Test capabilities',
			type: 'feature',
			created_by: 'test',
		})

		const result = await engine.intake(taskId)
		expect(result).not.toBeNull()
		expect(result!.runId).toBeDefined()

		// Verify the DB targeting blob has resolved_capabilities
		const run = await runService.get(result!.runId!)
		expect(run!.targeting).toBeDefined()

		const targeting = JSON.parse(run!.targeting!)
		const caps = targeting.resolved_capabilities
		expect(caps.skills).toContain('lint-check')
		expect(caps.skills).toContain('test-runner')
		expect(caps.skills).toContain('deploy-script')
		expect(caps.mcp_servers).toContain('autopilot')
		expect(caps.context).toContain('coding-standards')
		expect(caps.prompts).toContain('Always check for security issues.')
		expect(caps.prompts).toContain('Follow rollback procedures.')
	})

	test('claim HTTP route extracts and delivers resolved_capabilities', async () => {
		// Register worker via HTTP
		await app.request('/api/workers/register', post({
			id: 'cap-worker',
			capabilities: [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: [] }],
		}))

		// Claim via HTTP — exercises the actual claim route + splitTargeting
		const claimRes = await app.request('/api/workers/claim', post({ worker_id: 'cap-worker' }))
		expect(claimRes.status).toBe(200)

		const body = await claimRes.json() as {
			run: {
				id: string
				resolved_capabilities?: {
					skills: string[]
					mcp_servers: string[]
					context: string[]
					prompts: string[]
				}
			} | null
			lease_id: string | null
		}

		expect(body.run).not.toBeNull()
		expect(body.run!.resolved_capabilities).toBeDefined()

		const caps = body.run!.resolved_capabilities!
		expect(caps.skills).toContain('lint-check')
		expect(caps.skills).toContain('test-runner')
		expect(caps.skills).toContain('deploy-script')
		expect(caps.mcp_servers).toContain('autopilot')
		expect(caps.prompts).toContain('Always check for security issues.')
		expect(caps.prompts).toContain('Follow rollback procedures.')
	})
})
