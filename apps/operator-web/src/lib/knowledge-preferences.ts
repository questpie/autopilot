import {
	type SavedKnowledgeLocation,
	normalizeSavedKnowledgeLocation,
} from '@/features/knowledge/lib/knowledge-locations'

export const KNOWLEDGE_PREFERENCE_KEYS = {
	recent: 'knowledge.recent',
	pinned: 'knowledge.pinned',
} as const

export function parseSavedKnowledgeLocations(value: unknown): SavedKnowledgeLocation[] {
	if (!Array.isArray(value)) return []
	return value
		.map((entry) => normalizeSavedKnowledgeLocation(entry))
		.filter((entry): entry is SavedKnowledgeLocation => entry !== null)
}
