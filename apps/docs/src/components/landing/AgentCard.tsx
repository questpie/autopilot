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
		<div className="bg-lp-card p-6">
			<div className="flex justify-between items-center mb-1.5">
				<span className="font-mono text-[13px] font-semibold text-lp-fg">{name}</span>
				<span className={`w-2 h-2 ${s}`} />
			</div>
			<div className="font-mono text-[10px] text-lp-muted tracking-[0.15em] mb-2">{role}</div>
			<div className="font-sans text-[12px] text-lp-muted leading-relaxed">{desc}</div>
		</div>
	)
}
