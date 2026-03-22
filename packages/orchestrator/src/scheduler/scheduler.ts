import cron from 'node-cron'
import { join } from 'node:path'
import type { Schedule } from '@questpie/autopilot-spec'
import { SchedulesFileSchema } from '@questpie/autopilot-spec'
import { readYaml } from '../fs/yaml'

/** Configuration for the cron-based {@link Scheduler}. */
export interface SchedulerOptions {
	companyRoot: string
	onTrigger: (schedule: Schedule) => Promise<void>
}

/**
 * Runs cron jobs defined in `schedules.yaml`.
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
		const schedulesPath = join(this.options.companyRoot, 'team', 'schedules.yaml')
		const file = await readYaml(schedulesPath, SchedulesFileSchema)

		for (const schedule of file.schedules) {
			if (!schedule.enabled) continue

			if (!cron.validate(schedule.cron)) {
				console.warn(`[scheduler] invalid cron expression for ${schedule.id}: ${schedule.cron}`)
				continue
			}

			const task = cron.schedule(schedule.cron, async () => {
				try {
					await this.options.onTrigger(schedule)
				} catch (err) {
					console.error(`[scheduler] error in job ${schedule.id}:`, err)
				}
			})

			this.jobs.set(schedule.id, task)
		}
	}
}
