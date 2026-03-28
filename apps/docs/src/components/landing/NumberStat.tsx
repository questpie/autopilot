export function NumberStat({
	value,
	label,
}: {
	value: string
	label: string
}) {
	return (
		<div className="bg-lp-card border border-lp-border p-6 text-center">
			<div className="font-mono text-[28px] sm:text-[36px] font-bold text-white leading-none">
				{value}
			</div>
			<div className="font-sans text-[12px] text-lp-muted mt-2 leading-relaxed">
				{label}
			</div>
		</div>
	)
}
