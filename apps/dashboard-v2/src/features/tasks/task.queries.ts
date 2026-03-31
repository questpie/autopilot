import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { queryOptions } from '@tanstack/react-query'

interface TaskFilters {
	status?: string
	agent?: string
	project?: string
}

export interface WorkflowRunDetail {
	run: {
		id: string
		task_id: string
		workflow_id: string
		status: string
		current_step_id: string | null
		trigger_source: string | null
		last_event: string | null
		stream_id: string | null
		created_at: string
		updated_at: string
		started_at: string
		completed_at: string | null
		archived_at: string | null
		metadata: string | null
	}
	steps: Array<{
		id: string
		step_id: string
		attempt: number
		status: string
		executor_kind: string | null
		executor_ref: string | null
		model_policy: string | null
		validation_mode: string | null
		input_snapshot: string | null
		output_snapshot: string | null
		validation_snapshot: string | null
		failure_action: string | null
		failure_reason: string | null
		child_workflow_id: string | null
		child_task_id: string | null
		idempotency_key: string | null
		created_at: string
		updated_at: string
		completed_at: string | null
		archived_at: string | null
		metadata: string | null
	}>
}

export function tasksQuery(filters?: TaskFilters) {
	return queryOptions({
		queryKey: queryKeys.tasks.list(filters as Record<string, unknown>),
		queryFn: async () => {
			const res = await api.api.tasks.$get({
				query: {
					status: filters?.status,
					agent: filters?.agent,
					project: filters?.project,
				},
			})
			if (!res.ok) throw new Error('Failed to fetch tasks')
			return res.json()
		},
	})
}

export function taskDetailQuery(id: string) {
	return queryOptions({
		queryKey: queryKeys.tasks.detail(id),
		queryFn: async () => {
			const res = await api.api.tasks[':id'].$get({
				param: { id },
			})
			if (!res.ok) throw new Error('Failed to fetch task')
			return res.json()
		},
		enabled: !!id,
	})
}

export function taskWorkflowRunQuery(taskId: string) {
	return queryOptions({
		queryKey: queryKeys.workflowRuns.detail(taskId),
		queryFn: async () => {
			const res = await api.api['workflow-runs'].task[':taskId'].$get({
				param: { taskId },
			})

			if (res.status === 404) return null
			if (!res.ok) throw new Error('Failed to fetch workflow runtime')

			return res.json() as Promise<WorkflowRunDetail>
		},
		enabled: !!taskId,
	})
}
