import cron from 'node-cron'
import { join } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
import type { Schedule } from '@questpie/autopilot-spec'
import { ScheduleSchema, PATHS } from '@questpie/autopilot-spec'
import { readYaml } from '../fs/yaml'
import { logger } from '../logger'

/** Configuration for the cron-based {@link Scheduler}. */
export interface SchedulerOptions {
	companyRoot: string
	onTrigger: (schedule: Schedule) => Promise<void>
}

/**
 * Runs cron jobs defined in `team/schedules/*.yaml`.
 *
 * Each enabled schedule with a valid cron expression creates a
 * `node-cron` task. On trigger the `onTrigger` callback is invoked
 * with the schedule definition.
 */
export class Scheduler {
	private jobs: Map<string, cron.ScheduledTask> = new Map()

	constructor(private options: SchedulerOptions) {}

	/** Load schedules from disk and start cron jobs. */
	async start(): Promise<void> {
		await this.loadSchedules()
	}

	/** Stop all cron jobs and clear the internal map. */
	stop(): void {
		for (const job of this.jobs.values()) {
			job.stop()
		}
		this.jobs.clear()
	}

	/** Stop all running jobs and reload schedules from disk. */
	async reload(): Promise<void> {
		this.stop()
		await this.loadSchedules()
	}

	/** Return the IDs of all currently active cron jobs. */
	getActiveJobs(): string[] {
		return [...this.jobs.keys()]
	}

	private async loadSchedules(): Promise<void> {
		const schedulesDir = join(this.options.companyRoot, 'team', 'schedules')
		if (!existsSync(schedulesDir)) return

		const files = readdirSync(schedulesDir).filter((f) => f.endsWith('.yaml'))

		for (const file of files) {
			let schedule: Schedule
			try {
				schedule = await readYaml(join(schedulesDir, file), ScheduleSchema)
			} catch (err) {
				logger.warn('scheduler', `failed to parse schedule ${file}: ${err instanceof Error ? err.message : String(err)}`)
				continue
			}

			if (!schedule.enabled) continue

			if (!cron.validate(schedule.cron)) {
				logger.warn('scheduler', `invalid cron expression for ${schedule.id}: ${schedule.cron}`)
				continue
			}

			const task = cron.schedule(schedule.cron, async () => {
				try {
					await this.options.onTrigger(schedule)
				} catch (err) {
					logger.error('scheduler', `error in job ${schedule.id}`, { error: err instanceof Error ? err.message : String(err) })
				}
			})

			this.jobs.set(schedule.id, task)
		}
	}
}
