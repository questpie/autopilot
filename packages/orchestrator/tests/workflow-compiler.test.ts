import { describe, expect, it } from 'bun:test'
import type { Workflow } from '@questpie/autopilot-spec'
import { compileWorkflow, compileWorkflowStep, isCompiledWorkflow } from '../src/workflow'

describe('workflow compiler', () => {
	it('normalizes legacy agent steps into compiled contracts', () => {
		const step = compileWorkflowStep({
			id: 'implement',
			type: 'agent',
			assigned_role: 'developer',
			description: 'Implement the change',
			review: {
				reviewers_roles: ['reviewer'],
				min_approvals: 1,
				on_reject: 'revise',
			},
			transitions: { done: 'complete' },
			auto_execute: false,
			max_retries: 0,
		})

		expect(step.instructions).toBe('Implement the change')
		expect(step.executor).toEqual({
			kind: 'agent',
			role: 'developer',
			agentId: undefined,
			gate: undefined,
			tool: undefined,
			workflow: undefined,
			modelPolicy: undefined,
		})
		expect(step.validation.mode).toBe('review')
		expect(step.validation.reviewersRoles).toEqual(['reviewer'])
		expect(step.failurePolicy.action).toBe('revise')
	})

	it('preserves explicit step contract fields', () => {
		const step = compileWorkflowStep({
			id: 'research',
			type: 'agent',
			assigned_role: 'strategist',
			description: 'Research the problem space',
			instructions: 'Gather five concrete examples and return a recommendation.',
			model_policy: 'cheap-research',
			max_retries: 2,
			validate: {
				mode: 'auto',
				required_outputs: ['recommendation'],
				rules: [{ type: 'min_items', target: 'examples', value: 5, params: {} }],
			},
			on_fail: {
				action: 'escalate',
				model_policy: 'smart-review',
				input_map: {},
			},
			transitions: { done: 'complete' },
			auto_execute: false,
		})

		expect(step.instructions).toContain('Gather five concrete examples')
		expect(step.modelPolicy).toBe('cheap-research')
		expect(step.executor?.modelPolicy).toBe('cheap-research')
		expect(step.validation.mode).toBe('auto')
		expect(step.validation.requiredOutputs).toEqual(['recommendation'])
		expect(step.failurePolicy).toEqual({
			action: 'escalate',
			maxRetries: 2,
			modelPolicy: 'smart-review',
			workflow: undefined,
			inputMap: {},
			idempotencyKey: undefined,
		})
	})

	it('compiles explicit sub-workflow steps with idempotency config', () => {
		const step = compileWorkflowStep({
			id: 'design-pass',
			type: 'sub_workflow',
			description: 'Run the design-to-code child workflow',
			executor: {
				kind: 'sub_workflow',
				workflow: 'design-to-code',
				model_policy: 'smart-plan',
			},
			spawn_workflow: {
				workflow: 'design-to-code',
				input_map: { brief: 'task.title' },
				result_map: { mockup: 'artifacts.mockup' },
				idempotency_key: '{{task.id}}:design-pass',
			},
			transitions: { done: 'complete' },
			auto_execute: false,
		})

		expect(step.executor).toEqual({
			kind: 'sub_workflow',
			role: undefined,
			agentId: undefined,
			gate: undefined,
			tool: undefined,
			workflow: 'design-to-code',
			modelPolicy: 'smart-plan',
		})
		expect(step.spawnWorkflow).toEqual({
			workflow: 'design-to-code',
			inputMap: { brief: 'task.title' },
			resultMap: { mockup: 'artifacts.mockup' },
			idempotencyKey: '{{task.id}}:design-pass',
		})
	})

	it('compiles workflows idempotently', () => {
		const workflow: Workflow = {
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
					transitions: { done: 'complete' },
					auto_execute: false,
					description: '',
					max_retries: 0,
				},
				{
					id: 'complete',
					type: 'terminal',
					transitions: {},
					auto_execute: false,
					description: '',
					max_retries: 0,
				},
			],
		}

		const compiled = compileWorkflow(workflow)
		expect(isCompiledWorkflow(compiled)).toBe(true)
		expect(compileWorkflow(compiled)).toBe(compiled)
		expect(compiled.steps[0]?.validation.mode).toBe('auto')
		expect(compiled.steps[1]?.failurePolicy.action).toBe('block')
	})
})
