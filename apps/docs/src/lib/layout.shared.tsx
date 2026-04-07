import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			url: '/',
			title: (
				<span className="flex items-center gap-2 font-mono text-sm font-bold tracking-tight">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
						<path d="M22 10V2H2V22H10" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/>
						<path d="M23 13H13V23H23V13Z" fill="#B700FF"/>
					</svg>
					QUESTPIE Autopilot
				</span>
			),
			transparentMode: 'always',
		},
		searchToggle: {
			components: {},
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
