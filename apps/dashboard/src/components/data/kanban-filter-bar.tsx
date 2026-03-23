import type { GroupBy, KanbanFilters } from '@/hooks/use-kanban'

interface KanbanFilterBarProps {
	filters: KanbanFilters
	filterOptions: {
		projects: string[]
		milestones: string[]
		agents: string[]
		labels: string[]
		priorities: string[]
	}
	onFilterChange: (key: keyof KanbanFilters, value: string) => void
	onReset: () => void
	groupBy: GroupBy
	onGroupByChange: (g: GroupBy) => void
}

const selectClass =
	'font-mono text-[10px] bg-transparent border border-border px-2 py-1 text-foreground outline-none min-w-[90px]'

export function KanbanFilterBar({
	filters,
	filterOptions,
	onFilterChange,
	onReset,
	groupBy,
	onGroupByChange,
}: KanbanFilterBarProps) {
	const hasFilters = Object.values(filters).some(Boolean)

	return (
		<div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
			<FilterSelect
				label="Project"
				value={filters.project}
				options={filterOptions.projects}
				onChange={(v) => onFilterChange('project', v)}
			/>
			<FilterSelect
				label="Agent"
				value={filters.agent}
				options={filterOptions.agents}
				onChange={(v) => onFilterChange('agent', v)}
			/>
			<FilterSelect
				label="Label"
				value={filters.label}
				options={filterOptions.labels}
				onChange={(v) => onFilterChange('label', v)}
			/>
			<FilterSelect
				label="Priority"
				value={filters.priority}
				options={filterOptions.priorities}
				onChange={(v) => onFilterChange('priority', v)}
			/>
			<FilterSelect
				label="Milestone"
				value={filters.milestone}
				options={filterOptions.milestones}
				onChange={(v) => onFilterChange('milestone', v)}
			/>

			{hasFilters && (
				<button
					onClick={onReset}
					className="font-mono text-[10px] text-muted-foreground hover:text-foreground px-2 py-1"
				>
					Clear
				</button>
			)}

			<div className="ml-auto flex items-center gap-2">
				<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.1em]">
					Group
				</span>
				<select
					value={groupBy}
					onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
					className={selectClass}
				>
					<option value="status">Status</option>
					<option value="project">Project</option>
					<option value="agent">Agent</option>
				</select>
			</div>
		</div>
	)
}

function FilterSelect({
	label,
	value,
	options,
	onChange,
}: {
	label: string
	value: string
	options: string[]
	onChange: (v: string) => void
}) {
	if (options.length === 0) return null

	return (
		<select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
			<option value="">{label}</option>
			{options.map((opt) => (
				<option key={opt} value={opt}>
					{opt}
				</option>
			))}
		</select>
	)
}
