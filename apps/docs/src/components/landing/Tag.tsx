export function Tag({
	children,
	color = 'purple',
}: { children: React.ReactNode; color?: string }) {
	const colorMap: Record<string, string> = {
		purple: 'text-lp-purple border-lp-purple/20',
		cyan: 'text-lp-accent-cyan border-lp-accent-cyan/20',
		green: 'text-lp-accent-green border-lp-accent-green/20',
		orange: 'text-lp-accent-orange border-lp-accent-orange/20',
	}
	return (
		<span
			className={`font-mono text-[10px] border px-2 py-0.5 tracking-widest ${colorMap[color] ?? colorMap.purple}`}
		>
			{children}
		</span>
	)
}
