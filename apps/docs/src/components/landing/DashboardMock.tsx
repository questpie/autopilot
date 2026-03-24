import { WarningCircle, GitMerge, CheckCircle, Circle } from '@phosphor-icons/react'
import { QSymbol } from './QSymbol'

export function DashboardMock() {
	const items = [
		{
			icon: (
				<WarningCircle weight="fill" className="text-lp-accent-red" size={16} />
			),
			title: 'Create GitHub repo',
			from: 'max',
			time: '2h ago',
			actions: ['Resolve'],
		},
		{
			icon: (
				<GitMerge weight="bold" className="text-lp-accent-orange" size={16} />
			),
			title: 'Merge landing page PR #47',
			from: 'riley approved',
			time: '45m',
			actions: ['Merge', 'Reject'],
		},
		{
			icon: (
				<CheckCircle
					weight="fill"
					className="text-lp-accent-green"
					size={16}
				/>
			),
			title: 'Approve marketing copy',
			from: 'morgan',
			time: '20m',
			actions: ['Approve', 'Reject'],
		},
	]

	const agents = [
		{
			n: 'max',
			s: (
				<Circle weight="fill" className="text-lp-accent-green" size={10} />
			),
			d: 'task-040 · 12m',
		},
		{
			n: 'ops',
			s: (
				<Circle weight="fill" className="text-lp-accent-green" size={10} />
			),
			d: 'health check',
		},
		{
			n: 'sam',
			s: <Circle weight="fill" className="text-lp-dim" size={10} />,
			d: 'idle 2h',
		},
		{
			n: 'riley',
			s: <Circle weight="fill" className="text-lp-dim" size={10} />,
			d: 'idle',
		},
	]

	return (
		<div className="bg-lp-card border border-lp-border overflow-hidden">
			<div className="px-4 py-2.5 border-b border-lp-border flex items-center gap-2.5 bg-lp-surface">
				<QSymbol size={16} />
				<span className="font-mono text-[11px] text-lp-ghost truncate">
					QUESTPIE Autopilot — QUESTPIE s.r.o.
				</span>
			</div>
			<div className="p-3 sm:p-4 flex flex-col gap-2.5">
				<div className="font-mono text-[10px] text-lp-purple tracking-[2px] mb-1">
					NEEDS YOUR ATTENTION
				</div>
				{items.map((item) => (
					<div
						key={item.title}
						className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-3 py-2.5 bg-lp-surface border border-lp-border"
					>
						{item.icon}
						<div className="flex-1 min-w-0">
							<div className="font-mono text-[13px] text-white font-semibold truncate">
								{item.title}
							</div>
							<div className="font-sans text-[11px] text-lp-ghost">
								{item.from} · {item.time}
							</div>
						</div>
						<div className="flex gap-1.5">
							{item.actions.map((a, j) => (
								<span
									key={a}
									className={`font-mono text-[10px] px-2.5 py-0.5 cursor-pointer ${
										j === 0
											? 'text-white bg-lp-purple border-none'
											: 'text-lp-ghost bg-transparent border border-lp-border'
									}`}
								>
									{a}
								</span>
							))}
						</div>
					</div>
				))}
				<div className="font-mono text-[10px] text-lp-purple tracking-[2px] mt-2 mb-1">
					AGENTS
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
					{agents.map((a) => (
						<div
							key={a.n}
							className="px-2.5 py-2 bg-lp-surface border border-lp-border"
						>
							<div className="text-lp-fg flex items-center gap-1.5">
								{a.s} {a.n}
							</div>
							<div className="text-lp-dim text-[10px] mt-0.5 truncate">
								{a.d}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
