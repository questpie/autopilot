export function CodeBlock({
	children,
	title,
}: { children: React.ReactNode; title?: string }) {
	return (
		<div className="bg-lp-bg border border-lp-border overflow-hidden flex flex-col h-full">
			{title && (
				<div className="px-4 py-2 border-b border-lp-border flex items-center gap-2">
					<div className="flex gap-1">
						<div className="w-2 h-2 bg-lp-accent-red" />
						<div className="w-2 h-2 bg-lp-accent-yellow" />
						<div className="w-2 h-2 bg-lp-accent-green" />
					</div>
					<span className="font-mono text-[11px] text-lp-ghost">{title}</span>
				</div>
			)}
			<pre className="font-mono text-xs text-lp-fg p-4 m-0 overflow-x-auto leading-relaxed flex-1 lp-scrollbar">
				{children}
			</pre>
		</div>
	)
}
