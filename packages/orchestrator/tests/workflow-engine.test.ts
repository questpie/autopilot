import { describe, expect, it } from 'bun:test'
import type { Agent, Task, Workflow } from '@questpie/autopilot-spec'
import {
	advanceWorkflow,
	evaluateTransition,
	getAssignee,
	getAvailableTransitions,
	getNextStep,
	isHumanGate,
	isReviewSatisfied,
	isTerminal,
	resolveWorkflowStep,
	validateWorkflowGraph,
} from '../src/workflow/engine'

// ─── Test fixtures ──────────────────────────────────────────────────────────

const testWorkflow: Workflow = {
	id: 'development',
	name: 'Development',
	version: 1,
	description: '',
	change_policy: {
		propose: ['any_agent'],
		evaluate: ['ceo'],
		apply: ['ceo'],
		human_approval_required_for: [],
	},
	changelog: [],
	steps: [
		{
			id: 'scope',
			type: 'agent',
			assigned_role: 'strategist',
			description: '',
			auto_execute: false,
			transitions: { done: 'plan' },
		},
		{
			id: 'plan',
			type: 'agent',
			assigned_role: 'planner',
			description: '',
			auto_execute: false,
			transitions: { done: 'implement' },
		},
		{
			id: 'implement',
			type: 'agent',
			assigned_role: 'developer',
			description: '',
			auto_execute: false,
			transitions: { done: 'code_review' },
		},
		{
			id: 'code_review',
			type: 'agent',
			assigned_role: 'reviewer',
			description: '',
			auto_execute: false,
			transitions: { approved: 'human_merge', rejected: 'implement' },
		},
		{
			id: 'human_merge',
			type: 'human_gate',
			gate: 'merge',
			description: '',
			auto_execute: false,
			transitions: { approved: 'deploy', rejected: 'implement' },
		},
		{
			id: 'deploy',
			type: 'agent',
			assigned_role: 'devops',
			description: '',
			auto_execute: true,
			transitions: { success: 'complete' },
		},
		{
			id: 'complete',
			type: 'terminal',
			description: '',
			auto_execute: false,
			transitions: {},
		},
	],
}

const testAgents: Agent[] = [
	{
		id: 'agent-strategist',
		name: 'Strategist',
		role: 'strategist',
		description: 'Strategic planning',
		model: 'claude-sonnet-4-20250514',
		fs_scope: { read: ['**'], write: ['company/tasks/**'] },
		tools: ['fs'],
		mcps: [],
		triggers: [],
	},
	{
		id: 'agent-planner',
		name: 'Planner',
		role: 'planner',
		description: 'Task planning',
		model: 'claude-sonnet-4-20250514',
		fs_scope: { read: ['**'], write: ['company/tasks/**'] },
		tools: ['fs'],
		mcps: [],
		triggers: [],
	},
	{
		id: 'agent-developer',
		name: 'Developer',
		role: 'developer',
		description: 'Implementation',
		model: 'claude-sonnet-4-20250514',
		fs_scope: { read: ['**'], write: ['**'] },
		tools: ['fs', 'terminal'],
		mcps: [],
		triggers: [],
	},
	{
		id: 'agent-reviewer',
		name: 'Reviewer',
		role: 'reviewer',
		description: 'Code review',
		model: 'claude-sonnet-4-20250514',
		fs_scope: { read: ['**'], write: ['company/tasks/**'] },
		tools: ['fs'],
		mcps: [],
		triggers: [],
	},
	{
		id: 'agent-devops',
		name: 'DevOps',
		role: 'devops',
		description: 'Deployment',
		model: 'claude-sonnet-4-20250514',
		fs_scope: { read: ['**'], write: ['company/infra/**'] },
		tools: ['fs', 'terminal'],
		mcps: [],
		triggers: [],
	},
]

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-001',
		title: 'Test task',
		description: '',
		type: 'implementation',
		status: 'in_progress',
		priority: 'medium',
		created_by: 'human-ceo',
		workflow: 'development',
		workflow_step: 'scope',
		context: {},
		blockers: [],
		depends_on: [],
		blocks: [],
		related: [],
		reviewers: [],
		parent: null,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		history: [],
		...overrides,
	}
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('resolveWorkflowStep', () => {
	it('finds an existing step by id', () => {
		const step = resolveWorkflowStep(testWorkflow, 'scope')
		expect(step).toBeDefined()
		expect(step?.id).toBe('scope')
		expect(step?.assigned_role).toBe('strategist')
	})

	it('returns undefined for unknown step id', () => {
		const step = resolveWorkflowStep(testWorkflow, 'nonexistent')
		expect(step).toBeUndefined()
	})
})

describe('isHumanGate', () => {
	it('returns true for human_gate steps', () => {
		const step = resolveWorkflowStep(testWorkflow, 'human_merge')!
		expect(isHumanGate(step)).toBe(true)
	})

	it('returns false for agent steps', () => {
		const step = resolveWorkflowStep(testWorkflow, 'scope')!
		expect(isHumanGate(step)).toBe(false)
	})

	it('returns false for terminal steps', () => {
		const step = resolveWorkflowStep(testWorkflow, 'complete')!
		expect(isHumanGate(step)).toBe(false)
	})
})

describe('isTerminal', () => {
	it('returns true for terminal steps', () => {
		const step = resolveWorkflowStep(testWorkflow, 'complete')!
		expect(isTerminal(step)).toBe(true)
	})

	it('returns false for agent steps', () => {
		const step = resolveWorkflowStep(testWorkflow, 'implement')!
		expect(isTerminal(step)).toBe(false)
	})

	it('returns true when terminal flag is set', () => {
		expect(isTerminal({ id: 'x', type: 'agent', terminal: true, description: '', auto_execute: false, transitions: {} })).toBe(true)
	})
})

describe('getNextStep', () => {
	it('resolves "done" transition', () => {
		expect(getNextStep(testWorkflow, 'scope', 'done')).toBe('plan')
	})

	it('resolves "approved" transition', () => {
		expect(getNextStep(testWorkflow, 'code_review', 'approved')).toBe('human_merge')
	})

	it('resolves "rejected" transition', () => {
		expect(getNextStep(testWorkflow, 'code_review', 'rejected')).toBe('implement')
	})

	it('returns undefined for unknown transition key', () => {
		expect(getNextStep(testWorkflow, 'scope', 'rejected')).toBeUndefined()
	})

	it('returns undefined for unknown step', () => {
		expect(getNextStep(testWorkflow, 'nonexistent', 'done')).toBeUndefined()
	})

	it('resolves "success" transition on deploy', () => {
		expect(getNextStep(testWorkflow, 'deploy', 'success')).toBe('complete')
	})
})

describe('getAssignee', () => {
	it('matches agent by role', () => {
		const step = resolveWorkflowStep(testWorkflow, 'scope')!
		const assignee = getAssignee(step, testAgents)
		expect(assignee).toBe('agent-strategist')
	})

	it('matches developer role', () => {
		const step = resolveWorkflowStep(testWorkflow, 'implement')!
		expect(getAssignee(step, testAgents)).toBe('agent-developer')
	})

	it('matches reviewer role', () => {
		const step = resolveWorkflowStep(testWorkflow, 'code_review')!
		expect(getAssignee(step, testAgents)).toBe('agent-reviewer')
	})

	it('matches devops role', () => {
		const step = resolveWorkflowStep(testWorkflow, 'deploy')!
		expect(getAssignee(step, testAgents)).toBe('agent-devops')
	})

	it('returns undefined when no agents match', () => {
		const step = resolveWorkflowStep(testWorkflow, 'scope')!
		expect(getAssignee(step, [])).toBeUndefined()
	})

	it('prefers assigned_to over assigned_role', () => {
		const step = { ...resolveWorkflowStep(testWorkflow, 'scope')!, assigned_to: 'agent-developer' }
		expect(getAssignee(step, testAgents)).toBe('agent-developer')
	})
})

describe('evaluateTransition', () => {
	it('returns assign_agent for agent steps', () => {
		const task = makeTask({ workflow_step: 'scope' })
		const result = evaluateTransition(testWorkflow, task, testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.assignRole).toBe('strategist')
		expect(result.assignTo).toBe('agent-strategist')
	})

	it('returns notify_human for human_gate steps', () => {
		const task = makeTask({ workflow_step: 'human_merge' })
		const result = evaluateTransition(testWorkflow, task, testAgents)
		expect(result.action).toBe('notify_human')
		expect(result.gate).toBe('merge')
	})

	it('returns complete for terminal steps', () => {
		const task = makeTask({ workflow_step: 'complete' })
		const result = evaluateTransition(testWorkflow, task, testAgents)
		expect(result.action).toBe('complete')
	})

	it('returns assign_agent with auto_execute for deploy step', () => {
		const task = makeTask({ workflow_step: 'deploy' })
		const result = evaluateTransition(testWorkflow, task, testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.assignRole).toBe('devops')
		expect(result.assignTo).toBe('agent-devops')
	})

	it('returns error when task has no workflow_step', () => {
		const task = makeTask({ workflow_step: undefined })
		const result = evaluateTransition(testWorkflow, task, testAgents)
		expect(result.action).toBe('error')
		expect(result.error).toContain('no workflow_step')
	})

	it('returns error when step not found', () => {
		const task = makeTask({ workflow_step: 'nonexistent' })
		const result = evaluateTransition(testWorkflow, task, testAgents)
		expect(result.action).toBe('error')
		expect(result.error).toContain('not found')
	})

	it('returns no_action when review requirements not met', () => {
		const workflowWithReview: Workflow = {
			...testWorkflow,
			steps: testWorkflow.steps.map((s) =>
				s.id === 'implement'
					? {
							...s,
							review: {
								reviewers_roles: ['reviewer'],
								min_approvals: 1,
								on_reject: 'revise',
							},
						}
					: s,
			),
		}
		const task = makeTask({ workflow_step: 'implement' })
		const result = evaluateTransition(workflowWithReview, task, testAgents)
		expect(result.action).toBe('no_action')
	})
})

describe('advanceWorkflow', () => {
	it('advances from scope to plan with "done"', () => {
		const task = makeTask({ workflow_step: 'scope' })
		const result = advanceWorkflow(testWorkflow, task, 'done', testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.nextStep).toBe('plan')
		expect(result.assignRole).toBe('planner')
	})

	it('advances from code_review to human_merge with "approved"', () => {
		const task = makeTask({ workflow_step: 'code_review' })
		const result = advanceWorkflow(testWorkflow, task, 'approved', testAgents)
		expect(result.action).toBe('notify_human')
		expect(result.nextStep).toBe('human_merge')
		expect(result.gate).toBe('merge')
	})

	it('sends back from code_review to implement with "rejected"', () => {
		const task = makeTask({ workflow_step: 'code_review' })
		const result = advanceWorkflow(testWorkflow, task, 'rejected', testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.nextStep).toBe('implement')
		expect(result.assignRole).toBe('developer')
	})

	it('advances from human_merge to deploy with "approved"', () => {
		const task = makeTask({ workflow_step: 'human_merge' })
		const result = advanceWorkflow(testWorkflow, task, 'approved', testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.nextStep).toBe('deploy')
		expect(result.assignRole).toBe('devops')
	})

	it('advances from deploy to complete with "success"', () => {
		const task = makeTask({ workflow_step: 'deploy' })
		const result = advanceWorkflow(testWorkflow, task, 'success', testAgents)
		expect(result.action).toBe('complete')
		expect(result.nextStep).toBe('complete')
	})

	it('returns error for invalid transition key', () => {
		const task = makeTask({ workflow_step: 'scope' })
		const result = advanceWorkflow(testWorkflow, task, 'rejected', testAgents)
		expect(result.action).toBe('error')
		expect(result.error).toContain("No transition 'rejected'")
	})

	it('returns error when task has no workflow_step', () => {
		const task = makeTask({ workflow_step: undefined })
		const result = advanceWorkflow(testWorkflow, task, 'done', testAgents)
		expect(result.action).toBe('error')
	})

	it('blocks advancement when review not satisfied', () => {
		const workflowWithReview: Workflow = {
			...testWorkflow,
			steps: testWorkflow.steps.map((s) =>
				s.id === 'code_review'
					? {
							...s,
							review: {
								reviewers_roles: ['reviewer'],
								min_approvals: 1,
								on_reject: 'revise',
							},
						}
					: s,
			),
		}
		const task = makeTask({ workflow_step: 'code_review' })
		const result = advanceWorkflow(workflowWithReview, task, 'approved', testAgents)
		expect(result.action).toBe('no_action')
		expect(result.error).toContain('Review requirements not met')
	})
})

describe('isReviewSatisfied', () => {
	it('returns true when no review block', () => {
		const step = resolveWorkflowStep(testWorkflow, 'scope')!
		const task = makeTask()
		expect(isReviewSatisfied(step, task)).toBe(true)
	})

	it('returns false when review block present but no approvals', () => {
		const step = {
			...resolveWorkflowStep(testWorkflow, 'code_review')!,
			review: { reviewers_roles: ['reviewer'], min_approvals: 1, on_reject: 'revise' },
		}
		const task = makeTask({ workflow_step: 'code_review' })
		expect(isReviewSatisfied(step, task)).toBe(false)
	})

	it('returns true when enough approvals in history', () => {
		const step = {
			...resolveWorkflowStep(testWorkflow, 'code_review')!,
			review: { reviewers_roles: ['reviewer'], min_approvals: 1, on_reject: 'revise' },
		}
		const task = makeTask({
			workflow_step: 'code_review',
			history: [
				{
					at: '2026-01-01T01:00:00Z',
					by: 'reviewer',
					action: 'approved',
					step: 'code_review',
				},
			],
		})
		expect(isReviewSatisfied(step, task)).toBe(true)
	})
})

describe('getAvailableTransitions', () => {
	it('returns transition keys for a step', () => {
		const transitions = getAvailableTransitions(testWorkflow, 'code_review')
		expect(transitions).toContain('approved')
		expect(transitions).toContain('rejected')
		expect(transitions).toHaveLength(2)
	})

	it('returns empty array for terminal steps', () => {
		const transitions = getAvailableTransitions(testWorkflow, 'complete')
		expect(transitions).toHaveLength(0)
	})

	it('returns empty array for unknown steps', () => {
		const transitions = getAvailableTransitions(testWorkflow, 'nonexistent')
		expect(transitions).toHaveLength(0)
	})
})

describe('validateWorkflowGraph', () => {
	it('validates the test workflow as correct', () => {
		const result = validateWorkflowGraph(testWorkflow)
		expect(result.valid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	it('detects missing terminal step', () => {
		const noTerminal: Workflow = {
			...testWorkflow,
			steps: testWorkflow.steps.filter((s) => s.type !== 'terminal'),
		}
		const result = validateWorkflowGraph(noTerminal)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.includes('no terminal'))).toBe(true)
	})

	it('detects transitions to nonexistent steps', () => {
		const badTransition: Workflow = {
			...testWorkflow,
			steps: [
				{ id: 'start', type: 'agent', description: '', auto_execute: false, transitions: { done: 'nowhere' } },
				{ id: 'end', type: 'terminal', description: '', auto_execute: false, transitions: {} },
			],
		}
		const result = validateWorkflowGraph(badTransition)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.includes("unknown step 'nowhere'"))).toBe(true)
	})

	it('detects unreachable steps', () => {
		const unreachable: Workflow = {
			...testWorkflow,
			steps: [
				{ id: 'start', type: 'agent', description: '', auto_execute: false, transitions: { done: 'end' } },
				{ id: 'orphan', type: 'agent', description: '', auto_execute: false, transitions: { done: 'end' } },
				{ id: 'end', type: 'terminal', description: '', auto_execute: false, transitions: {} },
			],
		}
		const result = validateWorkflowGraph(unreachable)
		expect(result.valid).toBe(false)
		expect(result.errors.some((e) => e.includes("'orphan' is unreachable"))).toBe(true)
	})
})

describe('full development workflow walkthrough', () => {
	it('can walk the entire happy path', () => {
		let task = makeTask({ workflow_step: 'scope' })

		// scope → plan
		let result = advanceWorkflow(testWorkflow, task, 'done', testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.nextStep).toBe('plan')
		expect(result.assignTo).toBe('agent-planner')

		// plan → implement
		task = makeTask({ workflow_step: 'plan' })
		result = advanceWorkflow(testWorkflow, task, 'done', testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.nextStep).toBe('implement')
		expect(result.assignTo).toBe('agent-developer')

		// implement → code_review
		task = makeTask({ workflow_step: 'implement' })
		result = advanceWorkflow(testWorkflow, task, 'done', testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.nextStep).toBe('code_review')
		expect(result.assignTo).toBe('agent-reviewer')

		// code_review → human_merge (approved)
		task = makeTask({ workflow_step: 'code_review' })
		result = advanceWorkflow(testWorkflow, task, 'approved', testAgents)
		expect(result.action).toBe('notify_human')
		expect(result.nextStep).toBe('human_merge')
		expect(result.gate).toBe('merge')

		// human_merge → deploy (approved)
		task = makeTask({ workflow_step: 'human_merge' })
		result = advanceWorkflow(testWorkflow, task, 'approved', testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.nextStep).toBe('deploy')
		expect(result.assignTo).toBe('agent-devops')

		// deploy → complete (success)
		task = makeTask({ workflow_step: 'deploy' })
		result = advanceWorkflow(testWorkflow, task, 'success', testAgents)
		expect(result.action).toBe('complete')
		expect(result.nextStep).toBe('complete')
	})

	it('handles rejection loop: code_review → implement → code_review', () => {
		// code_review rejects → back to implement
		let task = makeTask({ workflow_step: 'code_review' })
		let result = advanceWorkflow(testWorkflow, task, 'rejected', testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.nextStep).toBe('implement')
		expect(result.assignTo).toBe('agent-developer')

		// implement done → back to code_review
		task = makeTask({ workflow_step: 'implement' })
		result = advanceWorkflow(testWorkflow, task, 'done', testAgents)
		expect(result.action).toBe('assign_agent')
		expect(result.nextStep).toBe('code_review')
		expect(result.assignTo).toBe('agent-reviewer')
	})
})
