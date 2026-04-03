/**
 * End-to-end dogfood proving test.
 *
 * Exercises the real dogfood workflow:
 *   plan → validate-plan → generate-impl-prompt → implement →
 *   validate-impl → review (human) → done
 *
 * Uses real config loading (.autopilot/ YAML), real DB, real WorkflowEngine.
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { loadCompany, loadAgents, loadWorkflows, loadEnvironments } from '../src/config/loader'
import { TaskService, RunService, WorkflowEngine, ActivityService } from '../src/services'
import type { AuthoredConfig } from '../src/services'

const REPO_ROOT = join(__dirname, '..', '..', '..')
const CAPS = [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: [] }]

describe('Dogfood E2E', () => {
	const companyRoot = join(tmpdir(), `qp-dogfood-e2e-${Date.now()}`)
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService
	let activityService: ActivityService
	let engine: WorkflowEngine
	let config: AuthoredConfig

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot', 'agents'), { recursive: true })
		await mkdir(join(companyRoot, '.autopilot', 'workflows'), { recursive: true })
		await mkdir(join(companyRoot, '.autopilot', 'environments'), { recursive: true })

		const companyYaml = await readFile(join(REPO_ROOT, '.autopilot', 'company.yaml'), 'utf-8')
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), companyYaml)

		const devYaml = await readFile(join(REPO_ROOT, '.autopilot', 'agents', 'dev.yaml'), 'utf-8')
		await writeFile(join(companyRoot, '.autopilot', 'agents', 'dev.yaml'), devYaml)

		const dogfoodYaml = await readFile(join(REPO_ROOT, '.autopilot', 'workflows', 'dogfood.yaml'), 'utf-8')
		await writeFile(join(companyRoot, '.autopilot', 'workflows', 'dogfood.yaml'), dogfoodYaml)

		const company = await loadCompany(companyRoot)
		const agents = new Map((await loadAgents(companyRoot)).map((a) => [a.id, a]))
		const workflows = new Map((await loadWorkflows(companyRoot)).map((w) => [w.id, w]))
		const environments = new Map((await loadEnvironments(companyRoot)).map((e) => [e.id, e]))
		const defaults = {
			runtime: company.defaults.runtime ?? 'claude-code',
			workflow: company.defaults.workflow,
			task_assignee: company.defaults.task_assignee,
		}
		config = { company, agents, workflows, environments, defaults }

		dbResult = await createCompanyDb(companyRoot)
		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
		activityService = new ActivityService(dbResult.db)
		engine = new WorkflowEngine(config, taskService, runService, activityService)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	async function claimAndComplete(workerId: string, runId: string) {
		await runService.claim(workerId, 'claude-code', CAPS)
		await runService.complete(runId, { status: 'completed', summary: 'done' })
	}

	// Helper: advance through a sequence of agent steps, returning the last advance result
	async function runAgentSteps(taskId: string, steps: Array<{ outputs?: Record<string, string> }>) {
		let last: Awaited<ReturnType<typeof engine.advance>> = null
		for (let i = 0; i < steps.length; i++) {
			const step = steps[i]!
			const task = await taskService.get(taskId)
			const runs = await runService.list({ task_id: taskId, status: 'pending' })
			const pendingRun = runs[0]
			if (pendingRun) {
				await claimAndComplete(`w-${Date.now()}-${i}`, pendingRun.id)
			}
			last = await engine.advance(taskId, step.outputs)
		}
		return last
	}

	test('real config loads and validates', () => {
		expect(config.agents.has('dev')).toBe(true)
		expect(config.workflows.has('dogfood')).toBe(true)
		expect(config.defaults.workflow).toBe('dogfood')

		const wf = config.workflows.get('dogfood')!
		const stepIds = wf.steps.map((s) => s.id)
		expect(stepIds).toEqual(['plan', 'validate-plan', 'generate-impl-prompt', 'implement', 'validate-impl', 'review', 'done'])

		const issues = engine.validate()
		expect(issues).toEqual([])
	})

	test('happy path: plan → validate(approved) → gen-prompt → impl → validate(approved) → review(approve) → done', async () => {
		const taskId = `task-happy-${Date.now()}`
		await taskService.create({
			id: taskId, title: 'Add README comment', type: 'feature',
			description: 'Add a one-line comment', created_by: 'dominik',
		})

		// 1. Intake → plan
		const intake = await engine.intake(taskId)
		expect(intake!.task.workflow_step).toBe('plan')

		// 2. Plan completes → validate-plan
		await claimAndComplete('w1', intake!.runId!)
		const adv1 = await engine.advance(taskId)
		expect(adv1!.task.workflow_step).toBe('validate-plan')

		// 3. Validator approves → generate-impl-prompt
		await claimAndComplete('w2', adv1!.runId!)
		const adv2 = await engine.advance(taskId, { outcome: 'approved' })
		expect(adv2!.task.workflow_step).toBe('generate-impl-prompt')
		expect(adv2!.runId).not.toBeNull()

		// 4. Prompt generated → implement
		await claimAndComplete('w3', adv2!.runId!)
		const adv3 = await engine.advance(taskId)
		expect(adv3!.task.workflow_step).toBe('implement')

		// 5. Implementation completes → validate-impl
		await claimAndComplete('w4', adv3!.runId!)
		const adv4 = await engine.advance(taskId)
		expect(adv4!.task.workflow_step).toBe('validate-impl')

		// 6. Validator approves → review (human)
		await claimAndComplete('w5', adv4!.runId!)
		const adv5 = await engine.advance(taskId, { outcome: 'approved' })
		expect(adv5!.task.workflow_step).toBe('review')
		expect(adv5!.task.status).toBe('blocked')

		// 7. Human approves → done
		const approved = await engine.approve(taskId, 'dominik')
		expect(approved!.task.workflow_step).toBe('done')
		expect(approved!.task.status).toBe('done')
	})

	test('plan validation loop: validate(revise) → plan → validate(approved) → generate-impl-prompt', async () => {
		const taskId = `task-plan-loop-${Date.now()}`
		await taskService.create({
			id: taskId, title: 'Plan loop test', type: 'feature', created_by: 'dominik',
		})

		const intake = await engine.intake(taskId)
		await claimAndComplete('w1', intake!.runId!)

		// → validate-plan
		const adv1 = await engine.advance(taskId)
		expect(adv1!.task.workflow_step).toBe('validate-plan')
		await claimAndComplete('w2', adv1!.runId!)

		// Revise → back to plan
		const adv2 = await engine.advance(taskId, { outcome: 'revise' })
		expect(adv2!.task.workflow_step).toBe('plan')
		await claimAndComplete('w3', adv2!.runId!)

		// → validate-plan again
		const adv3 = await engine.advance(taskId)
		await claimAndComplete('w4', adv3!.runId!)

		// Approved → generate-impl-prompt
		const adv4 = await engine.advance(taskId, { outcome: 'approved' })
		expect(adv4!.task.workflow_step).toBe('generate-impl-prompt')
	})

	test('implementation validation loop: validate-impl(revise) → implement', async () => {
		const taskId = `task-impl-loop-${Date.now()}`
		await taskService.create({
			id: taskId, title: 'Impl loop test', type: 'feature', created_by: 'dominik',
		})

		// Fast-forward: plan → validate(approved) → gen-prompt → implement
		const intake = await engine.intake(taskId)
		await claimAndComplete('w1', intake!.runId!)
		const a1 = await engine.advance(taskId)
		await claimAndComplete('w2', a1!.runId!)
		const a2 = await engine.advance(taskId, { outcome: 'approved' }) // → gen-prompt
		await claimAndComplete('w3', a2!.runId!)
		const a3 = await engine.advance(taskId) // → implement
		await claimAndComplete('w4', a3!.runId!)

		// → validate-impl
		const a4 = await engine.advance(taskId)
		expect(a4!.task.workflow_step).toBe('validate-impl')
		await claimAndComplete('w5', a4!.runId!)

		// Revise → back to implement
		const a5 = await engine.advance(taskId, { outcome: 'revise' })
		expect(a5!.task.workflow_step).toBe('implement')
		expect(a5!.runId).not.toBeNull()
	})

	test('human review reply routes back to implement', async () => {
		const taskId = `task-review-reply-${Date.now()}`
		await taskService.create({
			id: taskId, title: 'Review reply test', type: 'feature', created_by: 'dominik',
		})

		// Fast-forward to review: plan → validate(approved) → gen-prompt → impl → validate(approved) → review
		const intake = await engine.intake(taskId)
		await claimAndComplete('w1', intake!.runId!)
		const a1 = await engine.advance(taskId)
		await claimAndComplete('w2', a1!.runId!)
		const a2 = await engine.advance(taskId, { outcome: 'approved' })
		await claimAndComplete('w3', a2!.runId!)
		const a3 = await engine.advance(taskId)
		await claimAndComplete('w4', a3!.runId!)
		const a4 = await engine.advance(taskId)
		await claimAndComplete('w5', a4!.runId!)
		const a5 = await engine.advance(taskId, { outcome: 'approved' })
		expect(a5!.task.workflow_step).toBe('review')

		// Human reply → back to implement
		const replied = await engine.reply(taskId, 'Fix the edge case', 'dominik')
		expect(replied!.task.workflow_step).toBe('implement')
		expect(replied!.runId).not.toBeNull()

		const run = await runService.get(replied!.runId!)
		expect(run!.instructions).toContain('Fix the edge case')
	})

	test('generate-impl-prompt step creates a run with the right instructions', async () => {
		const taskId = `task-gen-prompt-${Date.now()}`
		await taskService.create({
			id: taskId, title: 'Prompt gen test', type: 'feature', created_by: 'dominik',
		})

		// plan → validate(approved) → generate-impl-prompt
		const intake = await engine.intake(taskId)
		await claimAndComplete('w1', intake!.runId!)
		const a1 = await engine.advance(taskId)
		await claimAndComplete('w2', a1!.runId!)
		const a2 = await engine.advance(taskId, { outcome: 'approved' })

		expect(a2!.task.workflow_step).toBe('generate-impl-prompt')
		expect(a2!.runId).not.toBeNull()

		// Verify the run has the right instructions
		const run = await runService.get(a2!.runId!)
		expect(run!.instructions).toContain('implementation prompt')
		expect(run!.agent_id).toBe('dev')
	})

	test('can cancel a pending run', async () => {
		const taskId = `task-cancel-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Cancel me', type: 'chore', created_by: 'dominik' })

		const intake = await engine.intake(taskId)
		const cancelled = await runService.cancel(intake!.runId!, 'changed my mind')
		expect(cancelled!.status).toBe('failed')
		expect(cancelled!.error).toBe('changed my mind')
	})
})
