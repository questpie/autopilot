/**
 * Tests for workflow control flow: transitions, on_approve/on_reply/on_reject routing.
 *
 * Covers:
 * - Linear workflow still works without control flow fields
 * - Agent outcome routes via transitions map
 * - Agent revise outcome loops back
 * - Missing outcome uses default next step
 * - Human on_approve routes to explicit target
 * - Human on_reply routes to explicit target (with reply message)
 * - Human on_reject routes to explicit target (not just done)
 * - Default human routing when no on_* fields set
 * - Validation catches unknown transition targets
 * - Full dogfood-style loop scenario
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkflowEngine, ActivityService } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { Workflow } from '@questpie/autopilot-spec'

const CAPS = [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: [] }]

function makeConfig(workflows: Workflow[]): AuthoredConfig {
	return {
		company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: 'Test', email: 'test@test.com' }, defaults: {} },
		agents: new Map([['dev', { id: 'dev', name: 'Dev', role: 'developer', description: '' }]]),
		workflows: new Map(workflows.map((w) => [w.id, w])),
		environments: new Map(),
		providers: new Map(),
		capabilityProfiles: new Map(),
		defaults: { runtime: 'claude-code', workflow: workflows[0]?.id, task_assignee: 'dev' },
	}
}

describe('Workflow Control Flow', () => {
	const companyRoot = join(tmpdir(), `qp-control-flow-${Date.now()}`)
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService
	let activityService: ActivityService

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n')
		dbResult = await createCompanyDb(companyRoot)
		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
		activityService = new ActivityService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	async function claimAndComplete(workerId: string, runId: string, outcome?: string) {
		await runService.claim(workerId, 'claude-code', CAPS)
		await runService.complete(runId, { status: 'completed', summary: 'done' })
		return outcome // outcome is used by advance(), not complete()
	}

	// ── Linear workflow still works ─────────────────────────────────

	test('linear workflow advances by array order', async () => {
		const wf: Workflow = {
			id: 'linear', name: 'Linear', description: '', steps: [
				{ id: 'step1', type: 'agent', agent_id: 'dev', actions: [] },
				{ id: 'step2', type: 'agent', agent_id: 'dev', actions: [] },
				{ id: 'step3', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-linear-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Linear test', type: 'test', created_by: 'test' })
		const intake = await engine.intake(taskId)
		expect(intake!.task.workflow_step).toBe('step1')

		await claimAndComplete('w1', intake!.runId!)
		const adv1 = await engine.advance(taskId)
		expect(adv1!.task.workflow_step).toBe('step2')

		await claimAndComplete('w2', adv1!.runId!)
		const adv2 = await engine.advance(taskId)
		expect(adv2!.task.workflow_step).toBe('step3')
		expect(adv2!.task.status).toBe('done')
	})

	// ── Agent outcome routes via transitions ────────────────────────

	test('agent outcome routes via transitions map', async () => {
		const wf: Workflow = {
			id: 'branching', name: 'Branching', description: '', steps: [
				{ id: 'validate', type: 'agent', agent_id: 'dev', transitions: [{ when: { outcome: 'approved' }, goto: 'deploy' }, { when: { outcome: 'revise' }, goto: 'fix' }], actions: [] },
				{ id: 'fix', type: 'agent', agent_id: 'dev', next: 'validate', actions: [] },
				{ id: 'deploy', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-branch-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Branch test', type: 'test', created_by: 'test' })
		const intake = await engine.intake(taskId)
		expect(intake!.task.workflow_step).toBe('validate')

		// Complete with 'revise' outcome → should go to 'fix'
		await claimAndComplete('w1', intake!.runId!)
		const adv1 = await engine.advance(taskId, { outcome: 'revise' })
		expect(adv1!.task.workflow_step).toBe('fix')
		expect(adv1!.actions).toContain('outcome:revise')

		// Fix completes → explicit next: validate
		await claimAndComplete('w2', adv1!.runId!)
		const adv2 = await engine.advance(taskId)
		expect(adv2!.task.workflow_step).toBe('validate')

		// Now validate with 'approved' outcome → done
		await claimAndComplete('w3', adv2!.runId!)
		const adv3 = await engine.advance(taskId, { outcome: 'approved' })
		expect(adv3!.task.workflow_step).toBe('deploy')
		expect(adv3!.task.status).toBe('done')
	})

	test('missing outcome uses default next step', async () => {
		const wf: Workflow = {
			id: 'default-next', name: 'Default', description: '', steps: [
				{ id: 'step1', type: 'agent', agent_id: 'dev', transitions: [{ when: { outcome: 'special' }, goto: 'step3' }], actions: [] },
				{ id: 'step2', type: 'done', actions: [] },
				{ id: 'step3', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-default-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Default next test', type: 'test', created_by: 'test' })
		const intake = await engine.intake(taskId)

		// Complete without outcome → default next (step2)
		await claimAndComplete('w1', intake!.runId!)
		const adv = await engine.advance(taskId)
		expect(adv!.task.workflow_step).toBe('step2')
	})

	// ── Human approval routing ──────────────────────────────────────

	test('on_approve routes to explicit target', async () => {
		const wf: Workflow = {
			id: 'approval-route', name: 'Approval Route', description: '', steps: [
				{ id: 'work', type: 'agent', agent_id: 'dev', actions: [] },
				{ id: 'review', type: 'human_approval', on_approve: 'finish', actions: [] },
				{ id: 'redo', type: 'agent', agent_id: 'dev', actions: [] },
				{ id: 'finish', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-approve-route-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Approve route', type: 'test', created_by: 'test' })
		const intake = await engine.intake(taskId)
		await claimAndComplete('w1', intake!.runId!)
		await engine.advance(taskId) // → review (blocked)

		const approved = await engine.approve(taskId, 'test')
		// Should jump to 'finish', not 'redo' (array order)
		expect(approved!.task.workflow_step).toBe('finish')
		expect(approved!.task.status).toBe('done')
	})

	test('on_reply routes to explicit target with message', async () => {
		const wf: Workflow = {
			id: 'reply-route', name: 'Reply Route', description: '', steps: [
				{ id: 'impl', type: 'agent', agent_id: 'dev', actions: [] },
				{ id: 'review', type: 'human_approval', on_reply: 'impl', on_approve: 'finish', actions: [] },
				{ id: 'finish', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-reply-route-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Reply route', type: 'test', created_by: 'test' })
		const intake = await engine.intake(taskId)
		await claimAndComplete('w1', intake!.runId!)
		await engine.advance(taskId) // → review

		// Reply should route back to impl
		const replied = await engine.reply(taskId, 'Fix the tests too', 'test')
		expect(replied!.task.workflow_step).toBe('impl')
		expect(replied!.runId).not.toBeNull()

		// The new run should have the reply baked into instructions
		const run = await runService.get(replied!.runId!)
		expect(run!.instructions).toContain('Fix the tests too')
	})

	test('on_reject routes to explicit target instead of done', async () => {
		const wf: Workflow = {
			id: 'reject-route', name: 'Reject Route', description: '', steps: [
				{ id: 'impl', type: 'agent', agent_id: 'dev', actions: [] },
				{ id: 'review', type: 'human_approval', on_reject: 'impl', actions: [] },
				{ id: 'finish', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-reject-route-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Reject route', type: 'test', created_by: 'test' })
		const intake = await engine.intake(taskId)
		await claimAndComplete('w1', intake!.runId!)
		await engine.advance(taskId) // → review

		// Reject routes back to impl instead of marking done
		const rejected = await engine.reject(taskId, 'Start over', 'test')
		expect(rejected!.task.workflow_step).toBe('impl')
		expect(rejected!.task.status).toBe('active')
		expect(rejected!.runId).not.toBeNull()
	})

	test('default human routing when no on_* fields', async () => {
		const wf: Workflow = {
			id: 'default-human', name: 'Default Human', description: '', steps: [
				{ id: 'impl', type: 'agent', agent_id: 'dev', actions: [] },
				{ id: 'review', type: 'human_approval', actions: [] },
				{ id: 'finish', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-default-human-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Default human', type: 'test', created_by: 'test' })
		const intake = await engine.intake(taskId)
		await claimAndComplete('w1', intake!.runId!)
		await engine.advance(taskId) // → review

		// Approve without on_approve → default next (finish)
		const approved = await engine.approve(taskId, 'test')
		expect(approved!.task.workflow_step).toBe('finish')
		expect(approved!.task.status).toBe('done')
	})

	// ── Validation ──────────────────────────────────────────────────

	test('validation catches unknown transition targets', () => {
		const wf: Workflow = {
			id: 'bad-refs', name: 'Bad Refs', description: '', steps: [
				{ id: 'step1', type: 'agent', agent_id: 'dev', transitions: [{ when: { outcome: 'bad' }, goto: 'nonexistent' }], actions: [] },
				{ id: 'step2', type: 'human_approval', on_approve: 'nowhere', on_reply: 'ghost', on_reject: 'phantom', actions: [] },
				{ id: 'step3', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const issues = engine.validate()
		expect(issues.length).toBe(4)
		expect(issues.some((i) => i.includes('transition {"outcome":"bad"} → "nonexistent" target does not exist'))).toBe(true)
		expect(issues.some((i) => i.includes('on_approve="nowhere"'))).toBe(true)
		expect(issues.some((i) => i.includes('on_reply="ghost"'))).toBe(true)
		expect(issues.some((i) => i.includes('on_reject="phantom"'))).toBe(true)
	})

	// ── Full dogfood loop scenario ──────────────────────────────────

	test('plan → validate → reply loops back → re-plan → approve → implement → review → done', async () => {
		const wf: Workflow = {
			id: 'loop', name: 'Loop', description: '', steps: [
				{ id: 'plan', type: 'agent', agent_id: 'dev', actions: [] },
				{ id: 'validate-plan', type: 'human_approval', on_approve: 'implement', on_reply: 'plan', on_reject: 'done', actions: [] },
				{ id: 'implement', type: 'agent', agent_id: 'dev', actions: [] },
				{ id: 'review', type: 'human_approval', on_approve: 'done', on_reply: 'implement', on_reject: 'done', actions: [] },
				{ id: 'done', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-loop-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Loop test', type: 'test', created_by: 'test' })

		// 1. Intake → plan
		const intake = await engine.intake(taskId)
		expect(intake!.task.workflow_step).toBe('plan')

		// 2. Plan completes → validate-plan
		await claimAndComplete('w1', intake!.runId!)
		await engine.advance(taskId)
		expect((await taskService.get(taskId))!.workflow_step).toBe('validate-plan')

		// 3. Human replies "needs more detail" → loops back to plan
		const replied = await engine.reply(taskId, 'needs more detail', 'test')
		expect(replied!.task.workflow_step).toBe('plan')
		expect(replied!.runId).not.toBeNull()

		// 4. Re-plan completes → validate-plan again
		await claimAndComplete('w2', replied!.runId!)
		await engine.advance(taskId)
		expect((await taskService.get(taskId))!.workflow_step).toBe('validate-plan')

		// 5. Human approves this time → implement
		const approved1 = await engine.approve(taskId, 'test')
		expect(approved1!.task.workflow_step).toBe('implement')

		// 6. Implement completes → review
		await claimAndComplete('w3', approved1!.runId!)
		await engine.advance(taskId)
		expect((await taskService.get(taskId))!.workflow_step).toBe('review')

		// 7. Human replies "fix tests" → loops back to implement
		const replied2 = await engine.reply(taskId, 'fix tests', 'test')
		expect(replied2!.task.workflow_step).toBe('implement')

		// 8. Re-implement completes → review again
		await claimAndComplete('w4', replied2!.runId!)
		await engine.advance(taskId)

		// 9. Human approves → done
		const approved2 = await engine.approve(taskId, 'test')
		expect(approved2!.task.workflow_step).toBe('done')
		expect(approved2!.task.status).toBe('done')
	})
})
