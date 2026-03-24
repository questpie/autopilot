import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

function Logo() {
	return (
		<div className="flex items-center gap-2">
			<img src="/logo-symbol.svg" alt="" className="h-5 w-auto" />
			<span className="font-mono text-sm font-bold tracking-[-0.05em]">
				QUESTPIE<span className="text-primary"> Autopilot</span>
			</span>
		</div>
	)
}

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			url: '/',
			title: <Logo />,
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
