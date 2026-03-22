import { describe, expect, test } from 'bun:test'
import { ZodError } from 'zod'
import {
	AgentMemorySchema,
	AgentSchema,
	AgentsFileSchema,
	ApprovalGateSchema,
	CompanySchema,
	DashboardGroupsFileSchema,
	HumanSchema,
	HumansFileSchema,
	MessageSchema,
	PinSchema,
	ScheduleSchema,
	SchedulesFileSchema,
	SecretSchema,
	SessionMetaSchema,
	StreamChunkSchema,
	TaskSchema,
	ThresholdSchema,
	WatcherSchema,
	WebhookSchema,
	WebhooksFileSchema,
	WorkflowSchema,
} from '../src/schemas'

describe('CompanySchema', () => {
	const valid = {
		name: 'QUESTPIE s.r.o.',
		slug: 'questpie',
		description: 'AI company',
		owner: { name: 'Dominik', email: 'dominik@questpie.com' },
	}

	test('parses valid data', () => {
		const result = CompanySchema.parse(valid)
		expect(result.name).toBe('QUESTPIE s.r.o.')
		expect(result.slug).toBe('questpie')
	})

	test('applies defaults', () => {
		const result = CompanySchema.parse(valid)
		expect(result.timezone).toBe('UTC')
		expect(result.language).toBe('en')
		expect(result.settings.max_concurrent_agents).toBe(6)
		expect(result.settings.auto_assign).toBe(true)
		expect(result.settings.agent_model).toBe('claude-sonnet-4-20250514')
	})

	test('rejects invalid slug', () => {
		expect(() =>
			CompanySchema.parse({ ...valid, slug: 'Has Spaces' }),
		).toThrow(ZodError)
	})

	test('rejects missing name', () => {
		const { name, ...rest } = valid
		expect(() => CompanySchema.parse(rest)).toThrow(ZodError)
	})

	test('rejects invalid owner email', () => {
		expect(() =>
			CompanySchema.parse({
				...valid,
				owner: { name: 'Dominik', email: 'not-email' },
			}),
		).toThrow(ZodError)
	})
})

describe('AgentSchema', () => {
	const valid = {
		id: 'peter',
		name: 'Peter',
		role: 'developer',
		description: 'Writes code',
		fs_scope: { read: ['/projects'], write: ['/projects/*/code'] },
	}

	test('parses valid data', () => {
		const result = AgentSchema.parse(valid)
		expect(result.id).toBe('peter')
		expect(result.role).toBe('developer')
	})

	test('applies defaults', () => {
		const result = AgentSchema.parse(valid)
		expect(result.model).toBe('claude-sonnet-4-20250514')
		expect(result.tools).toEqual(['fs', 'terminal'])
		expect(result.mcps).toEqual([])
		expect(result.triggers).toEqual([])
	})

	test('rejects invalid role', () => {
		expect(() =>
			AgentSchema.parse({ ...valid, role: 'hacker' }),
		).toThrow(ZodError)
	})

	test('rejects invalid id format', () => {
		expect(() =>
			AgentSchema.parse({ ...valid, id: 'Has Spaces' }),
		).toThrow(ZodError)
	})

	test('rejects missing fs_scope', () => {
		const { fs_scope, ...rest } = valid
		expect(() => AgentSchema.parse(rest)).toThrow(ZodError)
	})
})

describe('AgentsFileSchema', () => {
	test('parses agents array', () => {
		const result = AgentsFileSchema.parse({
			agents: [
				{
					id: 'peter',
					name: 'Peter',
					role: 'developer',
					description: 'Dev',
					fs_scope: { read: ['/p'], write: ['/p'] },
				},
			],
		})
		expect(result.agents).toHaveLength(1)
	})
})

describe('TaskSchema', () => {
	const valid = {
		id: 'task-001',
		title: 'Build landing page',
		type: 'implementation',
		status: 'in_progress',
		created_by: 'ceo',
		created_at: '2026-03-22T10:00:00Z',
		updated_at: '2026-03-22T10:00:00Z',
	}

	test('parses valid data', () => {
		const result = TaskSchema.parse(valid)
		expect(result.id).toBe('task-001')
		expect(result.status).toBe('in_progress')
	})

	test('applies defaults', () => {
		const result = TaskSchema.parse(valid)
		expect(result.priority).toBe('medium')
		expect(result.description).toBe('')
		expect(result.reviewers).toEqual([])
		expect(result.depends_on).toEqual([])
		expect(result.blocks).toEqual([])
		expect(result.blockers).toEqual([])
		expect(result.history).toEqual([])
		expect(result.parent).toBeNull()
	})

	test('rejects invalid status', () => {
		expect(() =>
			TaskSchema.parse({ ...valid, status: 'running' }),
		).toThrow(ZodError)
	})

	test('rejects invalid priority', () => {
		expect(() =>
			TaskSchema.parse({ ...valid, priority: 'urgent' }),
		).toThrow(ZodError)
	})

	test('rejects invalid type', () => {
		expect(() =>
			TaskSchema.parse({ ...valid, type: 'unknown' }),
		).toThrow(ZodError)
	})

	test('accepts all valid statuses', () => {
		for (const status of ['draft', 'backlog', 'assigned', 'in_progress', 'review', 'blocked', 'done', 'cancelled']) {
			expect(() => TaskSchema.parse({ ...valid, status })).not.toThrow()
		}
	})
})

describe('MessageSchema', () => {
	test('parses valid message', () => {
		const result = MessageSchema.parse({
			id: 'msg-001',
			from: 'peter',
			at: '2026-03-22T10:00:00Z',
			content: 'PR #47 ready for review',
		})
		expect(result.id).toBe('msg-001')
		expect(result.mentions).toEqual([])
		expect(result.external).toBe(false)
		expect(result.thread).toBeNull()
	})

	test('parses channel message', () => {
		const result = MessageSchema.parse({
			id: 'msg-002',
			from: 'peter',
			channel: 'dev',
			at: '2026-03-22T10:00:00Z',
			content: 'Working on feature',
			mentions: ['marek'],
		})
		expect(result.channel).toBe('dev')
		expect(result.mentions).toEqual(['marek'])
	})
})

describe('WorkflowSchema', () => {
	const valid = {
		id: 'development',
		name: 'Development',
		steps: [
			{ id: 'scope', assigned_role: 'strategist', transitions: { done: 'plan' } },
			{ id: 'plan', assigned_role: 'planner', transitions: { done: 'implement' } },
			{ id: 'implement', type: 'terminal' as const },
		],
	}

	test('parses valid workflow', () => {
		const result = WorkflowSchema.parse(valid)
		expect(result.id).toBe('development')
		expect(result.steps).toHaveLength(3)
	})

	test('applies defaults', () => {
		const result = WorkflowSchema.parse(valid)
		expect(result.version).toBe(1)
		expect(result.description).toBe('')
		expect(result.changelog).toEqual([])
	})

	test('step defaults', () => {
		const result = WorkflowSchema.parse(valid)
		expect(result.steps[0]?.type).toBe('agent')
		expect(result.steps[0]?.auto_execute).toBe(false)
	})

	test('human gate step', () => {
		const result = WorkflowSchema.parse({
			id: 'test',
			name: 'Test',
			steps: [
				{ id: 'approve', type: 'human_gate', gate: 'merge', transitions: { approved: 'done' } },
				{ id: 'done', type: 'terminal' },
			],
		})
		expect(result.steps[0]?.type).toBe('human_gate')
		expect(result.steps[0]?.gate).toBe('merge')
	})
})

describe('ScheduleSchema', () => {
	test('parses valid schedule', () => {
		const result = ScheduleSchema.parse({
			id: 'health-check',
			agent: 'ops',
			cron: '*/5 * * * *',
		})
		expect(result.id).toBe('health-check')
		expect(result.timeout).toBe('5m')
		expect(result.on_failure).toBe('alert_human')
		expect(result.enabled).toBe(true)
	})
})

describe('WebhookSchema', () => {
	test('parses valid webhook', () => {
		const result = WebhookSchema.parse({
			id: 'uptime',
			path: '/uptime',
			agent: 'ops',
			action: { type: 'spawn_agent' },
		})
		expect(result.auth).toBe('hmac_sha256')
		expect(result.enabled).toBe(true)
	})

	test('parses with task condition', () => {
		const result = WebhookSchema.parse({
			id: 'sentry',
			path: '/sentry',
			agent: 'peter',
			action: { type: 'create_task' },
			create_task_if: {
				condition: "issue.level == 'fatal'",
				task_template: { workflow: 'incident' },
			},
		})
		expect(result.create_task_if?.condition).toBe("issue.level == 'fatal'")
	})
})

describe('WatcherSchema', () => {
	test('parses valid watcher', () => {
		const result = WatcherSchema.parse({
			id: 'code-watch',
			agent: 'peter',
			watch: '/projects/*/code',
			events: ['modify'],
		})
		expect(result.debounce).toBe('10s')
		expect(result.enabled).toBe(true)
	})

	test('rejects invalid event', () => {
		expect(() =>
			WatcherSchema.parse({
				id: 'w',
				agent: 'a',
				watch: '/x',
				events: ['rename'],
			}),
		).toThrow(ZodError)
	})
})

describe('ThresholdSchema', () => {
	test('parses valid threshold', () => {
		const result = ThresholdSchema.parse({
			id: 'cpu-alert',
			agent: 'ops',
			metric: 'cpu_usage',
			condition: '> 80',
			action: 'alert_human',
		})
		expect(result.cooldown).toBe('1h')
		expect(result.enabled).toBe(true)
	})
})

describe('AgentMemorySchema', () => {
	test('parses valid memory', () => {
		const result = AgentMemorySchema.parse({
			facts: {
				codebase: ['Uses TypeScript', 'Bun runtime'],
				conventions: ['Biome for formatting'],
			},
			decisions: [
				{ date: '2026-03-22', decision: 'Use Zod', reason: 'Type safety' },
			],
			mistakes: [
				{ date: '2026-03-15', what: 'Used ESLint', fix: 'Use Biome' },
			],
		})
		expect(result.facts.codebase).toHaveLength(2)
		expect(result.decisions).toHaveLength(1)
		expect(result.patterns).toEqual([])
	})

	test('applies all defaults for empty object', () => {
		const result = AgentMemorySchema.parse({})
		expect(result.facts).toEqual({})
		expect(result.decisions).toEqual([])
		expect(result.patterns).toEqual([])
		expect(result.mistakes).toEqual([])
	})
})

describe('PinSchema', () => {
	test('parses valid pin', () => {
		const result = PinSchema.parse({
			id: 'pin-001',
			group: 'alerts',
			title: 'PR #47 Approved',
			type: 'warning',
			created_by: 'marek',
			created_at: '2026-03-22T10:00:00Z',
		})
		expect(result.content).toBe('')
		expect(result.metadata).toEqual({})
	})

	test('rejects invalid pin type', () => {
		expect(() =>
			PinSchema.parse({
				id: 'p',
				group: 'g',
				title: 't',
				type: 'danger',
				created_by: 'a',
				created_at: '2026-03-22T10:00:00Z',
			}),
		).toThrow(ZodError)
	})
})

describe('SessionMetaSchema', () => {
	test('parses valid session', () => {
		const result = SessionMetaSchema.parse({
			id: 'session-001',
			agent: 'peter',
			trigger: { type: 'task_assigned', task_id: 'task-001' },
			status: 'running',
			started_at: '2026-03-22T10:00:00Z',
		})
		expect(result.token_usage.input).toBe(0)
		expect(result.token_usage.output).toBe(0)
		expect(result.tool_calls).toBe(0)
		expect(result.errors).toBe(0)
	})

	test('rejects invalid status', () => {
		expect(() =>
			SessionMetaSchema.parse({
				id: 's',
				agent: 'a',
				trigger: { type: 't' },
				status: 'paused',
				started_at: '2026-03-22T10:00:00Z',
			}),
		).toThrow(ZodError)
	})
})

describe('StreamChunkSchema', () => {
	test('parses tool_call chunk', () => {
		const result = StreamChunkSchema.parse({
			at: 1711100412000,
			type: 'tool_call',
			tool: 'write_file',
			params: { path: '/projects/studio/src/App.tsx' },
		})
		expect(result.type).toBe('tool_call')
		expect(result.tool).toBe('write_file')
	})
})

describe('SecretSchema', () => {
	test('parses valid secret', () => {
		const result = SecretSchema.parse({
			service: 'github',
			created_at: '2026-03-22T10:00:00Z',
			created_by: 'dominik',
			value: 'ghp_xxxxxxxxxxxx',
		})
		expect(result.type).toBe('api_token')
		expect(result.allowed_agents).toEqual([])
	})
})

describe('HumanSchema', () => {
	test('parses valid human', () => {
		const result = HumanSchema.parse({
			id: 'dominik',
			name: 'Dominik',
			role: 'founder',
		})
		expect(result.description).toBe('')
		expect(result.approval_scopes).toEqual([])
	})
})

describe('ApprovalGateSchema', () => {
	test('parses valid gate', () => {
		const result = ApprovalGateSchema.parse({
			gate: 'merge',
		})
		expect(result.human_required).toBe(true)
		expect(result.required_roles).toEqual([])
	})
})

describe('DashboardGroupsFileSchema', () => {
	test('parses groups', () => {
		const result = DashboardGroupsFileSchema.parse({
			groups: [
				{ id: 'alerts', title: 'Alerts', position: 0 },
				{ id: 'overview', title: 'Overview', position: 1 },
			],
		})
		expect(result.groups).toHaveLength(2)
	})
})
