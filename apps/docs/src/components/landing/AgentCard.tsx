const colorMap: Record<string, { border: string; text: string }> = {
	purple: { border: 'border-t-lp-purple', text: 'text-lp-purple' },
	cyan: { border: 'border-t-lp-accent-cyan', text: 'text-lp-accent-cyan' },
	green: { border: 'border-t-lp-accent-green', text: 'text-lp-accent-green' },
	orange: { border: 'border-t-lp-accent-orange', text: 'text-lp-accent-orange' },
	'purple-light': { border: 'border-t-lp-purple-light', text: 'text-lp-purple-light' },
	red: { border: 'border-t-lp-accent-red', text: 'text-lp-accent-red' },
	white: { border: 'border-t-white', text: 'text-white' },
}

const statusMap: Record<string, string> = {
	run: 'bg-lp-accent-green',
	schd: 'bg-lp-accent-cyan',
	idle: 'bg-lp-dim',
}

export function AgentCard({
	name,
	role,
	desc,
	color,
	status,
}: {
	name: string
	role: string
	desc: string
	color: string
	status: string
}) {
	const c = colorMap[color] ?? colorMap.purple
	const s = statusMap[status] ?? statusMap.idle
	return (
		<div className={`bg-lp-card border border-lp-border border-t-2 ${c.border} p-4`}>
			<div className="flex justify-between items-center mb-1.5">
				<span className="font-sans text-[15px] font-bold text-white">{name}</span>
				<span className={`w-2 h-2 rounded-full ${s}`} />
			</div>
			<div className={`font-mono text-[9px] ${c.text} tracking-[2px] mb-2`}>{role}</div>
			<div className="font-sans text-[11px] text-lp-ghost">{desc}</div>
		</div>
	)
}
