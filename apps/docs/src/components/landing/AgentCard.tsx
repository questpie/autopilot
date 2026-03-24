import { GenerativeAvatar } from '@questpie/avatar'

const statusMap: Record<string, string> = {
	run: 'bg-lp-purple',
	schd: 'bg-lp-purple/50',
	idle: 'bg-lp-dim',
}

export function AgentCard({
	name,
	role,
	desc,
	status,
}: {
	name: string
	role: string
	desc: string
	color?: string
	status: string
}) {
	const s = statusMap[status] ?? statusMap.idle
	return (
		<div className="bg-lp-card border border-lp-border p-6">
			<div className="flex items-center gap-3 mb-1.5">
				<div className="shrink-0 w-8 h-8 overflow-hidden bg-lp-surface">
					<GenerativeAvatar seed={name} size={32} />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex justify-between items-center">
						<span className="font-mono text-[13px] font-semibold text-lp-fg">{name}</span>
						<span className={`w-2 h-2 ${s}`} />
					</div>
					<div className="font-mono text-[10px] text-lp-muted tracking-[0.15em]">{role}</div>
				</div>
			</div>
			<div className="font-sans text-[12px] text-lp-muted leading-relaxed">{desc}</div>
		</div>
	)
}
