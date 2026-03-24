import { Link } from '@tanstack/react-router'
import { QSymbol } from './QSymbol'

export function Header() {
	return (
		<header className="sticky top-0 z-50 bg-lp-bg/80 backdrop-blur-md border-b border-lp-border">
			<div className="max-w-[860px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
				<Link to="/" className="flex items-center gap-2 text-white no-underline">
					<QSymbol size={18} />
					<span className="font-mono text-lg font-bold">
						QUESTPIE
					</span>
				</Link>
				<nav className="flex items-center gap-3 sm:gap-6">
					<Link
						to="/docs"
						className="font-sans text-sm text-lp-ghost hover:text-lp-fg transition-colors no-underline"
					>
						Docs
					</Link>
					<a
						href="https://github.com/questpie/autopilot"
						target="_blank"
						rel="noopener noreferrer"
						className="font-sans text-sm text-lp-ghost hover:text-lp-fg transition-colors no-underline"
					>
						GitHub
					</a>
					<a
						href="https://questpie.com"
						target="_blank"
						rel="noopener noreferrer"
						className="font-sans text-sm text-lp-ghost hover:text-lp-fg transition-colors no-underline hidden sm:inline"
					>
						QUESTPIE
					</a>
					<span className="font-mono text-[10px] text-lp-purple border border-lp-purple/30 px-2 py-0.5 tracking-wider hidden sm:inline">
						v1.0 BETA
					</span>
				</nav>
			</div>
		</header>
	)
}
