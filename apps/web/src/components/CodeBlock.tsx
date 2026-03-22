export function CodeBlock({
	children,
	title,
}: { children: React.ReactNode; title?: string }) {
	return (
		<div className="bg-bg border border-border overflow-hidden">
			{title && (
				<div className="px-4 py-2 border-b border-border flex items-center gap-2">
					<div className="flex gap-1">
						<div className="w-2 h-2 bg-accent-red rounded-full" />
						<div className="w-2 h-2 bg-accent-yellow rounded-full" />
						<div className="w-2 h-2 bg-accent-green rounded-full" />
					</div>
					<span className="font-mono text-[11px] text-ghost">{title}</span>
				</div>
			)}
			<pre className="font-mono text-xs text-fg p-4 m-0 overflow-auto leading-relaxed">
				{children}
			</pre>
		</div>
	)
}
