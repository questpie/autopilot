import { Link, Outlet } from '@tanstack/react-router'
import { Header } from './Header'

const navItems = [
	{ to: '/docs', label: 'Overview' },
	{ to: '/docs/getting-started', label: 'Getting Started' },
	{ to: '/docs/features', label: 'Features' },
	{ to: '/docs/architecture', label: 'Architecture' },
	{ to: '/docs/agents', label: 'Agents' },
	{ to: '/docs/primitives', label: 'Primitives' },
	{ to: '/docs/workflows', label: 'Workflows' },
	{ to: '/docs/memory', label: 'Context & Memory' },
	{ to: '/docs/skills', label: 'Skills' },
	{ to: '/docs/artifacts', label: 'Artifacts' },
	{ to: '/docs/living-dashboard', label: 'Living Dashboard' },
	{ to: '/docs/integrations', label: 'Integrations' },
	{ to: '/docs/integrations-setup', label: 'Integration Setup' },
	{ to: '/docs/use-cases', label: 'Use Cases' },
	{ to: '/docs/cli', label: 'CLI Reference' },
]

export function DocsLayout() {
	return (
		<>
			<Header />
			<div className="max-w-[1000px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row gap-6 sm:gap-8 py-6 sm:py-10">
				<nav className="w-full sm:w-48 shrink-0">
					<div className="font-mono text-[10px] text-purple tracking-[2px] mb-3 sm:mb-4">
						DOCUMENTATION
					</div>
					<div className="flex flex-row flex-wrap gap-2 sm:flex-col sm:gap-1">
						{navItems.map((item) => (
							<Link
								key={item.to}
								to={item.to}
								className="font-sans text-sm text-ghost hover:text-fg transition-colors no-underline py-1 [&.active]:text-purple [&.active]:font-semibold"
								activeOptions={{ exact: true }}
							>
								{item.label}
							</Link>
						))}
					</div>
				</nav>
				<main className="flex-1 min-w-0">
					<Outlet />
				</main>
			</div>
		</>
	)
}
