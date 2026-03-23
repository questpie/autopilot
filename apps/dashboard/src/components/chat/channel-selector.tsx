import { cn } from '@/lib/utils'

const CHANNELS = ['general', 'dev', 'ops'] as const
export type Channel = (typeof CHANNELS)[number]

interface ChannelSelectorProps {
	active: Channel
	onChange: (channel: Channel) => void
}

export function ChannelSelector({ active, onChange }: ChannelSelectorProps) {
	return (
		<div className="flex border-b border-border">
			{CHANNELS.map((ch) => (
				<button
					key={ch}
					onClick={() => onChange(ch)}
					className={cn(
						'font-mono text-[11px] font-semibold uppercase tracking-[0.08em] px-5 py-3 cursor-pointer border-b-2 -mb-px transition-colors',
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
