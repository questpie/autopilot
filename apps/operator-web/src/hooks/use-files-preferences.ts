import type { UserPreference } from '@/api/types'
import { type SavedFilesLocation, locationKey } from '@/features/files/lib/file-paths'
import { FILES_PREFERENCE_KEYS, parseSavedFilesLocations } from '@/lib/files-preferences'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { preferenceKeys, useSetUserPreference, useUserPreferences } from './use-preferences'

function dedupeLocations(locations: SavedFilesLocation[]): SavedFilesLocation[] {
	const seen = new Set<string>()
	const result: SavedFilesLocation[] = []
	for (const location of locations) {
		const key = locationKey(location)
		if (seen.has(key)) continue
		seen.add(key)
		result.push(location)
	}
	return result
}

export function useFilesPreferences() {
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

	const recent = parseSavedFilesLocations(byKey.get(FILES_PREFERENCE_KEYS.recent))
	const pinned = parseSavedFilesLocations(byKey.get(FILES_PREFERENCE_KEYS.pinned))

	function addRecent(location: SavedFilesLocation) {
		const next = dedupeLocations([location, ...recent]).slice(0, 12)
		writePreferenceLocally(FILES_PREFERENCE_KEYS.recent, next)
		setPreference.mutate({ key: FILES_PREFERENCE_KEYS.recent, value: next })
	}

	function togglePinned(location: SavedFilesLocation) {
		const key = locationKey(location)
		const exists = pinned.some((entry) => locationKey(entry) === key)
		const next = exists
			? pinned.filter((entry) => locationKey(entry) !== key)
			: dedupeLocations([location, ...pinned]).slice(0, 12)

		writePreferenceLocally(FILES_PREFERENCE_KEYS.pinned, next)
		setPreference.mutate({ key: FILES_PREFERENCE_KEYS.pinned, value: next })
	}

	function isPinned(location: Pick<SavedFilesLocation, 'path' | 'runId' | 'type'>) {
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
