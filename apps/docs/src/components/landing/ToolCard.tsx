export function ToolCard({
	name,
	description,
	variant = 'custom',
}: {
	name: string
	description: string
	variant?: 'custom' | 'builtin'
}) {
	return (
		<div className="bg-lp-card border border-lp-border p-6">
			<div className="flex items-center gap-2 mb-2">
				<code className="font-mono text-[13px] font-semibold text-lp-fg">
					{name}
				</code>
				{variant === 'builtin' && (
					<span className="font-mono text-[9px] text-lp-muted tracking-[0.1em] border border-lp-border px-1.5 py-0.5">
						SDK
					</span>
				)}
			</div>
			<div className="font-sans text-[12px] text-lp-muted leading-relaxed">
				{description}
			</div>
		</div>
	)
}
