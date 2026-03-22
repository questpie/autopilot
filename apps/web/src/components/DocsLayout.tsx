import { Link, Outlet } from '@tanstack/react-router'
import { Header } from './Header'

const navItems = [
	{ to: '/docs', label: 'Overview' },
	{ to: '/docs/getting-started', label: 'Getting Started' },
	{ to: '/docs/architecture', label: 'Architecture' },
	{ to: '/docs/agents', label: 'Agents' },
	{ to: '/docs/primitives', label: 'Primitives' },
	{ to: '/docs/workflows', label: 'Workflows' },
	{ to: '/docs/memory', label: 'Context & Memory' },
	{ to: '/docs/cli', label: 'CLI Reference' },
]

export function DocsLayout() {
	return (
		<>
			<Header />
			<div className="max-w-[1000px] mx-auto px-6 flex gap-8 py-10 max-md:flex-col">
				<nav className="w-48 shrink-0 max-md:w-full">
					<div className="font-mono text-[10px] text-purple tracking-[2px] mb-4">
						DOCUMENTATION
					</div>
					<div className="flex flex-col gap-1 max-md:flex-row max-md:flex-wrap max-md:gap-2">
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
