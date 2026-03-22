const colorMap: Record<string, { border: string; text: string }> = {
	purple: { border: 'border-t-purple', text: 'text-purple' },
	cyan: { border: 'border-t-accent-cyan', text: 'text-accent-cyan' },
	green: { border: 'border-t-accent-green', text: 'text-accent-green' },
	orange: { border: 'border-t-accent-orange', text: 'text-accent-orange' },
	'purple-light': { border: 'border-t-purple-light', text: 'text-purple-light' },
	red: { border: 'border-t-accent-red', text: 'text-accent-red' },
	white: { border: 'border-t-white', text: 'text-white' },
}

const statusMap: Record<string, string> = {
	run: 'bg-accent-green',
	schd: 'bg-accent-cyan',
	idle: 'bg-dim',
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
		<div className={`bg-card border border-border border-t-2 ${c.border} p-4`}>
			<div className="flex justify-between items-center mb-1.5">
				<span className="font-sans text-[15px] font-bold text-white">{name}</span>
				<span className={`w-2 h-2 rounded-full ${s}`} />
			</div>
			<div className={`font-mono text-[9px] ${c.text} tracking-[2px] mb-2`}>{role}</div>
			<div className="font-sans text-[11px] text-ghost">{desc}</div>
		</div>
	)
}
