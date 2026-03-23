interface PinCardProps {
	type: string
	title: string
	content?: string
	onRemove?: () => void
}

const typeIcons: Record<string, string> = {
	note: '#',
	link: '>',
	file: '~',
	task: '*',
}

export function PinCard({ type, title, content, onRemove }: PinCardProps) {
	return (
		<div className="bg-card border border-border p-3 hover:border-purple/40 transition-colors">
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs font-mono text-purple">
					{typeIcons[type.toLowerCase()] ?? '#'} {type}
				</span>
				{onRemove && (
					<button
						onClick={onRemove}
						className="text-xs text-ghost hover:text-accent-red transition-colors"
					>
						x
					</button>
				)}
			</div>
			<p className="text-sm text-fg mb-1">{title}</p>
			{content && <p className="text-xs text-muted line-clamp-3">{content}</p>}
		</div>
	)
}
