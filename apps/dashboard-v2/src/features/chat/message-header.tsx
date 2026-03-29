import { formatAbsoluteTimestamp, formatTimestamp } from './message-time'

interface MessageHeaderProps {
	from: string
	timestamp: string
	isAgent: boolean
	editedAt?: string | null
}

/** Header row: display name, optional BOT badge, timestamp, and edited indicator. */
export function MessageHeader({ from, timestamp, isAgent, editedAt }: MessageHeaderProps) {
	return (
		<div className="flex items-baseline gap-2">
			<span className="text-sm font-semibold text-foreground">
				{from}
			</span>
			{isAgent && (
				<span className="rounded bg-primary/20 px-1.5 py-px text-[10px] font-medium text-primary">
					BOT
				</span>
			)}
			<span
				className="text-xs text-muted-foreground/60"
				title={formatAbsoluteTimestamp(timestamp)}
			>
				{formatTimestamp(timestamp)}
			</span>
			{editedAt && (
				<span
					className="text-[10px] text-muted-foreground/40"
					title={`Edited ${formatAbsoluteTimestamp(editedAt)}`}
				>
					(edited)
				</span>
			)}
		</div>
	)
}
