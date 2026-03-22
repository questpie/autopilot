export function Tag({
	children,
	color = 'purple',
}: { children: React.ReactNode; color?: string }) {
	const colorMap: Record<string, string> = {
		purple: 'text-purple border-purple/20',
		cyan: 'text-accent-cyan border-accent-cyan/20',
		green: 'text-accent-green border-accent-green/20',
		orange: 'text-accent-orange border-accent-orange/20',
	}
	return (
		<span
			className={`font-mono text-[10px] border px-2 py-0.5 tracking-widest ${colorMap[color] ?? colorMap.purple}`}
		>
			{children}
		</span>
	)
}
