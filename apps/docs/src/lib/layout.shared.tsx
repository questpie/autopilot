import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			url: '/',
			title: (
				<div className="flex items-center gap-2">
					<img src="/logo-symbol.svg" alt="QUESTPIE" className="h-6 w-auto" />
					<span className="font-mono text-sm font-bold tracking-tight">
						QUESTPIE<span className="text-primary"> Autopilot</span>
					</span>
				</div>
			),
			transparentMode: 'always',
		},
		links: [
			{
				text: 'GitHub',
				url: 'https://github.com/questpie/autopilot',
				external: true,
			},
		],
	}
}
