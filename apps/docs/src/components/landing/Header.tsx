import { Link } from '@tanstack/react-router'

export function Header() {
	return (
		<header className="sticky top-0 z-50 bg-lp-bg border-b border-lp-border">
			<div className="border-lp-border mx-auto flex h-14 max-w-[1200px] items-center justify-between border-x px-4 md:px-8">
				<Link to="/" className="flex items-center gap-2 text-white no-underline">
					<img src="/logo.svg" alt="QUESTPIE" className="h-5 w-auto" />
				</Link>
				<nav className="flex items-center gap-3 sm:gap-6">
					<a
						href="/docs"
						className="font-mono text-sm text-lp-ghost hover:text-lp-fg transition-colors no-underline"
					>
						Docs
					</a>
					<a
						href="https://github.com/questpie/autopilot"
						target="_blank"
						rel="noopener noreferrer"
						className="font-mono text-sm text-lp-ghost hover:text-lp-fg transition-colors no-underline"
					>
						GitHub
					</a>
					<a
						href="https://questpie.com"
						target="_blank"
						rel="noopener noreferrer"
						className="font-mono text-sm text-lp-ghost hover:text-lp-fg transition-colors no-underline hidden sm:inline"
					>
						QUESTPIE
					</a>
					<span className="font-mono text-[10px] font-semibold text-lp-purple bg-lp-purple-faint border border-lp-purple-glow px-[10px] py-[3px] tracking-[0.15em] hidden sm:inline">
						v1.0 BETA
					</span>
				</nav>
			</div>
		</header>
	)
}
