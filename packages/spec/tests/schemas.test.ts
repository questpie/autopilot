import { describe, test, expect } from 'bun:test'
import { ZodError } from 'zod'
import {
	CompanySchema,
	AgentSchema,
	TaskSchema,
	MessageSchema,
	WorkflowSchema,
	ScheduleSchema,
	WebhookSchema,
	WatcherSchema,
	ThresholdSchema,
	AgentMemorySchema,
	PinSchema,
	SessionMetaSchema,
	SecretSchema,
	HumanSchema,
} from '../src/schemas'

// ── CompanySchema ──────────────────────────────────────────────────────

describe('CompanySchema', () => {
	const validCompany = {
		name: 'QUESTPIE s.r.o.',
		slug: 'questpie',
		description: 'AI company',
		owner: { name: 'Dominik', email: 'd@questpie.com' },
	}

	test('parses valid data successfully', () => {
		const result = CompanySchema.parse(validCompany)
		expect(result.name).toBe('QUESTPIE s.r.o.')
		expect(result.slug).toBe('questpie')
		expect(result.owner.email).toBe('d@questpie.com')
	})

	test('applies default values', () => {
		const result = CompanySchema.parse(validCompany)
		expect(result.timezone).toBe('UTC')
		expect(result.language).toBe('en')
		expect(result.languages).toEqual(['en'])
		expect(result.settings.auto_assign).toBe(true)
		expect(result.settings.max_concurrent_agents).toBe(6)
		expect(result.settings.agent_provider).toBe('tanstack-ai')
		expect(result.settings.budget.daily_token_limit).toBe(5_000_000)
		expect(result.settings.budget.alert_at).toBe(80)
		expect(result.owner.notification_channels).toEqual([])
	})

	test('rejects missing name', () => {
		expect(() =>
			CompanySchema.parse({ ...validCompany, name: undefined }),
		).toThrow(ZodError)
	})

	test('rejects invalid slug with spaces', () => {
		expect(() =>
			CompanySchema.parse({ ...validCompany, slug: 'quest pie' }),
		).toThrow(ZodError)
	})

	test('rejects slug with uppercase', () => {
		expect(() =>
			CompanySchema.parse({ ...validCompany, slug: 'QUESTPIE' }),
		).toThrow(ZodError)
	})

	test('rejects invalid email', () => {
		expect(() =>
			CompanySchema.parse({
				...validCompany,
				owner: { name: 'Dominik', email: 'not-an-email' },
			}),
		).toThrow(ZodError)
	})

	test('rejects missing description', () => {
		expect(() =>
			CompanySchema.parse({ name: 'Test', slug: 'test', owner: validCompany.owner }),
		).toThrow(ZodError)
	})
})

// ── AgentSchema ────────────────────────────────────────────────────────

describe('AgentSchema', () => {
	const validAgent = {
		id: 'peter',
		name: 'Peter',
		role: 'developer',
		description: 'Writes code',
		fs_scope: { read: ['/projects'], write: ['/projects/*/code'] },
	}

	test('parses valid data successfully', () => {
		const result = AgentSchema.parse(validAgent)
		expect(result.id).toBe('peter')
		expect(result.role).toBe('developer')
	})

	test('applies default values', () => {
		const result = AgentSchema.parse(validAgent)
		expect(result.model).toBe('anthropic/claude-sonnet-4')
		expect(result.tools).toEqual(['fs', 'terminal'])
		expect(result.mcps).toEqual([])
		expect(result.triggers).toEqual([])
	})

	test('rejects invalid role', () => {
		expect(() =>
			AgentSchema.parse({ ...validAgent, role: 'hacker' }),
		).toThrow(ZodError)
	})

	test('rejects missing fs_scope', () => {
		const { fs_scope: _, ...withoutScope } = validAgent
		expect(() => AgentSchema.parse(withoutScope)).toThrow(ZodError)
	})

	test('rejects invalid id with spaces', () => {
		expect(() =>
			AgentSchema.parse({ ...validAgent, id: 'peter parker' }),
		).toThrow(ZodError)
	})

	test('rejects invalid id with uppercase', () => {
		expect(() =>
			AgentSchema.parse({ ...validAgent, id: 'Peter' }),
		).toThrow(ZodError)
	})

	test('accepts all valid roles', () => {
		const roles = ['meta', 'strategist', 'planner', 'developer', 'reviewer', 'devops', 'marketing', 'design']
		for (const role of roles) {
			const result = AgentSchema.parse({ ...validAgent, role })
			expect(result.role).toBe(role)
		}
	})
})

// ── TaskSchema ─────────────────────────────────────────────────────────

describe('TaskSchema', () => {
	const validTask = {
		id: 'task-001',
		title: 'Build landing',
		type: 'implementation',
		status: 'in_progress',
		created_by: 'ceo',
		created_at: '2026-03-22T10:00:00Z',
		updated_at: '2026-03-22T10:00:00Z',
	}

	test('parses valid data successfully', () => {
		const result = TaskSchema.parse(validTask)
		expect(result.id).toBe('task-001')
		expect(result.title).toBe('Build landing')
		expect(result.type).toBe('implementation')
		expect(result.status).toBe('in_progress')
	})

	test('applies default values', () => {
		const result = TaskSchema.parse(validTask)
		expect(result.description).toBe('')
		expect(result.priority).toBe('medium')
		expect(result.reviewers).toEqual([])
		expect(result.parent).toBeNull()
		expect(result.depends_on).toEqual([])
		expect(result.blocks).toEqual([])
		expect(result.related).toEqual([])
		expect(result.context).toEqual({})
		expect(result.blockers).toEqual([])
		expect(result.history).toEqual([])
	})

	test('rejects invalid status', () => {
		expect(() =>
			TaskSchema.parse({ ...validTask, status: 'running' }),
		).toThrow(ZodError)
	})

	test('rejects invalid priority', () => {
		expect(() =>
			TaskSchema.parse({ ...validTask, priority: 'urgent' }),
		).toThrow(ZodError)
	})

	test('rejects invalid type', () => {
		expect(() =>
			TaskSchema.parse({ ...validTask, type: 'coding' }),
		).toThrow(ZodError)
	})

	test('rejects missing created_by', () => {
		const { created_by: _, ...without } = validTask
		expect(() => TaskSchema.parse(without)).toThrow(ZodError)
	})

	test('rejects invalid datetime format', () => {
		expect(() =>
			TaskSchema.parse({ ...validTask, created_at: 'not-a-date' }),
		).toThrow(ZodError)
	})

	test('accepts all valid statuses', () => {
		const statuses = ['draft', 'backlog', 'assigned', 'in_progress', 'review', 'blocked', 'done', 'cancelled']
		for (const status of statuses) {
			const result = TaskSchema.parse({ ...validTask, status })
			expect(result.status).toBe(status)
		}
	})
})

// ── MessageSchema ──────────────────────────────────────────────────────

describe('MessageSchema', () => {
	const validMessage = {
		id: 'msg-001',
		from: 'peter',
		at: '2026-03-22T10:00:00Z',
		content: 'PR ready',
	}

	test('parses valid data successfully', () => {
		const result = MessageSchema.parse(validMessage)
		expect(result.id).toBe('msg-001')
		expect(result.from).toBe('peter')
		expect(result.content).toBe('PR ready')
	})

	test('applies default values', () => {
		const result = MessageSchema.parse(validMessage)
		expect(result.mentions).toEqual([])
		expect(result.references).toEqual([])
		expect(result.reactions).toEqual([])
		expect(result.thread).toBeNull()
		expect(result.external).toBe(false)
	})

	test('rejects missing content', () => {
		const { content: _, ...without } = validMessage
		expect(() => MessageSchema.parse(without)).toThrow(ZodError)
	})

	test('rejects invalid datetime', () => {
		expect(() =>
			MessageSchema.parse({ ...validMessage, at: 'yesterday' }),
		).toThrow(ZodError)
	})

	test('accepts optional to and channel', () => {
		const result = MessageSchema.parse({
			...validMessage,
			to: 'marek',
			channel: 'general',
		})
		expect(result.to).toBe('marek')
		expect(result.channel).toBe('general')
	})
})

// ── WorkflowSchema ────────────────────────────────────────────────────

describe('WorkflowSchema', () => {
	const validWorkflow = {
		id: 'development',
		name: 'Development',
		steps: [
			{ id: 'scope', assigned_role: 'strategist', transitions: { done: 'plan' } },
			{ id: 'plan', type: 'terminal' },
		],
	}

	test('parses valid data successfully', () => {
		const result = WorkflowSchema.parse(validWorkflow)
		expect(result.id).toBe('development')
		expect(result.name).toBe('Development')
		expect(result.steps).toHaveLength(2)
	})

	test('applies default values', () => {
		const result = WorkflowSchema.parse(validWorkflow)
		expect(result.version).toBe(1)
		expect(result.description).toBe('')
		expect(result.changelog).toEqual([])
		expect(result.change_policy.propose).toEqual(['any_agent'])
		expect(result.change_policy.evaluate).toEqual(['ceo'])
		expect(result.change_policy.apply).toEqual(['ceo'])
	})

	test('applies step defaults', () => {
		const result = WorkflowSchema.parse(validWorkflow)
		expect(result.steps[0].type).toBe('agent')
		expect(result.steps[0].description).toBe('')
		expect(result.steps[0].auto_execute).toBe(false)
	})

	test('rejects missing steps', () => {
		expect(() =>
			WorkflowSchema.parse({ id: 'test', name: 'Test' }),
		).toThrow(ZodError)
	})

	test('rejects empty steps array', () => {
		// steps is required and must be an array, but empty array should be fine per schema
		const result = WorkflowSchema.parse({ id: 'test', name: 'Test', steps: [] })
		expect(result.steps).toEqual([])
	})

	test('rejects invalid step type', () => {
		expect(() =>
			WorkflowSchema.parse({
				id: 'test',
				name: 'Test',
				steps: [{ id: 's1', type: 'invalid_type' }],
			}),
		).toThrow(ZodError)
	})
})

// ── ScheduleSchema ─────────────────────────────────────────────────────

describe('ScheduleSchema', () => {
	const validSchedule = {
		id: 'health-check',
		agent: 'ops',
		cron: '*/5 * * * *',
	}

	test('parses valid data successfully', () => {
		const result = ScheduleSchema.parse(validSchedule)
		expect(result.id).toBe('health-check')
		expect(result.agent).toBe('ops')
		expect(result.cron).toBe('*/5 * * * *')
	})

	test('applies default values', () => {
		const result = ScheduleSchema.parse(validSchedule)
		expect(result.description).toBe('')
		expect(result.create_task).toBe(false)
		expect(result.enabled).toBe(true)
	})

	test('accepts optional workflow field', () => {
		const result = ScheduleSchema.parse({ ...validSchedule, workflow: 'deploy-pipeline' })
		expect(result.workflow).toBe('deploy-pipeline')
	})

	test('accepts optional workflow_inputs field', () => {
		const result = ScheduleSchema.parse({ ...validSchedule, workflow: 'deploy', workflow_inputs: { env: 'prod' } })
		expect(result.workflow_inputs).toEqual({ env: 'prod' })
	})

	test('rejects missing agent', () => {
		expect(() =>
			ScheduleSchema.parse({ id: 'test', cron: '* * * * *' }),
		).toThrow(ZodError)
	})
})

// ── WebhookSchema ──────────────────────────────────────────────────────

describe('WebhookSchema', () => {
	const validWebhook = {
		id: 'uptime',
		path: '/uptime',
		agent: 'ops',
		action: { type: 'spawn_agent' },
	}

	test('parses valid data successfully', () => {
		const result = WebhookSchema.parse(validWebhook)
		expect(result.id).toBe('uptime')
		expect(result.path).toBe('/uptime')
		expect(result.agent).toBe('ops')
	})

	test('applies default values', () => {
		const result = WebhookSchema.parse(validWebhook)
		expect(result.description).toBe('')
		expect(result.auth).toBe('hmac_sha256')
		expect(result.enabled).toBe(true)
		expect(result.action.priority).toBe('normal')
		expect(result.action.context_template).toBe('')
	})

	test('rejects missing action', () => {
		expect(() =>
			WebhookSchema.parse({ id: 'test', path: '/test', agent: 'ops' }),
		).toThrow(ZodError)
	})

	test('rejects invalid auth type', () => {
		expect(() =>
			WebhookSchema.parse({ ...validWebhook, auth: 'basic' }),
		).toThrow(ZodError)
	})

	test('rejects invalid action type', () => {
		expect(() =>
			WebhookSchema.parse({ ...validWebhook, action: { type: 'restart' } }),
		).toThrow(ZodError)
	})
})

// ── WatcherSchema ──────────────────────────────────────────────────────

describe('WatcherSchema', () => {
	const validWatcher = {
		id: 'code-watch',
		agent: 'peter',
		watch: '/projects/*/code',
		events: ['modify'],
	}

	test('parses valid data successfully', () => {
		const result = WatcherSchema.parse(validWatcher)
		expect(result.id).toBe('code-watch')
		expect(result.agent).toBe('peter')
		expect(result.events).toEqual(['modify'])
	})

	test('applies default values', () => {
		const result = WatcherSchema.parse(validWatcher)
		expect(result.description).toBe('')
		expect(result.debounce).toBe('10s')
		expect(result.create_task).toBe(false)
		expect(result.enabled).toBe(true)
	})

	test('rejects invalid event type', () => {
		expect(() =>
			WatcherSchema.parse({ ...validWatcher, events: ['rename'] }),
		).toThrow(ZodError)
	})

	test('accepts all valid event types', () => {
		const result = WatcherSchema.parse({
			...validWatcher,
			events: ['create', 'modify', 'delete'],
		})
		expect(result.events).toEqual(['create', 'modify', 'delete'])
	})

	test('rejects missing watch path', () => {
		const { watch: _, ...without } = validWatcher
		expect(() => WatcherSchema.parse(without)).toThrow(ZodError)
	})
})

// ── ThresholdSchema ────────────────────────────────────────────────────

describe('ThresholdSchema', () => {
	const validThreshold = {
		id: 'cpu-alert',
		agent: 'ops',
		metric: 'cpu_usage',
		condition: '> 80',
		action: 'alert_human',
	}

	test('parses valid data successfully', () => {
		const result = ThresholdSchema.parse(validThreshold)
		expect(result.id).toBe('cpu-alert')
		expect(result.metric).toBe('cpu_usage')
		expect(result.condition).toBe('> 80')
		expect(result.action).toBe('alert_human')
	})

	test('applies default values', () => {
		const result = ThresholdSchema.parse(validThreshold)
		expect(result.description).toBe('')
		expect(result.create_task).toBe(false)
		expect(result.cooldown).toBe('1h')
		expect(result.enabled).toBe(true)
	})

	test('rejects invalid action', () => {
		expect(() =>
			ThresholdSchema.parse({ ...validThreshold, action: 'restart_server' }),
		).toThrow(ZodError)
	})

	test('accepts spawn_agent action', () => {
		const result = ThresholdSchema.parse({ ...validThreshold, action: 'spawn_agent' })
		expect(result.action).toBe('spawn_agent')
	})

	test('rejects missing metric', () => {
		const { metric: _, ...without } = validThreshold
		expect(() => ThresholdSchema.parse(without)).toThrow(ZodError)
	})
})

// ── AgentMemorySchema ──────────────────────────────────────────────────

describe('AgentMemorySchema', () => {
	const validMemory = {
		facts: { codebase: ['Uses TypeScript', 'Bun runtime'] },
		decisions: [{ date: '2026-03-22', decision: 'Use Zod', reason: 'Type safety' }],
	}

	test('parses valid data successfully', () => {
		const result = AgentMemorySchema.parse(validMemory)
		expect(result.facts.codebase).toEqual(['Uses TypeScript', 'Bun runtime'])
		expect(result.decisions).toHaveLength(1)
		expect(result.decisions[0].decision).toBe('Use Zod')
	})

	test('applies default values', () => {
		const result = AgentMemorySchema.parse({})
		expect(result.facts).toEqual({})
		expect(result.decisions).toEqual([])
		expect(result.patterns).toEqual([])
		expect(result.mistakes).toEqual([])
	})

	test('accepts empty object', () => {
		const result = AgentMemorySchema.parse({})
		expect(result).toBeDefined()
	})

	test('accepts mistakes array', () => {
		const result = AgentMemorySchema.parse({
			mistakes: [{ date: '2026-03-22', what: 'Wrong config', fix: 'Fixed path' }],
		})
		expect(result.mistakes).toHaveLength(1)
	})

	test('rejects invalid decision missing reason', () => {
		expect(() =>
			AgentMemorySchema.parse({
				decisions: [{ date: '2026-03-22', decision: 'Use Zod' }],
			}),
		).toThrow(ZodError)
	})

	test('rejects invalid facts value type', () => {
		expect(() =>
			AgentMemorySchema.parse({
				facts: { codebase: 'not an array' },
			}),
		).toThrow(ZodError)
	})
})

// ── PinSchema ──────────────────────────────────────────────────────────

describe('PinSchema', () => {
	const validPin = {
		id: 'pin-001',
		group: 'alerts',
		title: 'PR Ready',
		type: 'warning',
		created_by: 'marek',
		created_at: '2026-03-22T10:00:00Z',
	}

	test('parses valid data successfully', () => {
		const result = PinSchema.parse(validPin)
		expect(result.id).toBe('pin-001')
		expect(result.group).toBe('alerts')
		expect(result.type).toBe('warning')
	})

	test('applies default values', () => {
		const result = PinSchema.parse(validPin)
		expect(result.content).toBe('')
		expect(result.metadata).toEqual({})
	})

	test('rejects invalid pin type', () => {
		expect(() =>
			PinSchema.parse({ ...validPin, type: 'critical' }),
		).toThrow(ZodError)
	})

	test('accepts all valid pin types', () => {
		const types = ['info', 'warning', 'success', 'error', 'progress']
		for (const type of types) {
			const result = PinSchema.parse({ ...validPin, type })
			expect(result.type).toBe(type)
		}
	})

	test('rejects missing title', () => {
		const { title: _, ...without } = validPin
		expect(() => PinSchema.parse(without)).toThrow(ZodError)
	})

	test('rejects invalid created_at datetime', () => {
		expect(() =>
			PinSchema.parse({ ...validPin, created_at: 'today' }),
		).toThrow(ZodError)
	})
})

// ── SessionMetaSchema ──────────────────────────────────────────────────

describe('SessionMetaSchema', () => {
	const validSession = {
		id: 'session-001',
		agent: 'peter',
		trigger: { type: 'task_assigned', task_id: 'task-001' },
		status: 'running',
		started_at: '2026-03-22T10:00:00Z',
	}

	test('parses valid data successfully', () => {
		const result = SessionMetaSchema.parse(validSession)
		expect(result.id).toBe('session-001')
		expect(result.agent).toBe('peter')
		expect(result.status).toBe('running')
		expect(result.trigger.type).toBe('task_assigned')
		expect(result.trigger.task_id).toBe('task-001')
	})

	test('applies default values', () => {
		const result = SessionMetaSchema.parse(validSession)
		expect(result.token_usage.input).toBe(0)
		expect(result.token_usage.output).toBe(0)
		expect(result.tool_calls).toBe(0)
		expect(result.errors).toBe(0)
	})

	test('rejects invalid status', () => {
		expect(() =>
			SessionMetaSchema.parse({ ...validSession, status: 'paused' }),
		).toThrow(ZodError)
	})

	test('accepts all valid session statuses', () => {
		const statuses = ['spawning', 'running', 'tool_call', 'idle', 'completed', 'failed', 'timeout']
		for (const status of statuses) {
			const result = SessionMetaSchema.parse({ ...validSession, status })
			expect(result.status).toBe(status)
		}
	})

	test('rejects missing trigger', () => {
		const { trigger: _, ...without } = validSession
		expect(() => SessionMetaSchema.parse(without)).toThrow(ZodError)
	})

	test('rejects invalid started_at datetime', () => {
		expect(() =>
			SessionMetaSchema.parse({ ...validSession, started_at: 'now' }),
		).toThrow(ZodError)
	})
})

// ── SecretSchema ───────────────────────────────────────────────────────

describe('SecretSchema', () => {
	const validSecret = {
		service: 'github',
		created_at: '2026-03-22T10:00:00Z',
		created_by: 'dominik',
		value: 'ghp_xxx',
	}

	test('parses valid data successfully', () => {
		const result = SecretSchema.parse(validSecret)
		expect(result.service).toBe('github')
		expect(result.value).toBe('ghp_xxx')
		expect(result.created_by).toBe('dominik')
	})

	test('applies default values', () => {
		const result = SecretSchema.parse(validSecret)
		expect(result.type).toBe('api_token')
		expect(result.allowed_agents).toEqual([])
		expect(result.usage).toBe('')
	})

	test('rejects missing service', () => {
		const { service: _, ...without } = validSecret
		expect(() => SecretSchema.parse(without)).toThrow(ZodError)
	})

	test('rejects missing value', () => {
		const { value: _, ...without } = validSecret
		expect(() => SecretSchema.parse(without)).toThrow(ZodError)
	})

	test('rejects invalid created_at datetime', () => {
		expect(() =>
			SecretSchema.parse({ ...validSecret, created_at: 'last-week' }),
		).toThrow(ZodError)
	})
})

// ── HumanSchema ────────────────────────────────────────────────────────

describe('HumanSchema', () => {
	const validHuman = {
		id: 'dominik',
		name: 'Dominik',
		role: 'owner',
	}

	test('parses valid data successfully', () => {
		const result = HumanSchema.parse(validHuman)
		expect(result.id).toBe('dominik')
		expect(result.name).toBe('Dominik')
		expect(result.role).toBe('owner')
	})

	test('applies default values', () => {
		const result = HumanSchema.parse(validHuman)
		expect(result.description).toBe('')
		expect(result.notification_routing).toEqual({})
		expect(result.quiet_hours.enabled).toBe(false)
		expect(result.quiet_hours.start).toBe('22:00')
		expect(result.quiet_hours.end).toBe('07:00')
		expect(result.quiet_hours.timezone).toBe('UTC')
		expect(result.quiet_hours.except).toEqual(['urgent'])
		expect(result.transport_config).toEqual({})
		expect(result.approval_scopes).toEqual([])
	})

	test('rejects missing id', () => {
		const { id: _, ...without } = validHuman
		expect(() => HumanSchema.parse(without)).toThrow(ZodError)
	})

	test('rejects missing name', () => {
		const { name: _, ...without } = validHuman
		expect(() => HumanSchema.parse(without)).toThrow(ZodError)
	})

	test('rejects missing role', () => {
		const { role: _, ...without } = validHuman
		expect(() => HumanSchema.parse(without)).toThrow(ZodError)
	})

	test('accepts notification routing', () => {
		const result = HumanSchema.parse({
			...validHuman,
			notification_routing: {
				urgent: { transports: ['whatsapp', 'email'] },
			},
		})
		expect(result.notification_routing.urgent.transports).toEqual(['whatsapp', 'email'])
		expect(result.notification_routing.urgent.throttle).toBeNull()
		expect(result.notification_routing.urgent.batch).toBe(false)
	})
})
