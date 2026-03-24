import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { findInternalLinks } from './link-patterns'

export function Linkify({ children }: { children: string }) {
	const matches = findInternalLinks(children)
	if (matches.length === 0) return <>{children}</>

	const parts: ReactNode[] = []
	let lastIndex = 0

	for (const match of matches) {
		if (match.index > lastIndex) {
			parts.push(children.slice(lastIndex, match.index))
		}
		parts.push(
			<Link
				key={`${match.index}-${match.text}`}
				to={match.href}
				className="text-primary hover:underline"
			>
				{match.text}
			</Link>,
		)
		lastIndex = match.index + match.length
	}

	if (lastIndex < children.length) {
		parts.push(children.slice(lastIndex))
	}

	return <>{parts}</>
}
