const statusMap: Record<string, string> = {
	run: 'bg-lp-accent-green',
	schd: 'bg-lp-accent-cyan',
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
		<div className="bg-lp-card border border-lp-border p-4">
			<div className="flex justify-between items-center mb-1.5">
				<span className="font-mono text-[15px] font-bold text-white">{name}</span>
				<span className={`w-2 h-2 ${s}`} />
			</div>
			<div className="font-mono text-[9px] text-lp-ghost tracking-[0.15em] mb-2">{role}</div>
			<div className="font-sans text-[11px] text-lp-ghost">{desc}</div>
		</div>
	)
}
