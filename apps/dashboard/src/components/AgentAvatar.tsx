const roleColors: Record<string, string> = {
	lead: 'bg-purple',
	developer: 'bg-accent-cyan',
	designer: 'bg-accent-orange',
	analyst: 'bg-accent-green',
	default: 'bg-ghost',
}

export function AgentAvatar({ name, role }: { name: string; role?: string }) {
	const initial = name.charAt(0).toUpperCase()
	const bg = roleColors[role?.toLowerCase() ?? 'default'] ?? roleColors.default
	return (
		<div
			className={`w-7 h-7 flex items-center justify-center text-xs font-bold text-white shrink-0 ${bg}`}
		>
			{initial}
		</div>
	)
}
