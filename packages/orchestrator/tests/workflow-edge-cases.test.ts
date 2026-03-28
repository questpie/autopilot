import { describe, expect, it } from 'bun:test'
import type { Agent, Task, Workflow } from '@questpie/autopilot-spec'
import {
	advanceWorkflow,
	evaluateTransition,
	getAssignee,
	isReviewSatisfied,
	resolveWorkflowStep,
} from '../src/workflow/engine'

// ─── Test fixtures ──────────────────────────────────────────────────────────

const reviewWorkflow: Workflow = {
	id: 'review-test',
	name: 'Review Test',
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
			id: 'implement',
			type: 'agent',
			assigned_role: 'developer',
			description: '',
			auto_execute: false,
			transitions: { done: 'review' },
		},
		{
			id: 'review',
			type: 'agent',
			assigned_role: 'reviewer',
			description: '',
			auto_execute: false,
			review: {
				min_approvals: 2,
				on_reject: 'revise',
				on_reject_max_rounds: 3,
				reviewers_roles: ['reviewer', 'developer'],
			},
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
			transitions: { success: 'complete', failure: 'rollback' },
		},
		{
			id: 'rollback',
			type: 'agent',
			assigned_role: 'devops',
			description: '',
			auto_execute: true,
			transitions: { done: 'implement' },
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
		id: 'peter',
		name: 'Peter',
		role: 'developer',
		description: 'Senior developer',
		model: 'claude-sonnet-4-20250514',
		fs_scope: { read: ['**'], write: ['**'] },
		tools: ['fs', 'terminal'],
		mcps: [],
		triggers: [],
	},
	{
		id: 'maria',
		name: 'Maria',
		role: 'reviewer',
		description: 'Code reviewer',
		model: 'claude-sonnet-4-20250514',
		fs_scope: { read: ['**'], write: ['company/tasks/**'] },
		tools: ['fs'],
		mcps: [],
		triggers: [],
	},
	{
		id: 'jan',
		name: 'Jan',
		role: 'devops',
		description: 'DevOps engineer',
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
		title: 'Implement login feature',
		description: 'Add OAuth login',
		type: 'implementation',
		status: 'in_progress',
		priority: 'medium',
		created_by: 'human-ceo',
		workflow: 'review-test',
		workflow_step: 'implement',
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

describe('workflow edge cases', () => {
	describe('rejection loop with max rounds', () => {
		it('blocks rejection when review requirements not met (no approvals)', () => {
			const task = makeTask({ workflow_step: 'review', history: [] })
			const result = advanceWorkflow(reviewWorkflow, task, 'rejected', testAgents)
			// advanceWorkflow checks review satisfaction before any transition
			expect(result.action).toBe('no_action')
			expect(result.error).toContain('Review requirements not met')
		})

		it('rejects back to implement when review has enough approvals but key is rejected', () => {
			const task = makeTask({
				workflow_step: 'review',
				history: [
					{ at: '2026-01-01T01:00:00Z', by: 'maria', action: 'approved', step: 'review' },
					{ at: '2026-01-01T02:00:00Z', by: 'peter', action: 'approved', step: 'review' },
				],
			})
			const result = advanceWorkflow(reviewWorkflow, task, 'rejected', testAgents)
			expect(result.action).toBe('assign_agent')
			expect(result.nextStep).toBe('implement')
			expect(result.assignTo).toBe('peter')
		})

		it('goes back to review after re-implementation', () => {
			const task = makeTask({ workflow_step: 'implement' })
			const result = advanceWorkflow(reviewWorkflow, task, 'done', testAgents)
			expect(result.action).toBe('assign_agent')
			expect(result.nextStep).toBe('review')
			expect(result.assignTo).toBe('maria')
		})

		it('blocks approval when review has min_approvals=2 and 0 approvals', () => {
			const task = makeTask({ workflow_step: 'review', history: [] })
			const result = advanceWorkflow(reviewWorkflow, task, 'approved', testAgents)
			expect(result.action).toBe('no_action')
			expect(result.error).toContain('Review requirements not met')
		})

		it('blocks approval when review has min_approvals=2 and only 1 approval', () => {
			const task = makeTask({
				workflow_step: 'review',
				history: [
					{
						at: '2026-01-01T01:00:00Z',
						by: 'maria',
						action: 'approved',
						step: 'review',
					},
				],
			})
			const result = advanceWorkflow(reviewWorkflow, task, 'approved', testAgents)
			expect(result.action).toBe('no_action')
			expect(result.error).toContain('Review requirements not met')
		})

		it('allows approval when review has min_approvals=2 and 2 approvals', () => {
			const task = makeTask({
				workflow_step: 'review',
				history: [
					{
						at: '2026-01-01T01:00:00Z',
						by: 'maria',
						action: 'approved',
						step: 'review',
					},
					{
						at: '2026-01-01T02:00:00Z',
						by: 'peter',
						action: 'approved',
						step: 'review',
					},
				],
			})
			const result = advanceWorkflow(reviewWorkflow, task, 'approved', testAgents)
			expect(result.action).toBe('notify_human')
			expect(result.nextStep).toBe('human_merge')
			expect(result.gate).toBe('merge')
		})
	})

	describe('multiple sequential transitions', () => {
		it('walks scope-equivalent flow: implement → review → human_merge → deploy → complete', () => {
			// implement → review
			let task = makeTask({ workflow_step: 'implement' })
			let result = advanceWorkflow(reviewWorkflow, task, 'done', testAgents)
			expect(result.action).toBe('assign_agent')
			expect(result.nextStep).toBe('review')

			// review → human_merge (with 2 approvals)
			task = makeTask({
				workflow_step: 'review',
				history: [
					{ at: '2026-01-02T01:00:00Z', by: 'maria', action: 'approved', step: 'review' },
					{ at: '2026-01-02T02:00:00Z', by: 'peter', action: 'approved', step: 'review' },
				],
			})
			result = advanceWorkflow(reviewWorkflow, task, 'approved', testAgents)
			expect(result.action).toBe('notify_human')
			expect(result.nextStep).toBe('human_merge')

			// human_merge → deploy
			task = makeTask({ workflow_step: 'human_merge' })
			result = advanceWorkflow(reviewWorkflow, task, 'approved', testAgents)
			expect(result.action).toBe('assign_agent')
			expect(result.nextStep).toBe('deploy')
			expect(result.assignTo).toBe('jan')

			// deploy → complete
			task = makeTask({ workflow_step: 'deploy' })
			result = advanceWorkflow(reviewWorkflow, task, 'success', testAgents)
			expect(result.action).toBe('complete')
			expect(result.nextStep).toBe('complete')
		})
	})

	describe('no matching step for current workflow_step', () => {
		it('returns error when workflow_step does not exist in workflow', () => {
			const task = makeTask({ workflow_step: 'nonexistent-step' })
			const result = evaluateTransition(reviewWorkflow, task, testAgents)
			expect(result.action).toBe('error')
			expect(result.error).toContain('not found')
		})

		it('advanceWorkflow returns error for unknown step', () => {
			const task = makeTask({ workflow_step: 'ghost-step' })
			const result = advanceWorkflow(reviewWorkflow, task, 'done', testAgents)
			expect(result.action).toBe('error')
			expect(result.error).toContain('not found')
		})
	})

	describe('auto-execute step', () => {
		it('deploy step returns assign_agent (auto_execute=true)', () => {
			const task = makeTask({ workflow_step: 'deploy' })
			const result = evaluateTransition(reviewWorkflow, task, testAgents)
			expect(result.action).toBe('assign_agent')
			expect(result.assignTo).toBe('jan')
			expect(result.assignRole).toBe('devops')
		})

		it('rollback step also returns assign_agent (auto_execute=true)', () => {
			const task = makeTask({ workflow_step: 'rollback' })
			const result = evaluateTransition(reviewWorkflow, task, testAgents)
			expect(result.action).toBe('assign_agent')
			expect(result.assignTo).toBe('jan')
			expect(result.assignRole).toBe('devops')
		})
	})

	describe('review with min_approvals=2', () => {
		it('isReviewSatisfied returns false with 0 approvals', () => {
			const step = resolveWorkflowStep(reviewWorkflow, 'review')!
			const task = makeTask({ workflow_step: 'review', history: [] })
			expect(isReviewSatisfied(step, task, testAgents)).toBe(false)
		})

		it('isReviewSatisfied returns false with 1 approval', () => {
			const step = resolveWorkflowStep(reviewWorkflow, 'review')!
			const task = makeTask({
				workflow_step: 'review',
				history: [
					{ at: '2026-01-01T01:00:00Z', by: 'maria', action: 'approved', step: 'review' },
				],
			})
			expect(isReviewSatisfied(step, task, testAgents)).toBe(false)
		})

		it('isReviewSatisfied returns true with 2 approvals', () => {
			const step = resolveWorkflowStep(reviewWorkflow, 'review')!
			const task = makeTask({
				workflow_step: 'review',
				history: [
					{ at: '2026-01-01T01:00:00Z', by: 'maria', action: 'approved', step: 'review' },
					{ at: '2026-01-01T02:00:00Z', by: 'peter', action: 'approved', step: 'review' },
				],
			})
			expect(isReviewSatisfied(step, task, testAgents)).toBe(true)
		})

		it('isReviewSatisfied ignores approvals from other steps', () => {
			const step = resolveWorkflowStep(reviewWorkflow, 'review')!
			const task = makeTask({
				workflow_step: 'review',
				history: [
					{ at: '2026-01-01T01:00:00Z', by: 'maria', action: 'approved', step: 'implement' },
					{ at: '2026-01-01T02:00:00Z', by: 'peter', action: 'approved', step: 'implement' },
				],
			})
			expect(isReviewSatisfied(step, task, testAgents)).toBe(false)
		})

		it('isReviewSatisfied only counts approvals from allowed roles', () => {
			const step = resolveWorkflowStep(reviewWorkflow, 'review')!
			const task = makeTask({
				workflow_step: 'review',
				history: [
					{ at: '2026-01-01T01:00:00Z', by: 'maria', action: 'approved', step: 'review' },
					{ at: '2026-01-01T02:00:00Z', by: 'marketing-bot', action: 'approved', step: 'review' },
				],
			})
			// marketing-bot has no matching agent, so only 1 valid approval
			expect(isReviewSatisfied(step, task, testAgents)).toBe(false)
		})
	})

	describe('conditional transitions', () => {
		it('deploy has success and failure transitions to different steps', () => {
			const task = makeTask({ workflow_step: 'deploy' })

			const successResult = advanceWorkflow(reviewWorkflow, task, 'success', testAgents)
			expect(successResult.action).toBe('complete')
			expect(successResult.nextStep).toBe('complete')

			const failResult = advanceWorkflow(reviewWorkflow, task, 'failure', testAgents)
			expect(failResult.action).toBe('assign_agent')
			expect(failResult.nextStep).toBe('rollback')
			expect(failResult.assignTo).toBe('jan')
		})

		it('human_merge has approved and rejected transitions', () => {
			const task = makeTask({ workflow_step: 'human_merge' })

			const approvedResult = advanceWorkflow(reviewWorkflow, task, 'approved', testAgents)
			expect(approvedResult.nextStep).toBe('deploy')

			const rejectedResult = advanceWorkflow(reviewWorkflow, task, 'rejected', testAgents)
			expect(rejectedResult.nextStep).toBe('implement')
		})

		it('returns error for non-existent transition key', () => {
			const task = makeTask({ workflow_step: 'deploy' })
			const result = advanceWorkflow(reviewWorkflow, task, 'timeout', testAgents)
			expect(result.action).toBe('error')
			expect(result.error).toContain("No transition 'timeout'")
		})
	})

	describe('terminal step', () => {
		it('evaluateTransition returns complete for terminal step', () => {
			const task = makeTask({ workflow_step: 'complete' })
			const result = evaluateTransition(reviewWorkflow, task, testAgents)
			expect(result.action).toBe('complete')
			expect(result.nextStep).toBe('complete')
		})

		it('advanceWorkflow to terminal produces complete action', () => {
			const task = makeTask({ workflow_step: 'deploy' })
			const result = advanceWorkflow(reviewWorkflow, task, 'success', testAgents)
			expect(result.action).toBe('complete')
			expect(result.nextStep).toBe('complete')
		})
	})

	describe('human gate', () => {
		it('evaluateTransition returns notify_human with correct gate type', () => {
			const task = makeTask({ workflow_step: 'human_merge' })
			const result = evaluateTransition(reviewWorkflow, task, testAgents)
			expect(result.action).toBe('notify_human')
			expect(result.gate).toBe('merge')
			expect(result.nextStep).toBe('human_merge')
		})
	})

	describe('getAssignee with explicit assigned_to vs assigned_role', () => {
		it('uses assigned_to when explicitly set on step', () => {
			const step = { ...resolveWorkflowStep(reviewWorkflow, 'implement')!, assigned_to: 'maria' }
			const assignee = getAssignee(step, testAgents)
			expect(assignee).toBe('maria')
		})

		it('falls back to assigned_role when assigned_to is not set', () => {
			const step = resolveWorkflowStep(reviewWorkflow, 'implement')!
			const assignee = getAssignee(step, testAgents)
			expect(assignee).toBe('peter')
		})

		it('returns undefined when assigned_to does not match any agent', () => {
			const step = { ...resolveWorkflowStep(reviewWorkflow, 'implement')!, assigned_to: 'nonexistent-agent' }
			// assigned_to is set but doesn't match — falls back to role
			const assignee = getAssignee(step, testAgents)
			// The implementation checks assigned_to first, if agent not found, falls to role
			expect(assignee).toBe('peter')
		})

		it('returns undefined when no agents match at all', () => {
			const step = resolveWorkflowStep(reviewWorkflow, 'implement')!
			const assignee = getAssignee(step, [])
			expect(assignee).toBeUndefined()
		})
	})

	describe('task at terminal step — no further transitions', () => {
		it('has no available transitions from terminal step', () => {
			const step = resolveWorkflowStep(reviewWorkflow, 'complete')!
			expect(Object.keys(step.transitions)).toHaveLength(0)
		})

		it('advanceWorkflow from terminal returns error for any key', () => {
			const task = makeTask({ workflow_step: 'complete' })
			const result = advanceWorkflow(reviewWorkflow, task, 'done', testAgents)
			// Terminal step has no transitions so this should error
			expect(result.action).toBe('error')
			expect(result.error).toContain("No transition 'done'")
		})
	})
})
