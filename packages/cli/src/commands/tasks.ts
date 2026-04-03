import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, table, success, error, separator } from '../utils/format'
import { createApiClient } from '../utils/client'

const tasksCmd = new Command('tasks')
	.description('List and manage tasks')
	.option('-s, --status <status>', 'Filter by task status')
	.option('-a, --assigned <agent>', 'Filter by assigned agent ID')
	.action(async (opts: { status?: string; assigned?: string }) => {
		try {
			const client = createApiClient()

			const query: Record<string, string> = {}
			if (opts.status) query.status = opts.status
			if (opts.assigned) query.assigned_to = opts.assigned

			const res = await client.api.tasks.$get({ query })
			if (!res.ok) {
				console.error(error('Failed to fetch tasks'))
				process.exit(1)
			}

			const tasks = (await res.json()) as Array<{
				id: string
				status: string
				title: string
				assigned_to?: string | null
				type: string
			}>

			console.log(section('Tasks'))
			if (tasks.length === 0) {
				console.log(dim('  No tasks found'))
				if (opts.status || opts.assigned) {
					console.log(
						dim(
							`  Filters: ${opts.status ? `status=${opts.status}` : ''} ${opts.assigned ? `assigned_to=${opts.assigned}` : ''}`,
						),
					)
				}
				return
			}

			console.log(
				table(
					tasks.map((t) => [
						dim(t.id),
						badge(
							t.status,
							t.status === 'done'
								? 'green'
								: t.status === 'blocked'
									? 'red'
									: 'cyan',
						),
						t.title,
						t.assigned_to ? dim(`-> ${t.assigned_to}`) : '',
					]),
				),
			)
			console.log('')
			console.log(separator())
			const blockedCount = tasks.filter((t) => t.status === 'blocked').length
			console.log(dim(`${tasks.length} task(s)`) + (blockedCount > 0 ? `  ${badge(`${blockedCount} awaiting approval`, 'red')}` : ''))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

tasksCmd.addCommand(
	new Command('show')
		.description('Show detailed information about a task')
		.argument('<id>', 'Task ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()

				const res = await client.api.tasks[':id'].$get({ param: { id } })

				if (!res.ok) {
					console.error(error(`Task not found: ${id}`))
					console.error(dim('Use "autopilot tasks" to list all tasks.'))
					process.exit(1)
				}

				const task = (await res.json()) as {
					id: string
					title: string
					status: string
					type: string
					priority?: string
					assigned_to?: string | null
					workflow_id?: string | null
					workflow_step?: string | null
					created_by?: string
					created_at: string
					updated_at?: string
					description?: string | null
				}

				console.log(section(task.title))
				console.log('')
				console.log(`  ${dim('ID:')}          ${task.id}`)
				console.log(`  ${dim('Status:')}      ${badge(task.status, task.status === 'blocked' ? 'red' : task.status === 'done' ? 'green' : 'cyan')}`)
				console.log(`  ${dim('Type:')}        ${task.type}`)
				if (task.priority) console.log(`  ${dim('Priority:')}    ${task.priority}`)
				console.log(`  ${dim('Assigned:')}    ${task.assigned_to ?? 'unassigned'}`)
				if (task.workflow_id) console.log(`  ${dim('Workflow:')}    ${task.workflow_id}`)
				if (task.workflow_step) console.log(`  ${dim('Step:')}        ${task.workflow_step}`)
				if (task.created_by) console.log(`  ${dim('Created by:')}  ${task.created_by}`)
				console.log(`  ${dim('Created at:')}  ${task.created_at}`)
				if (task.updated_at) console.log(`  ${dim('Updated at:')}  ${task.updated_at}`)

				if (task.status === 'blocked') {
					console.log('')
					console.log(`  ${badge('WAITING FOR APPROVAL', 'red')}`)
					console.log(dim('  Use: autopilot tasks approve|reject|reply ' + task.id))
				}

				if (task.description) {
					console.log('')
					console.log(dim('Description:'))
					console.log(`  ${task.description}`)
				}

				// Show approval history
				try {
					const actRes = await client.api.tasks[':id'].activity.$get({ param: { id } })
					if (actRes.ok) {
						const entries = (await actRes.json()) as Array<{
							type: string; actor: string; summary: string; created_at: string
						}>
						if (entries.length > 0) {
							console.log('')
							console.log(dim('Approval history:'))
							for (const e of entries) {
								const icon = e.type === 'approval' ? '+' : e.type === 'rejection' ? 'x' : '>'
								console.log(`  ${dim(e.created_at)} [${icon}] ${e.summary}`)
							}
						}
					}
				} catch {
					// Activity endpoint may not exist in older servers
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('create')
		.description('Create a new task')
		.requiredOption('-t, --title <title>', 'Task title')
		.requiredOption('--type <type>', 'Task type (e.g. feature, bug, chore)')
		.option('-d, --description <desc>', 'Task description')
		.option('--priority <priority>', 'Priority (low, medium, high, critical)')
		.option('--assign <agent>', 'Assign to agent ID')
		.action(
			async (opts: {
				title: string
				type: string
				description?: string
				priority?: string
				assign?: string
			}) => {
				try {
					const client = createApiClient()

					const res = await client.api.tasks.$post({
						json: {
							title: opts.title,
							type: opts.type,
							description: opts.description,
							priority: opts.priority,
							assigned_to: opts.assign,
						},
					})

					if (!res.ok) {
						console.error(error('Failed to create task'))
						process.exit(1)
					}

					const task = (await res.json()) as { id: string; title: string }
					console.log(success(`Task created: ${task.id}`))
					console.log(dim(`  ${task.title}`))
				} catch (err) {
					console.error(error(err instanceof Error ? err.message : String(err)))
					process.exit(1)
				}
			},
		),
)

tasksCmd.addCommand(
	new Command('update')
		.description('Update a task')
		.argument('<id>', 'Task ID')
		.option('-s, --status <status>', 'New status')
		.option('-t, --title <title>', 'New title')
		.option('-d, --description <desc>', 'New description')
		.option('--priority <priority>', 'New priority')
		.option('--assign <agent>', 'Assign to agent ID')
		.action(
			async (
				id: string,
				opts: {
					status?: string
					title?: string
					description?: string
					priority?: string
					assign?: string
				},
			) => {
				try {
					const client = createApiClient()

					const body: Record<string, string> = {}
					if (opts.status) body.status = opts.status
					if (opts.title) body.title = opts.title
					if (opts.description) body.description = opts.description
					if (opts.priority) body.priority = opts.priority
					if (opts.assign) body.assigned_to = opts.assign

					if (Object.keys(body).length === 0) {
						console.error(error('No updates provided. Use --status, --title, etc.'))
						process.exit(1)
					}

					const res = await client.api.tasks[':id'].$patch({
						param: { id },
						json: body,
					})

					if (!res.ok) {
						console.error(error(`Failed to update task: ${id}`))
						process.exit(1)
					}

					const task = (await res.json()) as { id: string; status: string }
					console.log(success(`Task ${task.id} updated (status: ${task.status})`))
				} catch (err) {
					console.error(error(err instanceof Error ? err.message : String(err)))
					process.exit(1)
				}
			},
		),
)

tasksCmd.addCommand(
	new Command('approve')
		.description('Approve a task waiting on a human_approval step')
		.argument('<id>', 'Task ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()
				const res = await client.api.tasks[':id'].approve.$post({ param: { id } })
				if (!res.ok) {
					const body = (await res.json()) as { error?: string }
					console.error(error(body.error ?? 'Approval failed'))
					process.exit(1)
				}
				const result = (await res.json()) as { task: { id: string; status: string; workflow_step?: string }; actions: string[] }
				console.log(success(`Task ${id} approved`))
				console.log(dim(`  Status: ${result.task.status}`))
				if (result.task.workflow_step) console.log(dim(`  Step: ${result.task.workflow_step}`))
				console.log(dim(`  Actions: ${result.actions.join(', ')}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('reject')
		.description('Reject a task waiting on a human_approval step')
		.argument('<id>', 'Task ID')
		.requiredOption('-m, --message <message>', 'Rejection reason')
		.action(async (id: string, opts: { message: string }) => {
			try {
				const client = createApiClient()
				const res = await client.api.tasks[':id'].reject.$post({
					param: { id },
					json: { message: opts.message },
				})
				if (!res.ok) {
					const body = (await res.json()) as { error?: string }
					console.error(error(body.error ?? 'Rejection failed'))
					process.exit(1)
				}
				console.log(success(`Task ${id} rejected`))
				console.log(dim(`  Reason: ${opts.message}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('reply')
		.description('Reply to a task waiting on a human_approval step and advance workflow')
		.argument('<id>', 'Task ID')
		.requiredOption('-m, --message <message>', 'Reply message (becomes instructions for next step)')
		.action(async (id: string, opts: { message: string }) => {
			try {
				const client = createApiClient()
				const res = await client.api.tasks[':id'].reply.$post({
					param: { id },
					json: { message: opts.message },
				})
				if (!res.ok) {
					const body = (await res.json()) as { error?: string }
					console.error(error(body.error ?? 'Reply failed'))
					process.exit(1)
				}
				const result = (await res.json()) as { task: { id: string; status: string; workflow_step?: string }; runId: string | null; actions: string[] }
				console.log(success(`Task ${id} replied`))
				console.log(dim(`  Status: ${result.task.status}`))
				if (result.runId) console.log(dim(`  Run created: ${result.runId}`))
				console.log(dim(`  Actions: ${result.actions.join(', ')}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(tasksCmd)
