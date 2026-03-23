import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface LinkPattern {
	regex: RegExp
	to: (match: string) => string
}

const patterns: LinkPattern[] = [
	{ regex: /\b(task-[a-z0-9]+)\b/g, to: (id) => `/tasks/${id}` },
	{ regex: /@([a-z0-9-]+)\b/g, to: (id) => `/agents?agent=${id}` },
	{ regex: /#([a-z0-9-]+)\b/g, to: (ch) => `/chat?channel=${ch}` },
	{ regex: /\b(pin-[a-z0-9]+)\b/g, to: (id) => `/?pin=${id}` },
	{
		regex: /\/(projects|knowledge|skills|team|comms|tasks|context|logs)\/[^\s"')]+/g,
		to: (p) => `/files?file=${p}`,
	},
]

export function Linkify({ children }: { children: string }) {
	const text = children
	const parts: ReactNode[] = []
	let lastIndex = 0

	interface Match {
		index: number
		length: number
		text: string
		to: string
	}

	const allMatches: Match[] = []

	for (const { regex, to } of patterns) {
		const re = new RegExp(regex.source, regex.flags)
		let m: RegExpExecArray | null = re.exec(text)
		while (m !== null) {
			const captured = m[1] ?? m[0]
			allMatches.push({
				index: m.index,
				length: m[0].length,
				text: m[0],
				to: to(captured),
			})
			m = re.exec(text)
		}
	}

	allMatches.sort((a, b) => a.index - b.index)

	// Remove overlapping matches
	const filtered: Match[] = []
	let prevEnd = 0
	for (const match of allMatches) {
		if (match.index >= prevEnd) {
			filtered.push(match)
			prevEnd = match.index + match.length
		}
	}

	for (const match of filtered) {
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index))
		}
		parts.push(
			<Link
				key={`${match.index}-${match.text}`}
				to={match.to}
				className="text-primary hover:underline"
			>
				{match.text}
			</Link>,
		)
		lastIndex = match.index + match.length
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex))
	}

	return <>{parts}</>
}
