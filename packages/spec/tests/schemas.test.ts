import { describe, expect, test } from 'bun:test'
import { ZodError } from 'zod'
import {
	AgentSchema,
	CompanySchema,
	ConversationResultSchema,
	HumanSchema,
	ScheduleSchema,
	WorkflowSchema,
	WorkerClaimRequestSchema,
	WorkerEnrollRequestSchema,
	WorkerRegisterRequestSchema,
} from '../src/schemas'

describe('CompanySchema', () => {
	test('parses a valid company and applies defaults', () => {
		const result = CompanySchema.parse({
			name: 'QUESTPIE s.r.o.',
			slug: 'questpie',
			owner: { name: 'Dominik', email: 'd@questpie.com' },
		})

		expect(result.name).toBe('QUESTPIE s.r.o.')
		expect(result.slug).toBe('questpie')
		expect(result.timezone).toBe('UTC')
		expect(result.language).toBe('en')
		expect(result.settings.default_runtime).toBe('claude-code')
		expect(result.setup_completed).toBe(false)
	})

	test('rejects invalid slug and owner email', () => {
		expect(() =>
			CompanySchema.parse({
				name: 'Bad',
				slug: 'Quest Pie',
				owner: { name: 'X', email: 'owner@example.com' },
			}),
		).toThrow(ZodError)

		expect(() =>
			CompanySchema.parse({
				name: 'Bad',
				slug: 'questpie',
				owner: { name: 'X', email: 'not-an-email' },
			}),
		).toThrow(ZodError)
	})
})

describe('AgentSchema', () => {
	test('parses a valid agent with defaults', () => {
		const result = AgentSchema.parse({
			id: 'developer',
			name: 'Developer',
			role: 'developer',
		})

		expect(result.id).toBe('developer')
		expect(result.description).toBe('')
		expect(result.triggers).toEqual([])
	})

	test('accepts arbitrary role strings for authored agents', () => {
		const result = AgentSchema.parse({
			id: 'developer',
			name: 'Developer',
			role: 'hacker',
		})

		expect(result.role).toBe('hacker')
	})
})

describe('WorkflowSchema', () => {
	test('parses the current linear workflow model', () => {
		const result = WorkflowSchema.parse({
			id: 'development',
			name: 'Development',
			steps: [
				{ id: 'implement', type: 'agent', agent_id: 'developer' },
				{ id: 'review', type: 'human_approval', approvers: ['owner'] },
				{ id: 'done', type: 'done' },
			],
		})

		expect(result.description).toBe('')
		expect(result.steps[0]!.id).toBe('implement')
		expect(result.steps[0]!.type).toBe('agent')
		expect(result.steps[0]!.agent_id).toBe('developer')
		expect(result.steps[1]!.id).toBe('review')
		expect(result.steps[1]!.type).toBe('human_approval')
		expect(result.steps[2]!.id).toBe('done')
		expect(result.steps[2]!.type).toBe('done')
	})

	test('rejects invalid step type', () => {
		expect(() =>
			WorkflowSchema.parse({
				id: 'broken',
				name: 'Broken',
				steps: [{ id: 'x', type: 'terminal' }],
			}),
		).toThrow(ZodError)
	})

	test('strips legacy role field from steps', () => {
		const result = WorkflowSchema.parse({
			id: 'legacyish',
			name: 'Legacyish',
			steps: [{ id: 'implement', type: 'agent', agent_id: 'developer', role: 'developer' }],
		})

		expect((result.steps[0] as Record<string, unknown>).role).toBeUndefined()
		expect(result.steps[0]?.agent_id).toBe('developer')
	})
})

describe('HumanSchema', () => {
	test('parses a human with defaults', () => {
		const result = HumanSchema.parse({
			id: 'dominik',
			name: 'Dominik',
			role: 'owner',
		})

		expect(result.notification_routing).toEqual({})
		expect(result.quiet_hours.enabled).toBe(false)
		expect(result.quiet_hours.timezone).toBe('UTC')
	})
})

describe('ScheduleSchema', () => {
	test('parses a valid schedule with defaults', () => {
		const result = ScheduleSchema.parse({
			id: 'nightly-review',
			agent: 'reviewer',
			cron: '0 0 * * *',
		})

		expect(result.description).toBe('')
		expect(result.create_task).toBe(false)
		expect(result.enabled).toBe(true)
	})
})

describe('ConversationResultSchema', () => {
	test('accepts task.create with conversation fields', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'task.create',
			conversation_id: 'chat-123',
			thread_id: '456',
			input: { title: 'Build feature', type: 'task', workflow_id: 'bounded-dev' },
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.action).toBe('task.create')
			expect(result.data.conversation_id).toBe('chat-123')
			expect(result.data.thread_id).toBe('456')
			expect(result.data.input.title).toBe('Build feature')
			expect(result.data.input.type).toBe('task')
			expect(result.data.input.workflow_id).toBe('bounded-dev')
		}
	})

	test('rejects task.create with missing title', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'task.create',
			conversation_id: 'chat-123',
			input: { type: 'task', workflow_id: 'bounded-dev' },
		})
		expect(result.success).toBe(false)
	})

	test('rejects task.create with empty title', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'task.create',
			conversation_id: 'chat-123',
			input: { title: '', type: 'task' },
		})
		expect(result.success).toBe(false)
	})

	test('rejects task.create with missing input', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'task.create',
			conversation_id: 'chat-123',
		})
		expect(result.success).toBe(false)
	})

	test('accepts task.create without optional thread_id', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'task.create',
			conversation_id: 'chat-123',
			input: { title: 'Fix bug', type: 'bugfix' },
		})
		expect(result.success).toBe(true)
	})

	test('accepts query.message with sender fields', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'query.message',
			conversation_id: 'chat-123',
			message: 'hello world',
			sender_id: 'user-1',
			sender_name: 'Jan',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.action).toBe('query.message')
		}
	})

	test('accepts noop without reason', () => {
		const result = ConversationResultSchema.safeParse({ action: 'noop' })
		expect(result.success).toBe(true)
	})

	test('accepts conversation.command with all fields', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'conversation.command',
			conversation_id: 'chat-123',
			thread_id: '456',
			command: 'build',
			args: 'nainštaluj providera',
			sender_id: 'user-1',
			sender_name: 'Jan',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.action).toBe('conversation.command')
			expect(result.data.command).toBe('build')
			expect(result.data.args).toBe('nainštaluj providera')
		}
	})

	test('accepts conversation.command without optional fields', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'conversation.command',
			conversation_id: 'chat-123',
			command: 'direct',
			args: '',
		})
		expect(result.success).toBe(true)
	})

	test('rejects conversation.command without command field', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'conversation.command',
			conversation_id: 'chat-123',
			args: 'something',
		})
		expect(result.success).toBe(false)
	})

	test('rejects unknown action', () => {
		const result = ConversationResultSchema.safeParse({
			action: 'task.delete',
			conversation_id: 'chat-123',
		})
		expect(result.success).toBe(false)
	})
})

describe('API contract schemas', () => {
	test('worker registration contract parses current capability shape', () => {
		const result = WorkerRegisterRequestSchema.parse({
			id: 'worker-1',
			device_id: 'mbp-1',
			name: 'Andrej MBP',
			capabilities: [{ runtime: 'claude-code', models: ['claude-sonnet-4'], maxConcurrent: 1 }],
		})

		expect(result.capabilities[0]!.runtime).toBe('claude-code')
		expect(result.capabilities[0]!.models).toEqual(['claude-sonnet-4'])
		expect(result.capabilities[0]!.maxConcurrent).toBe(1)
		expect(result.capabilities[0]!.tags).toEqual([])
	})

	test('worker claim and enrollment contracts parse current fields', () => {
		const claim = WorkerClaimRequestSchema.parse({
			worker_id: 'worker-1',
			runtime: 'claude-code',
			shared_checkout_locked: true,
			shared_checkout_enabled: true,
			worktree_isolation_available: false,
		})
		expect(claim.worker_id).toBe('worker-1')
		expect(claim.shared_checkout_locked).toBe(true)

		const enroll = WorkerEnrollRequestSchema.parse({
			token: 'secret',
			name: 'Andrej MBP',
			device_id: 'mbp-1',
			capabilities: [{ runtime: 'claude-code' }],
		})
		expect(enroll.name).toBe('Andrej MBP')
		expect(enroll.capabilities[0]?.runtime).toBe('claude-code')
	})
})
