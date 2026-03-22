import { QSymbol } from './QSymbol'

const items = [
	{
		icon: '\u{1F534}',
		title: 'Create GitHub repo',
		from: 'max',
		time: '2h ago',
		actions: ['Resolve'],
	},
	{
		icon: '\u{1F7E1}',
		title: 'Merge landing page PR #47',
		from: 'riley approved',
		time: '45m',
		actions: ['Merge', 'Reject'],
	},
	{
		icon: '\u{1F7E2}',
		title: 'Approve marketing copy',
		from: 'morgan',
		time: '20m',
		actions: ['Approve', 'Reject'],
	},
]

const agents = [
	{ n: 'max', s: '\u{1F7E2}', d: 'task-040 \u00B7 12m' },
	{ n: 'ops', s: '\u{1F7E2}', d: 'health check' },
	{ n: 'sam', s: '\u26AA', d: 'idle 2h' },
	{ n: 'riley', s: '\u26AA', d: 'idle' },
]

export function DashboardMock() {
	return (
		<div className="bg-card border border-border overflow-hidden">
			<div className="px-4 py-2.5 border-b border-border flex items-center gap-2.5 bg-surface">
				<QSymbol size={16} />
				<span className="font-mono text-[11px] text-ghost">
					QUESTPIE Autopilot — QUESTPIE s.r.o.
				</span>
			</div>
			<div className="p-4 flex flex-col gap-2.5">
				<div className="font-mono text-[10px] text-purple tracking-[2px] mb-1">
					NEEDS YOUR ATTENTION
				</div>
				{items.map((item) => (
					<div
						key={item.title}
						className="flex items-center gap-3 px-3 py-2.5 bg-surface border border-border"
					>
						<span className="text-sm">{item.icon}</span>
						<div className="flex-1">
							<div className="font-sans text-[13px] text-white font-semibold">
								{item.title}
							</div>
							<div className="font-sans text-[11px] text-ghost">
								{item.from} · {item.time}
							</div>
						</div>
						<div className="flex gap-1.5">
							{item.actions.map((a, j) => (
								<span
									key={a}
									className={`font-mono text-[10px] px-2.5 py-0.5 cursor-pointer ${
										j === 0
											? 'text-bg bg-purple border-none'
											: 'text-ghost bg-transparent border border-border'
									}`}
								>
									{a}
								</span>
							))}
						</div>
					</div>
				))}
				<div className="font-mono text-[10px] text-purple tracking-[2px] mt-2 mb-1">
					AGENTS
				</div>
				<div className="flex gap-2 text-xs font-mono">
					{agents.map((a) => (
						<div
							key={a.n}
							className="flex-1 px-2.5 py-2 bg-surface border border-border"
						>
							<div className="text-fg">
								{a.s} {a.n}
							</div>
							<div className="text-dim text-[10px] mt-0.5">{a.d}</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
