import { cn } from '@/lib/utils'

export type Channel = string

interface ChannelSelectorProps {
	active: Channel
	onChange: (channel: Channel) => void
	channels?: string[]
}

export function ChannelSelector({ active, onChange, channels }: ChannelSelectorProps) {
	const list = channels ?? ['general', 'dev', 'ops']

	return (
		<div className="flex border-b border-border overflow-x-auto">
			{list.map((ch) => (
				<button
					key={ch}
					onClick={() => onChange(ch)}
					className={cn(
						'font-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-5 py-3 cursor-pointer border-b-2 -mb-px transition-colors whitespace-nowrap',
						active === ch
							? 'text-primary border-primary'
							: 'text-muted-foreground border-transparent hover:text-foreground',
					)}
				>
					#{ch}
				</button>
			))}
		</div>
	)
}
