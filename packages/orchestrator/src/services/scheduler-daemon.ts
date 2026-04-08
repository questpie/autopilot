/**
 * Scheduler daemon — polls for due schedules and executes them.
 *
 * Runs as a periodic timer inside the orchestrator process.
 * Each tick finds schedules where next_run_at <= now, checks concurrency policy,
 * creates the task or query, records the execution, and advances next_run_at.
 */
import type { ScheduleService, ScheduleRow } from './schedules'
import { interpolateTemplate } from './schedules'
import type { WorkflowEngine } from './workflow-engine'
import type { AuthoredConfig } from './workflow-engine'
import type { QueryService } from './queries'
import type { ActivityService } from './activity'

export class SchedulerDaemon {
	private timer: ReturnType<typeof setInterval> | null = null
	private ticking = false

	constructor(
		private scheduleService: ScheduleService,
		private workflowEngine: WorkflowEngine,
		private queryService: QueryService | null,
		private activityService: ActivityService | null,
		private authoredConfig?: AuthoredConfig,
	) {}

	start(intervalMs = 15_000): void {
		// Run immediately on start
		void this.tick()
		this.timer = setInterval(() => void this.tick(), intervalMs)
		this.timer.unref()
		console.log(`[scheduler] daemon started (interval: ${intervalMs}ms)`)
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
	}

	async tick(): Promise<void> {
		if (this.ticking) return // prevent overlapping ticks
		this.ticking = true
		try {
			const now = new Date()
			const due = await this.scheduleService.findDue(now)
			for (const schedule of due) {
				try {
					await this.execute(schedule, now)
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					console.error(`[scheduler] failed to execute schedule ${schedule.id}: ${msg}`)

					// Record the failure without crashing the daemon
					try {
						await this.scheduleService.recordExecution({
							schedule_id: schedule.id,
							status: 'failed',
							error: msg,
							triggered_at: now.toISOString(),
						})
						await this.scheduleService.advanceSchedule(schedule.id, now)
					} catch (recordErr) {
						console.error(`[scheduler] failed to record execution error for ${schedule.id}:`, recordErr instanceof Error ? recordErr.message : String(recordErr))
					}
				}
			}
		} catch (err) {
			console.error('[scheduler] tick error:', err instanceof Error ? err.message : String(err))
		} finally {
			this.ticking = false
		}
	}

	async execute(schedule: ScheduleRow, now: Date): Promise<void> {
		// ── Validate agent exists in authored config ─────────────────────
		if (this.authoredConfig && schedule.agent_id && !this.authoredConfig.agents.has(schedule.agent_id)) {
			const reason = `agent "${schedule.agent_id}" not found in authored config`
			console.warn(`[scheduler] skipping schedule ${schedule.id}: ${reason}`)
			await this.scheduleService.recordExecution({
				schedule_id: schedule.id,
				status: 'failed',
				error: reason,
				triggered_at: now.toISOString(),
			})
			await this.scheduleService.advanceSchedule(schedule.id, now)
			return
		}

		const mode = schedule.mode ?? 'task'
		const concurrencyPolicy = schedule.concurrency_policy ?? 'skip'

		// ── Concurrency check ───────────────────────────────────────────
		if (concurrencyPolicy === 'skip') {
			const active = await this.scheduleService.findActiveExecution(schedule.id)
			if (active) {
				console.log(`[scheduler] skipping ${schedule.id} — active execution ${active.id} in progress`)
				await this.scheduleService.recordExecution({
					schedule_id: schedule.id,
					status: 'skipped',
					skip_reason: `active execution ${active.id} still in progress`,
					triggered_at: now.toISOString(),
				})
				await this.scheduleService.advanceSchedule(schedule.id, now)
				return
			}
		}

		// ── Execute based on mode ───────────────────────────────────────
		if (mode === 'query') {
			await this.executeQuery(schedule, now)
		} else {
			await this.executeTask(schedule, now)
		}
	}

	private async executeTask(schedule: ScheduleRow, now: Date): Promise<void> {
		// Parse and interpolate task template
		let template: Record<string, string> = {}
		try {
			template = JSON.parse(schedule.task_template ?? '{}')
		} catch (err) {
			console.warn(`[scheduler] malformed task_template JSON for schedule ${schedule.id}:`, err instanceof Error ? err.message : String(err))
		}

		const title = interpolateTemplate(
			template.title ?? `Scheduled: ${schedule.name}`,
			now,
		)
		const description = template.description
			? interpolateTemplate(template.description, now)
			: undefined

		const result = await this.workflowEngine.materializeTask({
			title,
			type: template.type ?? 'scheduled',
			description,
			priority: template.priority,
			assigned_to: schedule.agent_id,
			workflow_id: schedule.workflow_id ?? undefined,
			created_by: `scheduler:${schedule.id}`,
		})

		if (!result) {
			throw new Error('materializeTask returned null')
		}

		await this.scheduleService.recordExecution({
			schedule_id: schedule.id,
			task_id: result.task.id,
			status: 'triggered',
			triggered_at: now.toISOString(),
		})

		await this.scheduleService.advanceSchedule(schedule.id, now)

		if (this.activityService) {
			await this.activityService.log({
				actor: `scheduler:${schedule.id}`,
				type: 'schedule_triggered',
				summary: `Schedule "${schedule.name}" created task ${result.task.id}`,
				details: JSON.stringify({
					schedule_id: schedule.id,
					task_id: result.task.id,
					run_id: result.runId,
				}),
			})
		}

		console.log(`[scheduler] ${schedule.id} triggered task ${result.task.id}`)
	}

	private async executeQuery(schedule: ScheduleRow, now: Date): Promise<void> {
		if (!this.queryService) {
			throw new Error('query mode requires QueryService but it is not available')
		}

		let queryTemplate: Record<string, unknown> = {}
		try {
			queryTemplate = JSON.parse(schedule.query_template ?? '{}')
		} catch (err) {
			console.warn(`[scheduler] malformed query_template JSON for schedule ${schedule.id}:`, err instanceof Error ? err.message : String(err))
		}

		const prompt = interpolateTemplate(
			String(queryTemplate.prompt ?? `Scheduled query: ${schedule.name}`),
			now,
		)
		const allowRepoMutation = queryTemplate.allow_repo_mutation === true

		const query = await this.queryService.create({
			prompt,
			agent_id: schedule.agent_id,
			allow_repo_mutation: allowRepoMutation,
			created_by: `scheduler:${schedule.id}`,
		})

		await this.scheduleService.recordExecution({
			schedule_id: schedule.id,
			query_id: query.id,
			status: 'triggered',
			triggered_at: now.toISOString(),
		})

		await this.scheduleService.advanceSchedule(schedule.id, now)

		if (this.activityService) {
			await this.activityService.log({
				actor: `scheduler:${schedule.id}`,
				type: 'schedule_triggered',
				summary: `Schedule "${schedule.name}" created query ${query.id}`,
				details: JSON.stringify({
					schedule_id: schedule.id,
					query_id: query.id,
				}),
			})
		}

		console.log(`[scheduler] ${schedule.id} triggered query ${query.id}`)
	}
}
