import { ResourceLinker } from '@/components/resource-linker'
import {
	ArrowsClockwiseIcon,
	ChatCircleIcon,
	CheckCircleIcon,
	EyeIcon,
	FileIcon,
	LightningIcon,
	MagnifyingGlassIcon,
	PencilSimpleIcon,
	PushPinIcon,
	RocketIcon,
	TerminalIcon,
	XCircleIcon,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { m } from 'framer-motion'

interface ActivityEntry {
	at: string
	agent: string
	type: string
	summary: string
	details?: Record<string, unknown>
}

const ACTION_ICONS: Record<string, Icon> = {
	write_file: PencilSimpleIcon,
	run_terminal: TerminalIcon,
	task: CheckCircleIcon,
	message: ChatCircleIcon,
	pin: PushPinIcon,
	http: LightningIcon,
	search_web: MagnifyingGlassIcon,
	browse: EyeIcon,
	deploy: RocketIcon,
	read_file: FileIcon,
	search: MagnifyingGlassIcon,
	execute: LightningIcon,
	approve: CheckCircleIcon,
	reject: XCircleIcon,
	update: ArrowsClockwiseIcon,
}

function formatTimestamp(dateStr: string): string {
	const date = new Date(dateStr)
	return date.toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	})
}

function formatDate(dateStr: string): string {
	const date = new Date(dateStr)
	return date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
	})
}

export function ActivityItemRow({
	entry,
	showDate = false,
}: {
	entry: ActivityEntry
	showDate?: boolean
}) {
	const ActionIcon = ACTION_ICONS[entry.type] ?? LightningIcon

	return (
		<m.div
			layout
			initial={{ opacity: 0, y: -4 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.15 }}
			className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/20"
		>
			{/* Timestamp */}
			<div className="flex shrink-0 flex-col items-end">
				<span className="font-heading text-[10px] text-muted-foreground tabular-nums">
					{formatTimestamp(entry.at)}
				</span>
				{showDate && (
					<span className="font-heading text-[10px] text-muted-foreground/60 tabular-nums">
						{formatDate(entry.at)}
					</span>
				)}
			</div>

			{/* Agent avatar placeholder */}
			<div className="flex h-6 w-6 shrink-0 items-center justify-center bg-muted">
				<span className="font-heading text-[10px] uppercase text-muted-foreground">
					{entry.agent.charAt(0)}
				</span>
			</div>

			{/* Action icon */}
			<ActionIcon size={14} className="mt-0.5 shrink-0 text-muted-foreground" />

			{/* Content */}
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="flex items-baseline gap-2">
					<span className="font-heading text-xs font-medium text-foreground">{entry.agent}</span>
					<span className="font-heading text-xs text-muted-foreground">
						{entry.type.replace(/_/g, ' ')}
					</span>
				</div>
				<div className="text-xs text-muted-foreground">
					<ResourceLinker text={entry.summary} />
				</div>
			</div>
		</m.div>
	)
}
