import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { TaskSchema, taskPath, PATHS, TASK_STATUSES } from '@questpie/autopilot-spec'
import { readYaml, writeYaml, fileExists } from './yaml'

export type TaskOutput = z.output<typeof TaskSchema>
type TaskStatus = (typeof TASK_STATUSES)[number]

/** Map task status to filesystem folder name */
const STATUS_FOLDER_MAP: Record<string, string> = {
	draft: 'backlog',
	backlog: 'backlog',
	assigned: 'active',
	in_progress: 'active',
	review: 'review',
	blocked: 'blocked',
	done: 'done',
	cancelled: 'done',
}

const SEARCH_FOLDERS = ['backlog', 'active', 'review', 'blocked', 'done'] as const

function generateTaskId(): string {
	return `task-${Date.now().toString(36)}`
}

function resolvePath(companyRoot: string, relativePath: string): string {
	return join(companyRoot, relativePath.replace(/^\/company/, ''))
}

function now(): string {
	return new Date().toISOString()
}

export async function createTask(
	companyRoot: string,
	taskData: {
		id?: string
		title: string
		description?: string
		type: z.input<typeof TaskSchema>['type']
		status: z.input<typeof TaskSchema>['status']
		priority?: z.input<typeof TaskSchema>['priority']
		created_by: string
		assigned_to?: string
		project?: string
		parent?: string | null
		depends_on?: string[]
		blocks?: string[]
		related?: string[]
		reviewers?: string[]
		approver?: string
		workflow?: string
		workflow_step?: string
		context?: Record<string, string>
		blockers?: z.input<typeof TaskSchema>['blockers']
		deadline?: string
		created_at?: string
		updated_at?: string
		history?: z.input<typeof TaskSchema>['history']
		_linear_id?: string
		_github_pr?: string
	},
): Promise<TaskOutput> {
	const id = taskData.id ?? generateTaskId()
	const timestamp = now()
	const task = TaskSchema.parse({
		...taskData,
		id,
		created_at: taskData.created_at ?? timestamp,
		updated_at: taskData.updated_at ?? timestamp,
		history: taskData.history ?? [
			{
				at: timestamp,
				by: taskData.created_by,
				action: 'created',
			},
		],
	})

	const folder = STATUS_FOLDER_MAP[task.status] ?? 'backlog'
	const filePath = resolvePath(companyRoot, taskPath(folder, task.id))
	await writeYaml(filePath, task)
	return task
}

export async function findTask(
	companyRoot: string,
	taskId: string,
): Promise<{ folder: string; path: string } | null> {
	for (const folder of SEARCH_FOLDERS) {
		const filePath = resolvePath(companyRoot, taskPath(folder, taskId))
		if (await fileExists(filePath)) {
			return { folder, path: filePath }
		}
	}
	return null
}

export async function readTask(companyRoot: string, taskId: string): Promise<TaskOutput | null> {
	const found = await findTask(companyRoot, taskId)
	if (!found) return null
	return readYaml(found.path, TaskSchema)
}

export async function updateTask(
	companyRoot: string,
	taskId: string,
	updates: Partial<{
		title: string
		description: string
		type: z.input<typeof TaskSchema>['type']
		status: z.input<typeof TaskSchema>['status']
		priority: z.input<typeof TaskSchema>['priority']
		assigned_to: string
		project: string
		reviewers: string[]
		approver: string
		workflow: string
		workflow_step: string
		context: Record<string, string>
		deadline: string
		updated_at: string
	}>,
	updatedBy: string,
): Promise<TaskOutput> {
	const found = await findTask(companyRoot, taskId)
	if (!found) throw new Error(`Task not found: ${taskId}`)

	const existing = await readYaml(found.path, TaskSchema)
	const timestamp = now()

	const historyEntry = {
		at: timestamp,
		by: updatedBy,
		action: 'updated',
		note: Object.keys(updates).join(', '),
	}

	const updated = TaskSchema.parse({
		...existing,
		...updates,
		id: existing.id,
		created_at: existing.created_at,
		updated_at: timestamp,
		history: [...existing.history, historyEntry],
	})

	await writeYaml(found.path, updated)
	return updated
}

export async function moveTask(
	companyRoot: string,
	taskId: string,
	newStatus: TaskStatus,
	movedBy: string,
): Promise<TaskOutput> {
	const found = await findTask(companyRoot, taskId)
	if (!found) throw new Error(`Task not found: ${taskId}`)

	const existing = await readYaml(found.path, TaskSchema)
	const timestamp = now()
	const newFolder = STATUS_FOLDER_MAP[newStatus] ?? 'backlog'

	const historyEntry = {
		at: timestamp,
		by: movedBy,
		action: 'status_changed',
		from: existing.status,
		to: newStatus,
	}

	const updated = TaskSchema.parse({
		...existing,
		status: newStatus,
		updated_at: timestamp,
		started_at:
			newStatus === 'in_progress' ? (existing.started_at ?? timestamp) : existing.started_at,
		completed_at: newStatus === 'done' ? timestamp : existing.completed_at,
		history: [...existing.history, historyEntry],
	})

	const newPath = resolvePath(companyRoot, taskPath(newFolder, taskId))

	if (found.path !== newPath) {
		await writeYaml(newPath, updated)
		await rm(found.path)
	} else {
		await writeYaml(found.path, updated)
	}

	return updated
}

export interface ListTasksOptions {
	status?: string
	agent?: string
	project?: string
}

export async function listTasks(
	companyRoot: string,
	options?: ListTasksOptions,
): Promise<TaskOutput[]> {
	const foldersToSearch = options?.status
		? [STATUS_FOLDER_MAP[options.status] ?? options.status]
		: [...SEARCH_FOLDERS]

	const uniqueFolders = [...new Set(foldersToSearch)]
	const tasks: TaskOutput[] = []

	for (const folder of uniqueFolders) {
		const dirPath = resolvePath(companyRoot, `${PATHS.TASKS_DIR}/${folder}`)
		let files: string[]
		try {
			files = await readdir(dirPath)
		} catch {
			continue
		}

		for (const file of files) {
			if (!file.endsWith('.yaml') || file.startsWith('_')) continue
			try {
				const task = await readYaml(join(dirPath, file), TaskSchema)

				if (options?.agent && task.assigned_to !== options.agent) continue
				if (options?.project && task.project !== options.project) continue

				tasks.push(task)
			} catch {
				// skip invalid files
			}
		}
	}

	return tasks
}
