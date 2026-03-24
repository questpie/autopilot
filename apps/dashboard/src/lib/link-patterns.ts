export interface LinkPattern {
	/** Human-readable name for debugging */
	name: string
	/** Regex with at least one capture group. Must use the `g` flag. */
	regex: RegExp
	/** Build a route path from the captured group */
	to: (captured: string) => string
}

/**
 * Internal link patterns — shared between markdown renderer and Linkify component.
 * Add new patterns here and they'll work everywhere.
 */
export const linkPatterns: LinkPattern[] = [
	{ name: 'task', regex: /\b(task-[a-z0-9]+)\b/g, to: (id) => `/tasks/${id}` },
	{ name: 'agent', regex: /@([a-z0-9-]+)\b/g, to: (id) => `/agents?agent=${id}` },
	{ name: 'channel', regex: /#([a-z0-9-]+)\b/g, to: (ch) => `/chat?channel=${ch}` },
	{ name: 'pin', regex: /\b(pin-[a-z0-9]+)\b/g, to: (id) => `/?pin=${id}` },
	{
		name: 'file-path',
		regex: /\/(projects|knowledge|skills|team|comms|tasks|context|logs)\/[^\s"')]+/g,
		to: (p) => `/files?file=${p}`,
	},
]

interface InternalMatch {
	index: number
	length: number
	text: string
	href: string
}

/**
 * Find all internal link matches in a string, sorted and de-overlapped.
 */
export function findInternalLinks(text: string): InternalMatch[] {
	const all: InternalMatch[] = []

	for (const { regex, to } of linkPatterns) {
		const re = new RegExp(regex.source, regex.flags)
		let m: RegExpExecArray | null = re.exec(text)
		while (m !== null) {
			const captured = m[1] ?? m[0]!
			all.push({
				index: m.index,
				length: m[0].length,
				text: m[0],
				href: to(captured),
			})
			m = re.exec(text)
		}
	}

	all.sort((a, b) => a.index - b.index)

	// De-overlap
	const result: InternalMatch[] = []
	let prevEnd = 0
	for (const match of all) {
		if (match.index >= prevEnd) {
			result.push(match)
			prevEnd = match.index + match.length
		}
	}

	return result
}

/**
 * Replace internal link patterns in a plain text string with HTML anchor tags.
 */
export function linkifyHtml(text: string): string {
	const matches = findInternalLinks(text)
	if (matches.length === 0) return text

	const parts: string[] = []
	let lastIndex = 0

	for (const match of matches) {
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index))
		}
		parts.push(`<a href="${match.href}" data-internal="true">${match.text}</a>`)
		lastIndex = match.index + match.length
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex))
	}

	return parts.join('')
}
