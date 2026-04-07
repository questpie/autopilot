import { parseResourceRefs, resolveResourceRefUrl, type ResourceRefType } from './resource-links'

export type ResourceType = ResourceRefType

export interface LinkedReference {
	start: number
	end: number
	type: ResourceType
	ref: string
	displayLabel: string
	url: string
}

export function resolveReferences(text: string): LinkedReference[] {
	return parseResourceRefs(text)
		.map((ref) => {
			const url = resolveResourceRefUrl(ref)
			if (!url) return null

			return {
				start: ref.startIndex,
				end: ref.endIndex,
				type: ref.type,
				ref: ref.raw,
				displayLabel: ref.raw,
				url,
			}
		})
		.filter((ref): ref is LinkedReference => ref !== null)
}
