const features = [
	{
		label: 'Multi-agent system',
		autopilot: 'YAML-configurable, orchestrated',
		crewai: 'Framework, DIY',
		devin: '1 agent (coding)',
		n8n: 'No agents',
		dust: 'Multi-agent',
	},
	{
		label: 'Dashboard',
		autopilot: '26 pages, real-time',
		crewai: 'None',
		devin: 'Web IDE',
		n8n: 'Flow editor',
		dust: 'Chat UI',
	},
	{
		label: 'CLI',
		autopilot: '60+ commands',
		crewai: 'Python API',
		devin: 'None',
		n8n: 'None',
		dust: 'None',
	},
	{
		label: 'Self-hosted',
		autopilot: 'Yes, single process',
		crewai: 'Yes',
		devin: 'No (cloud only)',
		n8n: 'Yes (complex)',
		dust: 'No',
	},
	{
		label: 'Open source',
		autopilot: 'MIT',
		crewai: 'Apache 2.0',
		devin: 'No',
		n8n: 'Partial',
		dust: 'No',
	},
	{
		label: 'Security layers',
		autopilot: '14',
		crewai: 'DIY',
		devin: 'Unknown',
		n8n: 'Basic',
		dust: 'Enterprise',
	},
	{
		label: 'Price',
		autopilot: 'Free (self-host)',
		crewai: 'Free (framework)',
		devin: '$500/mo',
		n8n: 'Free / $20/mo',
		dust: '$500/mo',
	},
]

const competitors = ['QuestPie Autopilot', 'CrewAI', 'Devin', 'n8n / Zapier', 'Dust'] as const

export function ComparisonTable() {
	return (
		<div className="overflow-x-auto lp-scrollbar">
			<table className="w-full border-collapse min-w-[700px]">
				<thead>
					<tr className="border-b border-lp-border">
						<th className="font-mono text-[10px] text-lp-muted tracking-[0.15em] uppercase text-left p-3">
							Feature
						</th>
						{competitors.map((c) => (
							<th
								key={c}
								className={`font-mono text-[10px] tracking-[0.15em] uppercase text-left p-3 ${
									c === 'QuestPie Autopilot'
										? 'text-lp-purple'
										: 'text-lp-muted'
								}`}
							>
								{c}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{features.map((f) => (
						<tr
							key={f.label}
							className="border-b border-lp-border/30 hover:bg-lp-surface/50"
						>
							<td className="font-mono text-[11px] text-lp-fg p-3">
								{f.label}
							</td>
							<td className="font-sans text-[12px] text-lp-fg p-3 font-medium">
								{f.autopilot}
							</td>
							<td className="font-sans text-[12px] text-lp-muted p-3">
								{f.crewai}
							</td>
							<td className="font-sans text-[12px] text-lp-muted p-3">
								{f.devin}
							</td>
							<td className="font-sans text-[12px] text-lp-muted p-3">
								{f.n8n}
							</td>
							<td className="font-sans text-[12px] text-lp-muted p-3">
								{f.dust}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<div className="font-sans text-[11px] text-lp-ghost mt-3 italic">
				Competitor feature claims based on public documentation as of March
				2026. Verify current capabilities on each product's website.
			</div>
		</div>
	)
}
