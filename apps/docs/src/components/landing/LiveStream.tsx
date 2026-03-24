'use client'

import { useEffect, useRef, useState } from 'react'
import { Brain, BookOpen, PencilSimple, ChatDots, PushPin, CheckCircle, Package } from '@phosphor-icons/react'
import { GenerativeAvatar } from '@questpie/avatar'

const lines: { t: string; icon: React.ReactNode; agent: string; color: string; msg: string }[] = [
	{
		t: '14:30:12',
		icon: <Brain size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'Reading spec to understand feature grid requirements...',
	},
	{
		t: '14:30:15',
		icon: <BookOpen size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'read_file \u2192 landing-spec.md',
	},
	{
		t: '14:30:22',
		icon: <Brain size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'Need 2x3 grid. Creating FeatureGrid component...',
	},
	{
		t: '14:30:45',
		icon: <PencilSimple size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'write_file \u2192 FeatureGrid.tsx (142 lines)',
	},
	{
		t: '14:30:48',
		icon: <PencilSimple size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'write_file \u2192 FeatureGrid.module.css (67 lines)',
	},
	{
		t: '14:31:00',
		icon: <ChatDots size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: '\u2192 dev: "FeatureGrid done. Moving to testimonials."',
	},
	{
		t: '14:31:02',
		icon: <PushPin size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'pin_to_board \u2192 "Landing Page: 50%"',
	},
	{
		t: '14:32:00',
		icon: <CheckCircle size={14} className="text-lp-accent-green" />,
		agent: 'ops',
		color: 'text-lp-purple',
		msg: 'Health check passed (CPU 23%, Mem 41%)',
	},
	{
		t: '14:33:10',
		icon: <Brain size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'Checking if spec has testimonials section...',
	},
	{
		t: '14:33:12',
		icon: <BookOpen size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'read_file \u2192 landing-spec.md (section: testimonials)',
	},
	{
		t: '14:34:00',
		icon: <PencilSimple size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'write_file \u2192 Testimonials.tsx (89 lines)',
	},
	{
		t: '14:34:30',
		icon: <Package size={14} className="text-lp-muted" />,
		agent: 'max',
		color: 'text-lp-purple',
		msg: 'git_commit \u2192 "feat: add FeatureGrid and Testimonials"',
	},
]

export function LiveStream() {
	const [visible, setVisible] = useState(3)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (visible >= lines.length) return
		const t = setTimeout(() => setVisible((v) => Math.min(v + 1, lines.length)), 1200)
		return () => clearTimeout(t)
	}, [visible])

	useEffect(() => {
		ref.current?.scrollTo(0, ref.current.scrollHeight)
	}, [visible])

	return (
		<div className="bg-lp-bg border border-lp-border overflow-hidden">
			<div className="px-4 py-2 border-b border-lp-border flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="w-2 h-2 bg-lp-purple" />
					<span className="font-mono text-[11px] text-lp-ghost">
						autopilot attach max --compact
					</span>
				</div>
				<span className="font-mono text-[10px] text-lp-purple">● LIVE</span>
			</div>
			<div ref={ref} className="p-4 font-mono text-[11px] max-h-[340px] overflow-auto">
				{lines.slice(0, visible).map((l, i) => (
					<div
						key={l.t + l.msg}
						className={`mb-1 flex gap-2 ${i >= visible - 1 ? 'opacity-100' : 'opacity-70'}`}
					>
						<span className="text-lp-dim min-w-[60px]">{l.t}</span>
						<span className="flex items-center shrink-0">{l.icon}</span>
						<span className="shrink-0 w-4 h-4 overflow-hidden">
							<GenerativeAvatar seed={l.agent} size={16} />
						</span>
						<span className={`${l.color} min-w-[55px]`}>{l.agent}</span>
						<span className={i >= visible - 1 ? 'text-lp-fg' : 'text-lp-ghost'}>{l.msg}</span>
					</div>
				))}
				<span className="text-lp-purple animate-[blink_1s_infinite]">{'\u2588'}</span>
			</div>
		</div>
	)
}
