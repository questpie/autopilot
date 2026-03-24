function Connector() {
	return (
		<div className="flex justify-center">
			<div className="flex flex-col items-center h-6">
				<div className="w-[2px] flex-1 bg-lp-border" />
				<div className="text-lp-border text-[8px] leading-none">{'\u25BC'}</div>
			</div>
		</div>
	)
}

function ArchLayer({
	label,
	name,
	items,
	accent,
}: {
	label: string
	name: string
	items: string[]
	accent?: boolean
}) {
	return (
		<div
			className={`px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 border border-lp-border ${
				accent ? 'bg-lp-purple-faint' : 'bg-lp-card'
			}`}
		>
			<div className="flex items-center gap-3 shrink-0">
				<span className="font-mono text-sm font-bold text-lp-purple tracking-[0.1em]">
					{label}
				</span>
				<span className="font-mono text-xs font-bold text-lp-fg tracking-[0.15em] uppercase">
					{name}
				</span>
			</div>
			<div className="flex flex-wrap gap-1.5">
				{items.map((item) => (
					<span
						key={item}
						className="font-mono text-[10px] font-semibold text-lp-purple bg-lp-purple-faint border border-lp-purple-glow px-[10px] py-[3px] tracking-[0.05em]"
					>
						{item}
					</span>
				))}
			</div>
		</div>
	)
}

export function ArchitectureDiagram() {
	return (
		<div className="space-y-0">
			<ArchLayer
				label="01"
				name="HUMAN"
				items={['CLI', 'Dashboard', 'Telegram', 'Slack (soon)', 'Email (soon)']}
				accent
			/>
			<Connector />
			<ArchLayer
				label="02"
				name="ORCHESTRATOR"
				items={['Watcher', 'Workflows', 'Spawner', 'Context', 'Memory', 'Cron', 'Webhooks', 'SSE']}
			/>
			<Connector />
			<ArchLayer
				label="03"
				name="AGENTS"
				items={['Claude Agent SDK', 'Codex SDK', 'Role Templates', '13 Primitives', 'MCP', 'Sandboxed FS']}
			/>
			<Connector />
			<ArchLayer
				label="04"
				name="STORAGE"
				items={['SQLite + Drizzle', 'YAML / Markdown', 'FTS5 + sqlite-vec', 'Git Auto-Commit', 'Better Auth']}
			/>
		</div>
	)
}
