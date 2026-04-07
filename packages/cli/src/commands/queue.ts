import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, table, error, separator } from '../utils/format'
import { createApiClient } from '../utils/client'

const statusColor = (s: string) => {
	switch (s) {
		case 'done': return 'green' as const
		case 'active': return 'cyan' as const
		case 'blocked': return 'yellow' as const
		case 'failed': return 'red' as const
		default: return 'dim' as const
	}
}

const queueCmd = new Command('queue')
	.description('Inspect task queues')
	.action(async () => {
		try {
			const client = createApiClient()
			const res = await client.api.queues.$get()
			if (!res.ok) {
				console.error(error('Failed to fetch queues'))
				process.exit(1)
			}

			const queues = (await res.json()) as Array<{
				name: string
				max_concurrent: number
				priority_order: string
				active_count: number
				pending_tasks: number
			}>

			console.log(section('Task Queues'))
			if (queues.length === 0) {
				console.log(dim('  No queues configured'))
				console.log(dim('  Define queues in .autopilot/company.yaml under "queues:"'))
				return
			}

			console.log(
				table(
					queues.map((q) => [
						q.name,
						`${q.active_count}/${q.max_concurrent} active`,
						`${q.pending_tasks} pending`,
						dim(q.priority_order),
					]),
				),
			)
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

queueCmd.addCommand(
	new Command('show')
		.description('Show details about a specific queue')
		.argument('<name>', 'Queue name')
		.action(async (name: string) => {
			try {
				const client = createApiClient()
				const res = await client.api.queues[':name'].$get({ param: { name } })
				if (!res.ok) {
					console.error(error(`Queue not found: ${name}`))
					process.exit(1)
				}

				const queue = (await res.json()) as {
					name: string
					max_concurrent: number
					priority_order: string
					active_count: number
					summary: { running: number; pending: number; done: number; failed: number; total: number }
					tasks: Array<{ id: string; title: string; status: string; priority: string; created_at: string }>
				}

				console.log(section(`Queue: ${queue.name}`))
				console.log(`  ${dim('Concurrency:')}  ${queue.active_count}/${queue.max_concurrent}`)
				console.log(`  ${dim('Order:')}        ${queue.priority_order}`)
				console.log(`  ${dim('Running:')}      ${queue.summary.running}`)
				console.log(`  ${dim('Pending:')}      ${queue.summary.pending}`)
				console.log(`  ${dim('Done:')}         ${queue.summary.done}`)
				console.log(`  ${dim('Failed:')}       ${queue.summary.failed}`)
				console.log('')

				if (queue.tasks.length > 0) {
					console.log(separator())
					console.log(
						table(
							queue.tasks.map((t) => [
								dim(t.id),
								badge(t.status, statusColor(t.status)),
								t.title,
								dim(t.priority ?? 'medium'),
							]),
						),
					)
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(queueCmd)
