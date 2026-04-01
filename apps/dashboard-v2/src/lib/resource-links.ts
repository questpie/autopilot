export type ResourceRefType =
	| 'agent'
	| 'human'
	| 'channel'
	| 'task'
	| 'file'
	| 'skill'

export interface ResourceRef {
	type: ResourceRefType
	raw: string
	id: string
	startIndex: number
	endIndex: number
}

const PATTERNS: Array<{ type: ResourceRefType; regex: RegExp }> = [
	{ type: 'agent', regex: /(?<=\s|^)@([a-z][a-z0-9-]*)/g },
	{ type: 'channel', regex: /(?<=\s|^)#([a-z][a-z0-9-]*)/g },
	{ type: 'task', regex: /(?<=\s|^)!([A-Z]+-\d+)/g },
	{ type: 'file', regex: /(?<=\s|^)(\/[a-zA-Z0-9_./-]+)/g },
	{ type: 'skill', regex: /(?<=\s|^)\$([a-z][a-z0-9-]*)/g },
]

export function parseResourceRefs(text: string): ResourceRef[] {
	const refs: ResourceRef[] = []

	for (const pattern of PATTERNS) {
		pattern.regex.lastIndex = 0
		let match: RegExpExecArray | null

		while ((match = pattern.regex.exec(text)) !== null) {
			const raw = match[0]
			const id = match[1] ?? raw
			refs.push({
				type: pattern.type,
				raw,
				id,
				startIndex: match.index,
				endIndex: match.index + raw.length,
			})
		}
	}

	return refs.sort((left, right) => left.startIndex - right.startIndex)
}

export function resolveResourceRefUrl(ref: ResourceRef): string | null {
	switch (ref.type) {
		case 'agent':
			return '/fs'
		case 'human':
			return `/dm/${ref.id}`
		case 'channel':
			return `/c/${ref.id}`
		case 'task':
			return '/workflow'
		case 'file':
			return '/fs'
		case 'skill':
			return '/fs'
		default:
			return null
	}
}
