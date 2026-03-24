'use client'

import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/playground')({
	head: () => ({
		meta: [
			{ title: 'Avatar Playground | QUESTPIE Autopilot' },
			{ name: 'description', content: 'Generate deterministic avatars from any seed string.' },
		],
	}),
	component: PlaygroundPage,
})

const EXAMPLE_SEEDS = [
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
]

const SIZES = [24, 32, 48, 64, 80, 120, 200] as const

function PlaygroundPage() {
	const [seed, setSeed] = useState('my-agent')
	const [size, setSize] = useState<number>(120)

	const apiUrl = `/api/avatar?seed=${encodeURIComponent(seed)}&size=${size}`
	const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${apiUrl}` : apiUrl

	return (
		<div className="min-h-screen bg-lp-bg text-lp-fg">
			<div className="max-w-4xl mx-auto px-6 py-12">
				{/* Header */}
				<div className="mb-10">
					<h1 className="font-mono text-2xl font-bold tracking-tight mb-2">Avatar Playground</h1>
					<p className="font-sans text-sm text-lp-muted">
						Deterministic generative avatars — same seed always produces the same face.
						Pure SVG, zero dependencies, brutalist geometry.
					</p>
				</div>

				{/* Controls */}
				<div className="border border-lp-border bg-lp-card p-6 mb-8">
					<div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6">
						{/* Seed input */}
						<div>
							<label className="font-mono text-[10px] text-lp-muted uppercase tracking-[0.15em] mb-2 block">
								Seed
							</label>
							<input
								type="text"
								value={seed}
								onChange={(e) => setSeed(e.target.value)}
								className="w-full bg-lp-bg border border-lp-border px-3 py-2 font-mono text-sm text-lp-fg outline-none focus:border-lp-purple transition-colors"
								placeholder="Enter any string..."
							/>
						</div>

						{/* Size select */}
						<div>
							<label className="font-mono text-[10px] text-lp-muted uppercase tracking-[0.15em] mb-2 block">
								Size
							</label>
							<div className="flex gap-1">
								{SIZES.map((s) => (
									<button
										key={s}
										onClick={() => setSize(s)}
										className={`font-mono text-[11px] px-2.5 py-2 border transition-colors ${
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
					</div>

					{/* API URL */}
					<div className="mt-4 pt-4 border-t border-lp-border">
						<label className="font-mono text-[10px] text-lp-muted uppercase tracking-[0.15em] mb-1.5 block">
							API URL
						</label>
						<div className="flex items-center gap-2">
							<code className="flex-1 bg-lp-bg border border-lp-border px-3 py-2 font-mono text-[11px] text-lp-purple truncate">
								{fullUrl}
							</code>
							<button
								onClick={() => navigator.clipboard?.writeText(fullUrl)}
								className="font-mono text-[10px] px-3 py-2 border border-lp-border text-lp-muted hover:text-lp-fg hover:border-lp-purple transition-colors shrink-0"
							>
								COPY
							</button>
						</div>
						<p className="font-mono text-[10px] text-lp-ghost mt-2">
							Use as &lt;img src&gt; — returns image/svg+xml, cached 7 days.
						</p>
					</div>
				</div>

				{/* Preview */}
				<div className="border border-lp-border bg-lp-card p-6 mb-8">
					<div className="font-mono text-[10px] text-lp-muted uppercase tracking-[0.15em] mb-4">
						Preview
					</div>
					<div className="flex items-center gap-6">
						<div className="border border-lp-border bg-lp-bg p-4 inline-block">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								key={`${seed}-${size}`}
								src={apiUrl}
								alt={`Avatar for "${seed}"`}
								width={size}
								height={size}
							/>
						</div>
						<div className="space-y-1">
							<div className="font-mono text-sm font-semibold">{seed}</div>
							<div className="font-mono text-[11px] text-lp-muted">{size}x{size}px</div>
						</div>
					</div>
				</div>

				{/* Size comparison */}
				<div className="border border-lp-border bg-lp-card p-6 mb-8">
					<div className="font-mono text-[10px] text-lp-muted uppercase tracking-[0.15em] mb-4">
						Sizes
					</div>
					<div className="flex items-end gap-4 flex-wrap">
						{SIZES.map((s) => (
							<div key={s} className="text-center">
								<div className="border border-lp-border bg-lp-bg p-1 inline-block mb-1">
									<img
										src={`/api/avatar?seed=${encodeURIComponent(seed)}&size=${s}`}
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

				{/* Grid of examples */}
				<div className="border border-lp-border bg-lp-card p-6">
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
										src={`/api/avatar?seed=${encodeURIComponent(s)}&size=64`}
										alt={s}
										width={64}
										height={64}
									/>
								</div>
								<div className="font-mono text-[9px] text-lp-ghost truncate">{s}</div>
							</button>
						))}
					</div>
				</div>

				{/* Usage docs */}
				<div className="mt-8 border border-lp-border bg-lp-card p-6">
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
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
