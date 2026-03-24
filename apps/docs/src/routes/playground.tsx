'use client'

import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/playground')({
	head: () => ({
		meta: [
			{ title: 'Construct Generator | QUESTPIE Autopilot' },
			{ name: 'description', content: 'Deterministic generative construct avatars — 2M+ unique variations from any seed.' },
		],
	}),
	component: PlaygroundPage,
})

const EXAMPLE_SEEDS = [
	'SystemArchitect',
	'alpha-strategist',
	'beta-planner',
	'devops-charlie',
	'reviewer-max',
	'marketing-ann',
	'design-kai',
	'ops-bot-9',
	'claude-meta',
	'frontend-dev',
	'qa-tester',
	'data-pipeline',
	'security-agent',
	'infra-monitor',
	'deploy-agent',
	'code-reviewer',
	'task-planner',
	'doc-writer',
]

const SIZES = [24, 32, 48, 64, 80, 120, 200] as const

function PlaygroundPage() {
	const [seed, setSeed] = useState('SystemArchitect')
	const [size, setSize] = useState<number>(120)
	const [style, setStyle] = useState<'solid' | 'wireframe'>('solid')
	const [theme, setTheme] = useState<'dark' | 'light'>('dark')

	const apiUrl = `/api/avatar?seed=${encodeURIComponent(seed)}&size=${size}&style=${style}&theme=${theme}`
	const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${apiUrl}` : apiUrl

	return (
		<div className="min-h-screen bg-lp-bg text-lp-fg">
			<div className="max-w-5xl mx-auto px-6 py-12">
				{/* Header */}
				<div className="mb-10">
					<div className="flex items-center gap-3 mb-3">
						<h1 className="font-mono text-2xl font-bold tracking-tight">Construct Generator</h1>
						<span className="font-mono text-[10px] text-lp-purple border border-lp-purple px-2 py-0.5 tracking-[0.15em]">
							2,097,152 VARIATIONS
						</span>
					</div>
					<p className="font-sans text-sm text-lp-muted">
						Deterministic generative avatars powered by seeded PRNG.
						Same seed always produces the same construct. Pure SVG, zero dependencies.
					</p>
				</div>

				{/* Main layout: Preview + Controls */}
				<div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 mb-8">
					{/* Preview */}
					<div className="border border-lp-border bg-lp-bg p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
						<div className="absolute inset-0 bg-lp-purple/5 blur-[100px] pointer-events-none" />
						<div className="relative z-10">
							<img
								key={`${seed}-${size}-${style}-${theme}`}
								src={apiUrl}
								alt={`Construct avatar for "${seed}"`}
								width={Math.max(size, 200)}
								height={Math.max(size, 200)}
							/>
						</div>
						<div className="mt-6 font-mono text-[10px] text-lp-ghost uppercase tracking-[0.15em] text-center">
							{size}x{size}px · {style} · {theme}
						</div>
					</div>

					{/* Controls */}
					<div className="border border-lp-border bg-lp-card p-6 flex flex-col gap-6">
						<div>
							<h2 className="font-mono text-lg font-bold uppercase tracking-tight mb-1">Identity Matrix</h2>
							<p className="text-[12px] text-lp-muted">
								8 DNA attributes from seeded PRNG yielding 2M+ unique structural configurations.
							</p>
						</div>

						{/* Seed */}
						<div>
							<label className="font-mono text-[10px] text-lp-ghost uppercase tracking-[0.15em] mb-2 block">
								Input Seed
							</label>
							<input
								type="text"
								value={seed}
								onChange={(e) => setSeed(e.target.value)}
								className="w-full bg-lp-bg border border-lp-border px-3 py-2.5 font-mono text-sm text-lp-fg outline-none focus:border-lp-purple transition-colors"
								placeholder="Type to mutate DNA..."
							/>
						</div>

						{/* Render Mode */}
						<div>
							<label className="font-mono text-[10px] text-lp-ghost uppercase tracking-[0.15em] mb-2 block">
								Render Mode
							</label>
							<div className="grid grid-cols-2 gap-3">
								{(['solid', 'wireframe'] as const).map((s) => (
									<button
										key={s}
										onClick={() => setStyle(s)}
										className={`font-sans text-sm px-3 py-2.5 border transition-colors ${
											style === s
												? 'bg-lp-purple/10 border-lp-purple text-lp-fg'
												: 'bg-lp-bg border-lp-border text-lp-muted hover:border-lp-dim'
										}`}
									>
										{s.charAt(0).toUpperCase() + s.slice(1)}
									</button>
								))}
							</div>
						</div>

						{/* Environment */}
						<div>
							<label className="font-mono text-[10px] text-lp-ghost uppercase tracking-[0.15em] mb-2 block">
								Environment
							</label>
							<div className="grid grid-cols-2 gap-3">
								{(['dark', 'light'] as const).map((t) => (
									<button
										key={t}
										onClick={() => setTheme(t)}
										className={`font-sans text-sm px-3 py-2.5 border transition-colors ${
											theme === t
												? 'bg-lp-purple/10 border-lp-purple text-lp-fg'
												: 'bg-lp-bg border-lp-border text-lp-muted hover:border-lp-dim'
										}`}
									>
										{t.charAt(0).toUpperCase() + t.slice(1)}
									</button>
								))}
							</div>
						</div>

						{/* Size */}
						<div>
							<label className="font-mono text-[10px] text-lp-ghost uppercase tracking-[0.15em] mb-2 block">
								Size
							</label>
							<div className="flex gap-1 flex-wrap">
								{SIZES.map((s) => (
									<button
										key={s}
										onClick={() => setSize(s)}
										className={`font-mono text-[11px] px-2.5 py-1.5 border transition-colors ${
											size === s
												? 'bg-lp-purple text-white border-lp-purple'
												: 'bg-lp-bg border-lp-border text-lp-muted hover:text-lp-fg'
										}`}
									>
										{s}
									</button>
								))}
							</div>
						</div>

						{/* API URL */}
						<div className="pt-4 border-t border-lp-border">
							<label className="font-mono text-[10px] text-lp-ghost uppercase tracking-[0.15em] mb-1.5 block">
								API Endpoint
							</label>
							<div className="flex items-center gap-2">
								<code className="flex-1 bg-lp-bg border border-lp-border px-3 py-2 font-mono text-[10px] text-lp-purple truncate">
									{fullUrl}
								</code>
								<button
									onClick={() => navigator.clipboard?.writeText(fullUrl)}
									className="font-mono text-[10px] px-3 py-2 border border-lp-border text-lp-muted hover:text-lp-fg hover:border-lp-purple transition-colors shrink-0"
								>
									COPY
								</button>
							</div>
						</div>
					</div>
				</div>

				{/* Size comparison */}
				<div className="border border-lp-border bg-lp-card p-6 mb-8">
					<div className="font-mono text-[10px] text-lp-muted uppercase tracking-[0.15em] mb-4">
						Scale
					</div>
					<div className="flex items-end gap-4 flex-wrap">
						{SIZES.map((s) => (
							<div key={s} className="text-center">
								<div className="border border-lp-border bg-lp-bg p-1 inline-block mb-1">
									<img
										src={`/api/avatar?seed=${encodeURIComponent(seed)}&size=${s}&style=${style}&theme=${theme}`}
										alt=""
										width={s}
										height={s}
									/>
								</div>
								<div className="font-mono text-[9px] text-lp-ghost">{s}px</div>
							</div>
						))}
					</div>
				</div>

				{/* Gallery */}
				<div className="border border-lp-border bg-lp-card p-6 mb-8">
					<div className="font-mono text-[10px] text-lp-muted uppercase tracking-[0.15em] mb-4">
						Gallery
					</div>
					<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
						{EXAMPLE_SEEDS.map((s) => (
							<button
								key={s}
								onClick={() => setSeed(s)}
								className={`text-center group cursor-pointer ${
									seed === s ? 'opacity-100' : 'opacity-70 hover:opacity-100'
								} transition-opacity`}
							>
								<div
									className={`border bg-lp-bg p-1 inline-block mb-1 transition-colors ${
										seed === s ? 'border-lp-purple' : 'border-lp-border group-hover:border-lp-dim'
									}`}
								>
									<img
										src={`/api/avatar?seed=${encodeURIComponent(s)}&size=80&style=${style}&theme=${theme}`}
										alt={s}
										width={80}
										height={80}
									/>
								</div>
								<div className="font-mono text-[9px] text-lp-ghost truncate">{s}</div>
							</button>
						))}
					</div>
				</div>

				{/* Usage */}
				<div className="border border-lp-border bg-lp-card p-6">
					<div className="font-mono text-[10px] text-lp-muted uppercase tracking-[0.15em] mb-4">
						Usage
					</div>
					<div className="space-y-3 font-mono text-[12px]">
						<div>
							<div className="text-lp-ghost mb-1">HTML</div>
							<code className="block bg-lp-bg border border-lp-border p-3 text-[11px] text-lp-fg overflow-x-auto">
								{`<img src="${fullUrl}" alt="avatar" />`}
							</code>
						</div>
						<div>
							<div className="text-lp-ghost mb-1">Markdown</div>
							<code className="block bg-lp-bg border border-lp-border p-3 text-[11px] text-lp-fg overflow-x-auto">
								{`![avatar](${fullUrl})`}
							</code>
						</div>
						<div>
							<div className="text-lp-ghost mb-1">Parameters</div>
							<div className="bg-lp-bg border border-lp-border p-3 text-[11px] text-lp-muted space-y-1">
								<div><span className="text-lp-purple">seed</span> — any string (required)</div>
								<div><span className="text-lp-purple">size</span> — 16–512 px (default 80)</div>
								<div><span className="text-lp-purple">style</span> — solid | wireframe (default solid)</div>
								<div><span className="text-lp-purple">theme</span> — dark | light (default dark)</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
