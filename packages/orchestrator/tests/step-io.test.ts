/**
 * Tests for declarative step output + context forwarding.
 *
 * Covers:
 * - Output suffix auto-generation from step.output declaration
 * - Outcome extraction still works through generated suffix
 * - Source run summary forwarded to next step (not "last completed run")
 * - Explicit artifact input via step.input.artifacts
 * - Forwarding uses correct source in loops
 * - Output/transition consistency validation
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { TaskService, RunService, WorkflowEngine, ActivityService, ArtifactService } from '../src/services'
import type { AuthoredConfig } from '../src/services'
import type { Workflow } from '@questpie/autopilot-spec'
import { generateOutputSuffix } from '../src/services/workflow-engine'

const CAPS = [{ runtime: 'claude-code', models: [], maxConcurrent: 1, tags: [] }]

function makeConfig(workflows: Workflow[]): AuthoredConfig {
	return {
		company: { name: 'test', slug: 'test', description: '', timezone: 'UTC', language: 'en', owner: { name: 'Test', email: 'test@test.com' }, defaults: {} },
		agents: new Map([['dev', { id: 'dev', name: 'Dev', role: 'developer', description: '' }]]),
		workflows: new Map(workflows.map((w) => [w.id, w])),
		environments: new Map(),
		defaults: { runtime: 'claude-code', workflow: workflows[0]?.id, task_assignee: 'dev' },
	}
}

describe('Step I/O', () => {
	const companyRoot = join(tmpdir(), `qp-step-io-${Date.now()}`)
	let dbResult: CompanyDbResult
	let taskService: TaskService
	let runService: RunService
	let activityService: ActivityService
	let artifactService: ArtifactService

	beforeAll(async () => {
		await mkdir(join(companyRoot, '.autopilot'), { recursive: true })
		await writeFile(join(companyRoot, '.autopilot', 'company.yaml'), 'name: test\nslug: test\nowner:\n  name: Test\n  email: test@test.com\n')
		dbResult = await createCompanyDb(companyRoot)
		taskService = new TaskService(dbResult.db)
		runService = new RunService(dbResult.db)
		activityService = new ActivityService(dbResult.db)
		artifactService = new ArtifactService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	async function claimAndComplete(workerId: string, runId: string, summary?: string) {
		await runService.claim(workerId, 'claude-code', CAPS)
		await runService.complete(runId, { status: 'completed', summary: summary ?? 'done' })
	}

	// ── Output suffix generation ────────────────────────────────────

	test('generateOutputSuffix produces correct format for outcome + summary', () => {
		const suffix = generateOutputSuffix({
			id: 'test', type: 'agent', actions: [],
			output: {
				outcome: {
					description: 'Whether it is ready',
					values: { approved: 'Ready to go', revise: 'Needs changes' },
				},
				summary: { description: 'Brief result' },
			},
		})

		expect(suffix).not.toBeNull()
		expect(suffix).toContain('<AUTOPILOT_RESULT>')
		expect(suffix).toContain('<outcome>OUTCOME_VALUE</outcome>')
		expect(suffix).toContain('<summary>Brief result</summary>')
		expect(suffix).toContain('- approved — Ready to go')
		expect(suffix).toContain('- revise — Needs changes')
	})

	test('generateOutputSuffix handles generic tags with values', () => {
		const suffix = generateOutputSuffix({
			id: 'test', type: 'agent', actions: [],
			output: {
				priority: {
					description: 'How urgent',
					values: { high: 'Must fix now', low: 'Nice to have' },
				},
			},
		})

		expect(suffix).toContain('<priority>PRIORITY_VALUE</priority>')
		expect(suffix).toContain('- high — Must fix now')
		expect(suffix).toContain('- low — Nice to have')
	})

	test('generateOutputSuffix produces artifact tags', () => {
		const suffix = generateOutputSuffix({
			id: 'test', type: 'agent', actions: [],
			output: {
				artifacts: [
					{ kind: 'implementation_prompt', title: 'Impl Prompt', description: 'Full implementation instructions' },
				],
			},
		})

		expect(suffix).toContain('<artifact kind="implementation_prompt" title="Impl Prompt">')
		expect(suffix).toContain('Full implementation instructions')
	})

	test('generateOutputSuffix returns null when no output declared', () => {
		expect(generateOutputSuffix({ id: 'test', type: 'agent', actions: [] })).toBeNull()
	})

	// ── Source run context forwarding ────────────────────────────────

	test('next step receives source run summary as context', async () => {
		const wf: Workflow = {
			id: 'fwd', name: 'Forward', description: '', steps: [
				{ id: 'plan', type: 'agent', agent_id: 'dev', instructions: 'Make a plan', actions: [] },
				{ id: 'validate', type: 'agent', agent_id: 'dev', instructions: 'Check the plan', actions: [] },
				{ id: 'done', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService, artifactService)

		const taskId = `task-fwd-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Forward test', type: 'test', created_by: 'test' })

		const intake = await engine.intake(taskId)
		const planRunId = intake!.runId!

		// Plan run completes with specific summary
		await claimAndComplete('w1', planRunId, 'Here is the detailed plan: step 1, step 2, step 3')

		// Advance — source run is the plan run
		const adv = await engine.advance(taskId, undefined, planRunId)
		expect(adv!.task.workflow_step).toBe('validate')

		// The validate run should have the plan summary as context
		const validateRun = await runService.get(adv!.runId!)
		expect(validateRun!.instructions).toContain('Here is the detailed plan')
		expect(validateRun!.instructions).toContain('Check the plan')
	})

	test('forwarding uses source run, not last completed run', async () => {
		// This proves the correction: after a loop, the source is the step
		// that directly caused advancement, not the chronologically last run
		const wf: Workflow = {
			id: 'loop-ctx', name: 'Loop Context', description: '', steps: [
				{ id: 'gen', type: 'agent', agent_id: 'dev', instructions: 'Generate prompt', actions: [] },
				{ id: 'impl', type: 'agent', agent_id: 'dev', instructions: 'Implement', actions: [] },
				{ id: 'validate', type: 'agent', agent_id: 'dev', instructions: 'Validate', actions: [],
					transitions: { approved: 'done', revise: 'impl' },
					output: { outcome: { description: 'result', values: { approved: 'ok', revise: 'fix' } } },
				},
				{ id: 'done', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService, artifactService)

		const taskId = `task-loop-ctx-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Loop ctx', type: 'test', created_by: 'test' })

		// gen → impl → validate (revise) → impl again
		const intake = await engine.intake(taskId)
		await claimAndComplete('w1', intake!.runId!, 'Generated prompt content')
		const a1 = await engine.advance(taskId, undefined, intake!.runId!)

		await claimAndComplete('w2', a1!.runId!, 'First implementation attempt')
		const a2 = await engine.advance(taskId, undefined, a1!.runId!)

		// Validate says revise — source is the validate run
		await claimAndComplete('w3', a2!.runId!, 'Tests fail: fix line 42')
		const a3 = await engine.advance(taskId, 'revise', a2!.runId!)

		// The re-impl run should have the VALIDATE summary (direct source),
		// NOT the gen or first impl summary
		const reimplRun = await runService.get(a3!.runId!)
		expect(reimplRun!.instructions).toContain('Tests fail: fix line 42')
		expect(reimplRun!.instructions).not.toContain('Generated prompt content')
	})

	// ── Explicit artifact input ─────────────────────────────────────

	test('step.input.artifacts includes requested artifact content in instructions', async () => {
		const wf: Workflow = {
			id: 'art-input', name: 'Artifact Input', description: '', steps: [
				{ id: 'gen', type: 'agent', agent_id: 'dev', instructions: 'Generate', actions: [] },
				{ id: 'impl', type: 'agent', agent_id: 'dev', instructions: 'Implement',
					input: { artifacts: ['implementation_prompt'] }, actions: [] },
				{ id: 'done', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService, artifactService)

		const taskId = `task-art-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Art input', type: 'test', created_by: 'test' })

		const intake = await engine.intake(taskId)
		const genRunId = intake!.runId!

		// Simulate: gen step produced an implementation_prompt artifact
		await artifactService.create({
			id: `art-${Date.now()}`,
			run_id: genRunId,
			task_id: taskId,
			kind: 'implementation_prompt',
			title: 'Implementation Prompt',
			ref_kind: 'inline',
			ref_value: '1. Modify server.ts\n2. Add route handler\n3. Write tests',
		})

		await claimAndComplete('w1', genRunId, 'Prompt generated')
		const adv = await engine.advance(taskId, undefined, genRunId)

		// The impl run should have the artifact content in its instructions
		const implRun = await runService.get(adv!.runId!)
		expect(implRun!.instructions).toContain('Modify server.ts')
		expect(implRun!.instructions).toContain('Add route handler')
		expect(implRun!.instructions).toContain('Write tests')
		// Also has its own step instructions
		expect(implRun!.instructions).toContain('Implement')
	})

	test('artifact input survives loops — uses most recent artifact of that kind', async () => {
		const wf: Workflow = {
			id: 'art-loop', name: 'Artifact Loop', description: '', steps: [
				{ id: 'gen', type: 'agent', agent_id: 'dev', instructions: 'Generate', actions: [] },
				{ id: 'impl', type: 'agent', agent_id: 'dev', instructions: 'Implement',
					input: { artifacts: ['implementation_prompt'] }, actions: [] },
				{ id: 'validate', type: 'agent', agent_id: 'dev', instructions: 'Validate', actions: [],
					transitions: { revise: 'impl', approved: 'done' } },
				{ id: 'done', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService, artifactService)

		const taskId = `task-art-loop-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Art loop', type: 'test', created_by: 'test' })

		const intake = await engine.intake(taskId)
		const genRunId = intake!.runId!

		// Register the implementation prompt artifact
		await artifactService.create({
			id: `art-loop-${Date.now()}`,
			run_id: genRunId,
			task_id: taskId,
			kind: 'implementation_prompt',
			title: 'Implementation Prompt',
			ref_kind: 'inline',
			ref_value: 'THE REAL PROMPT CONTENT',
		})

		await claimAndComplete('w1', genRunId, 'Prompt ready')
		const a1 = await engine.advance(taskId, undefined, genRunId)

		await claimAndComplete('w2', a1!.runId!, 'First attempt')
		const a2 = await engine.advance(taskId, undefined, a1!.runId!)

		// Validate says revise → back to impl
		await claimAndComplete('w3', a2!.runId!, 'Fix the tests')
		const a3 = await engine.advance(taskId, 'revise', a2!.runId!)

		// The re-impl run should still have the prompt artifact (from gen step)
		// even though the last completed run was the validator
		const reimplRun = await runService.get(a3!.runId!)
		expect(reimplRun!.instructions).toContain('THE REAL PROMPT CONTENT')
		// And the validator feedback as source context
		expect(reimplRun!.instructions).toContain('Fix the tests')
	})

	// ── Validation ──────────────────────────────────────────────────

	test('validates outcome/transition key consistency', () => {
		const wf: Workflow = {
			id: 'mismatch', name: 'Mismatch', description: '', steps: [
				{
					id: 'step1', type: 'agent', agent_id: 'dev', actions: [],
					output: { outcome: { description: 'result', values: { approved: 'ok', revise: 'fix' } } },
					transitions: { approved: 'step2', reject: 'step2' }, // 'reject' not in outcome, 'revise' not in transitions
				},
				{ id: 'step2', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const issues = engine.validate()
		expect(issues.some((i) => i.includes('"revise" but no matching transition'))).toBe(true)
		expect(issues.some((i) => i.includes('"reject" has no matching output.outcome'))).toBe(true)
	})

	// ── Output suffix in instructions ───────────────────────────────

	test('step with output declaration gets suffix in run instructions', async () => {
		const wf: Workflow = {
			id: 'suffix', name: 'Suffix', description: '', steps: [
				{
					id: 'validate', type: 'agent', agent_id: 'dev', actions: [],
					instructions: 'Check the code.',
					output: {
						outcome: { description: 'result', values: { approved: 'ok', revise: 'fix needed' } },
						summary: { description: 'Brief result' },
					},
					transitions: { approved: 'done', revise: 'validate' },
				},
				{ id: 'done', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-suffix-${Date.now()}`
		await taskService.create({ id: taskId, title: 'Suffix test', type: 'test', created_by: 'test' })

		const intake = await engine.intake(taskId)
		const run = await runService.get(intake!.runId!)

		// Should have step instructions
		expect(run!.instructions).toContain('Check the code.')
		// Should have auto-generated suffix
		expect(run!.instructions).toContain('<AUTOPILOT_RESULT>')
		expect(run!.instructions).toContain('<outcome>OUTCOME_VALUE</outcome>')
		expect(run!.instructions).toContain('- approved — ok')
		expect(run!.instructions).toContain('- revise — fix needed')
	})

	test('step without output declaration has no suffix', async () => {
		const wf: Workflow = {
			id: 'no-suffix', name: 'No Suffix', description: '', steps: [
				{ id: 'work', type: 'agent', agent_id: 'dev', instructions: 'Do the work.', actions: [] },
				{ id: 'done', type: 'done', actions: [] },
			],
		}
		const config = makeConfig([wf])
		const engine = new WorkflowEngine(config, taskService, runService, activityService)

		const taskId = `task-nosuffix-${Date.now()}`
		await taskService.create({ id: taskId, title: 'No suffix', type: 'test', created_by: 'test' })

		const intake = await engine.intake(taskId)
		const run = await runService.get(intake!.runId!)

		expect(run!.instructions).toBe('Do the work.')
		expect(run!.instructions).not.toContain('AUTOPILOT_RESULT')
	})
})
