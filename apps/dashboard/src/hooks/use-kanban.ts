import { useState, useMemo, useCallback } from 'react'
import type { Task, TaskStatus } from '@/lib/types'

export type GroupBy = 'status' | 'project' | 'agent'

export interface KanbanFilters {
	project: string
	milestone: string
	agent: string
	label: string
	priority: string
}

const EMPTY_FILTERS: KanbanFilters = {
	project: '',
	milestone: '',
	agent: '',
	label: '',
	priority: '',
}

export const KANBAN_COLUMNS: TaskStatus[] = ['backlog', 'assigned', 'review', 'blocked', 'done']

export const COLUMN_LABELS: Record<string, string> = {
	backlog: 'Backlog',
	assigned: 'Active',
	in_progress: 'Active',
	review: 'Review',
	blocked: 'Blocked',
	done: 'Done',
}

function normalizeStatus(status: TaskStatus): TaskStatus {
	if (status === 'in_progress') return 'assigned'
	return status
}

export function useKanban(tasks: Task[] | undefined) {
	const [filters, setFilters] = useState<KanbanFilters>(EMPTY_FILTERS)
	const [groupBy, setGroupBy] = useState<GroupBy>('status')

	const filtered = useMemo(() => {
		if (!tasks) return []
		return tasks.filter((t) => {
			if (filters.project && t.project !== filters.project) return false
			if (filters.milestone && t.milestone !== filters.milestone) return false
			if (filters.agent && t.assigned_to !== filters.agent) return false
			if (filters.label && !t.labels?.includes(filters.label)) return false
			if (filters.priority && t.priority !== filters.priority) return false
			return true
		})
	}, [tasks, filters])

	const columns = useMemo(() => {
		if (groupBy === 'status') {
			const map: Record<string, Task[]> = {}
			for (const col of KANBAN_COLUMNS) {
				map[col] = []
			}
			for (const t of filtered) {
				const key = normalizeStatus(t.status)
				if (map[key]) {
					map[key].push(t)
				}
			}
			return KANBAN_COLUMNS.map((col) => ({
				id: col,
				label: COLUMN_LABELS[col] ?? col,
				tasks: map[col] ?? [],
			}))
		}

		if (groupBy === 'project') {
			const map: Record<string, Task[]> = {}
			for (const t of filtered) {
				const key = t.project || 'Unassigned'
				if (!map[key]) map[key] = []
				map[key].push(t)
			}
			return Object.entries(map).map(([id, tasks]) => ({
				id,
				label: id,
				tasks,
			}))
		}

		// group by agent
		const map: Record<string, Task[]> = {}
		for (const t of filtered) {
			const key = t.assigned_to || 'Unassigned'
			if (!map[key]) map[key] = []
			map[key].push(t)
		}
		return Object.entries(map).map(([id, tasks]) => ({
			id,
			label: id,
			tasks,
		}))
	}, [filtered, groupBy])

	const filterOptions = useMemo(() => {
		if (!tasks) return { projects: [], milestones: [], agents: [], labels: [], priorities: [] }
		const projects = new Set<string>()
		const milestones = new Set<string>()
		const agents = new Set<string>()
		const labels = new Set<string>()
		const priorities = new Set<string>()
		for (const t of tasks) {
			if (t.project) projects.add(t.project)
			if (t.milestone) milestones.add(t.milestone)
			if (t.assigned_to) agents.add(t.assigned_to)
			if (t.priority) priorities.add(t.priority)
			for (const l of t.labels ?? []) labels.add(l)
		}
		return {
			projects: [...projects],
			milestones: [...milestones],
			agents: [...agents],
			labels: [...labels],
			priorities: [...priorities],
		}
	}, [tasks])

	const updateFilter = useCallback((key: keyof KanbanFilters, value: string) => {
		setFilters((f) => ({ ...f, [key]: value }))
	}, [])

	const resetFilters = useCallback(() => {
		setFilters(EMPTY_FILTERS)
	}, [])

	return {
		filters,
		updateFilter,
		resetFilters,
		groupBy,
		setGroupBy,
		columns,
		filterOptions,
		filtered,
	}
}
