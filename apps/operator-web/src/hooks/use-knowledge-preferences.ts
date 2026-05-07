import type { UserPreference } from '@/api/types'
import {
	type SavedKnowledgeLocation,
	locationKey,
} from '@/features/knowledge/lib/knowledge-locations'
import {
	KNOWLEDGE_PREFERENCE_KEYS,
	parseSavedKnowledgeLocations,
} from '@/lib/knowledge-preferences'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { preferenceKeys, useSetUserPreference, useUserPreferences } from './use-preferences'

function dedupeLocations(locations: SavedKnowledgeLocation[]): SavedKnowledgeLocation[] {
	const seen = new Set<string>()
	const result: SavedKnowledgeLocation[] = []
	for (const location of locations) {
		const key = locationKey(location)
		if (seen.has(key)) continue
		seen.add(key)
		result.push(location)
	}
	return result
}

export function useKnowledgePreferences() {
	const queryClient = useQueryClient()
	const preferencesQuery = useUserPreferences()
	const setPreference = useSetUserPreference()

	function writePreferenceLocally(key: string, value: unknown) {
		queryClient.setQueryData<UserPreference[]>(preferenceKeys.all, (current) => {
			const list = current ?? []
			const now = new Date().toISOString()
			const index = list.findIndex((item) => item.key === key)

			if (index === -1) {
				return [
					...list,
					{
						user_id: 'local',
						key,
						value,
						created_at: now,
						updated_at: now,
					},
				]
			}

			const next = [...list]
			next[index] = { ...next[index], value, updated_at: now }
			return next
		})
	}

	const byKey = useMemo(
		() => new Map((preferencesQuery.data ?? []).map((item) => [item.key, item.value])),
		[preferencesQuery.data],
	)

	const recent = parseSavedKnowledgeLocations(byKey.get(KNOWLEDGE_PREFERENCE_KEYS.recent))
	const pinned = parseSavedKnowledgeLocations(byKey.get(KNOWLEDGE_PREFERENCE_KEYS.pinned))

	function addRecent(location: SavedKnowledgeLocation) {
		const next = dedupeLocations([location, ...recent]).slice(0, 12)
		writePreferenceLocally(KNOWLEDGE_PREFERENCE_KEYS.recent, next)
		setPreference.mutate({ key: KNOWLEDGE_PREFERENCE_KEYS.recent, value: next })
	}

	function togglePinned(location: SavedKnowledgeLocation) {
		const key = locationKey(location)
		const exists = pinned.some((entry) => locationKey(entry) === key)
		const next = exists
			? pinned.filter((entry) => locationKey(entry) !== key)
			: dedupeLocations([location, ...pinned]).slice(0, 12)

		writePreferenceLocally(KNOWLEDGE_PREFERENCE_KEYS.pinned, next)
		setPreference.mutate({ key: KNOWLEDGE_PREFERENCE_KEYS.pinned, value: next })
	}

	function isPinned(location: Pick<SavedKnowledgeLocation, 'path' | 'runId' | 'type'>) {
		const key = locationKey(location)
		return pinned.some((entry) => locationKey(entry) === key)
	}

	return {
		recent,
		pinned,
		addRecent,
		togglePinned,
		isPinned,
	}
}
