export function PainCard({
	title,
	description,
}: {
	title: string
	description: string
}) {
	return (
		<div className="bg-lp-card border border-lp-border p-6">
			<div className="font-mono text-[13px] font-semibold text-lp-fg mb-2">
				{title}
			</div>
			<div className="font-sans text-[13px] text-lp-muted leading-relaxed">
				{description}
			</div>
		</div>
	)
}
