import cron from 'node-cron'
import { join } from 'node:path'
import type { Schedule } from '@questpie/autopilot-spec'
import { SchedulesFileSchema } from '@questpie/autopilot-spec'
import { readYaml } from '../fs/yaml'

export interface SchedulerOptions {
	companyRoot: string
	onTrigger: (schedule: Schedule) => Promise<void>
}

export class Scheduler {
	private jobs: Map<string, cron.ScheduledTask> = new Map()

	constructor(private options: SchedulerOptions) {}

	async start(): Promise<void> {
		await this.loadSchedules()
	}

	stop(): void {
		for (const job of this.jobs.values()) {
			job.stop()
		}
		this.jobs.clear()
	}

	async reload(): Promise<void> {
		this.stop()
		await this.loadSchedules()
	}

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
