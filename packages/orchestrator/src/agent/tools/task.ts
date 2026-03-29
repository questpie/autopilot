import { z } from 'zod'
import type { StorageBackend, Task } from '../../fs/storage'
import type { ToolDefinition } from '../tools'
import { getIndexer } from './shared'

export function createTaskTool(storage: StorageBackend): ToolDefinition {
	return {
		name: 'task',
		description: 'Manage tasks: create, update, approve, reject, block, or unblock.',
		schema: z.object({
			action: z.enum(['create', 'update', 'approve', 'reject', 'block', 'unblock']),
			task_id: z.string().optional().describe('Required for update/approve/reject/block/unblock'),
			title: z.string().optional().describe('For create'),
			description: z.string().optional().describe('For create/update'),
			type: z.enum(['intent', 'planning', 'implementation', 'review', 'deployment', 'marketing', 'monitoring', 'human_required']).optional().describe('For create'),
			priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('For create/update'),
			assigned_to: z.string().optional().describe('For create/update'),
			project: z.string().optional().describe('For create/update'),
			workflow: z.string().optional().describe('For create'),
			status: z.enum(['draft', 'backlog', 'assigned', 'in_progress', 'review', 'blocked', 'done', 'cancelled']).optional().describe('For update'),
			note: z.string().optional().describe('For update/block/unblock'),
			reason: z.string().optional().describe('For block/reject'),
			blocker_assigned_to: z.string().optional().describe('For block: who should resolve'),
		}),
		execute: async (args, ctx) => {
			switch (args.action) {
				// ── create ──────────────────────────────────────────────
				case 'create': {
					if (!args.title) {
						return { content: [{ type: 'text' as const, text: 'Error: title is required for create' }], isError: true }
					}
					const task = await storage.createTask({
						title: args.title,
						description: args.description ?? '',
						type: args.type ?? 'implementation',
						status: args.assigned_to ? 'assigned' : 'backlog',
						priority: args.priority ?? 'medium',
						created_by: ctx.agentId,
						assigned_to: args.assigned_to,
						project: args.project,
						depends_on: [],
						workflow: args.workflow,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					})
					ctx.eventBus.emit({ type: 'task_changed', taskId: task.id, status: task.status, assignedTo: task.assigned_to })
					// Real-time index
					getIndexer().then((idx) => idx?.indexOne('task', task.id, task.title, `${task.title} ${task.description ?? ''} ${task.status} ${task.type}`)).catch(() => {})

					// Auto-create task channel
					const taskChannelId = `task-${task.id}`
					try {
						await storage.createChannel({
							id: taskChannelId,
							name: `Task ${task.id}`,
							type: 'group',
							description: task.title,
							created_by: ctx.agentId,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
							metadata: {},
						})
						await storage.addChannelMember(taskChannelId, ctx.agentId, 'agent', 'member')
						if (task.assigned_to) {
							await storage.addChannelMember(taskChannelId, task.assigned_to, 'agent', 'member')
						}
						ctx.eventBus.emit({ type: 'channel_created', channelId: taskChannelId, name: `Task ${task.id}` })
					} catch {
						// Channel may already exist — safe to ignore
					}

					return { content: [{ type: 'text' as const, text: `Created task ${task.id}: ${task.title}` }] }
				}

				// ── update ──────────────────────────────────────────────
				case 'update': {
					if (!args.task_id) {
						return { content: [{ type: 'text' as const, text: 'Error: task_id is required for update' }], isError: true }
					}
					// If note provided, append to task history
					if (args.note) {
						const task = await storage.readTask(args.task_id)
						const timestamp = new Date().toISOString()
						const history = [...(task?.history ?? []), {
							at: timestamp,
							by: ctx.agentId,
							action: 'note',
							note: args.note,
						}]
						await storage.updateTask(args.task_id, { history, updated_at: timestamp }, ctx.agentId)
					}

					// If status provided, update and move task
					if (args.status) {
						await storage.updateTask(args.task_id, { status: args.status }, ctx.agentId)
						await storage.moveTask(args.task_id, args.status, ctx.agentId)
						// Remove cancelled tasks from search index
						if (args.status === 'cancelled') {
							getIndexer().then((idx) => idx?.removeOne('task', args.task_id!)).catch(() => {})
						}
					}

					// Update other fields if provided
					const updates: Partial<Task> = {}
					if (args.description !== undefined) updates.description = args.description
					if (args.priority !== undefined) updates.priority = args.priority
					if (args.assigned_to !== undefined) updates.assigned_to = args.assigned_to
					if (args.project !== undefined) updates.project = args.project
					if (Object.keys(updates).length > 0) {
						updates.updated_at = new Date().toISOString()
						await storage.updateTask(args.task_id, updates, ctx.agentId)
					}

					// Emit event
					const updatedTask = await storage.readTask(args.task_id)
					ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: updatedTask?.status ?? 'unknown', assignedTo: updatedTask?.assigned_to })
					// Re-index on update
					if (updatedTask) {
						getIndexer().then((idx) => idx?.indexOne('task', updatedTask.id, updatedTask.title, `${updatedTask.title} ${updatedTask.description ?? ''} ${updatedTask.status} ${updatedTask.type}`)).catch(() => {})
					}

					return { content: [{ type: 'text' as const, text: `Updated task ${args.task_id}` }] }
				}

				// ── approve ─────────────────────────────────────────────
				case 'approve': {
					if (!args.task_id) {
						return { content: [{ type: 'text' as const, text: 'Error: task_id is required for approve' }], isError: true }
					}
					const task = await storage.readTask(args.task_id)
					const timestamp = new Date().toISOString()
					await storage.updateTask(args.task_id, {
						status: 'done',
						updated_at: timestamp,
						history: [...(task?.history ?? []), {
							at: timestamp,
							by: ctx.agentId,
							action: 'approved',
							note: args.note ?? 'Approved',
						}],
					}, ctx.agentId)
					await storage.moveTask(args.task_id, 'done', ctx.agentId)
					ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: 'done', assignedTo: task?.assigned_to })
					return { content: [{ type: 'text' as const, text: `Approved task ${args.task_id}` }] }
				}

				// ── reject ──────────────────────────────────────────────
				case 'reject': {
					if (!args.task_id) {
						return { content: [{ type: 'text' as const, text: 'Error: task_id is required for reject' }], isError: true }
					}
					const task = await storage.readTask(args.task_id)
					const timestamp = new Date().toISOString()
					await storage.updateTask(args.task_id, {
						status: 'blocked',
						updated_at: timestamp,
						history: [...(task?.history ?? []), {
							at: timestamp,
							by: ctx.agentId,
							action: 'rejected',
							note: args.reason ?? 'Rejected',
						}],
					}, ctx.agentId)
					await storage.moveTask(args.task_id, 'blocked', ctx.agentId)
					ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: 'blocked', assignedTo: task?.assigned_to })
					return { content: [{ type: 'text' as const, text: `Rejected task ${args.task_id}: ${args.reason ?? 'no reason'}` }] }
				}

				// ── block ───────────────────────────────────────────────
				case 'block': {
					if (!args.task_id) {
						return { content: [{ type: 'text' as const, text: 'Error: task_id is required for block' }], isError: true }
					}
					const task = await storage.readTask(args.task_id)
					if (!task) {
						return { content: [{ type: 'text' as const, text: `Task not found: ${args.task_id}` }], isError: true }
					}

					const blocker: Task['blockers'][number] = {
						type: 'dependency',
						reason: args.reason ?? 'Blocked',
						assigned_to: args.blocker_assigned_to ?? '',
						resolved: false,
					}
					const blockers = [...(task.blockers ?? []), blocker]
					const timestamp = new Date().toISOString()

					await storage.updateTask(
						args.task_id,
						{
							blockers,
							updated_at: timestamp,
							history: [
								...(task.history ?? []),
								{
									at: timestamp,
									by: ctx.agentId,
									action: 'blocker_added',
									note: `Blocker: ${args.reason} (assigned to ${args.blocker_assigned_to ?? 'unassigned'})`,
								},
							],
						},
						ctx.agentId,
					)
					await storage.moveTask(args.task_id, 'blocked', ctx.agentId)

					ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: 'blocked', assignedTo: task.assigned_to })

					return { content: [{ type: 'text' as const, text: `Blocker added to ${args.task_id}: ${args.reason} (assigned to ${args.blocker_assigned_to ?? 'unassigned'})` }] }
				}

				// ── unblock ─────────────────────────────────────────────
				case 'unblock': {
					if (!args.task_id) {
						return { content: [{ type: 'text' as const, text: 'Error: task_id is required for unblock' }], isError: true }
					}
					const task = await storage.readTask(args.task_id)
					if (!task) {
						return { content: [{ type: 'text' as const, text: `Task not found: ${args.task_id}` }], isError: true }
					}

					const blockerIdx = (task.blockers ?? []).findIndex((b) => !b.resolved)
					if (blockerIdx === -1) {
						return { content: [{ type: 'text' as const, text: `No unresolved blockers on task ${args.task_id}` }], isError: true }
					}

					const updatedBlockers = [...(task.blockers ?? [])]
					updatedBlockers[blockerIdx] = {
						...updatedBlockers[blockerIdx]!,
						resolved: true,
						resolved_at: new Date().toISOString(),
						resolved_by: ctx.agentId,
						resolved_note: args.note ?? '',
					}

					const timestamp = new Date().toISOString()
					await storage.updateTask(
						args.task_id,
						{
							blockers: updatedBlockers,
							updated_at: timestamp,
							history: [
								...(task.history ?? []),
								{
									at: timestamp,
									by: ctx.agentId,
									action: 'blocker_resolved',
									note: args.note ?? 'Resolved',
								},
							],
						},
						ctx.agentId,
					)

					// If task was blocked and all blockers now resolved, move back to active
					const allResolved = updatedBlockers.every((b) => b.resolved)
					let newStatus = task.status
					if (task.status === 'blocked' && allResolved) {
						await storage.moveTask(args.task_id, 'in_progress', ctx.agentId)
						newStatus = 'in_progress'
					}

					ctx.eventBus.emit({ type: 'task_changed', taskId: args.task_id, status: newStatus, assignedTo: task.assigned_to })

					return { content: [{ type: 'text' as const, text: `Blocker resolved on task ${args.task_id}: ${args.note ?? 'Resolved'}` }] }
				}
			}

			return { content: [{ type: 'text' as const, text: `Unknown action: ${args.action}` }], isError: true }
		},
	}
}
