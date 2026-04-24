import {
	type SavedFilesLocation,
	normalizeSavedFilesLocation,
} from '@/features/files/lib/file-paths'

export const FILES_PREFERENCE_KEYS = {
	recent: 'files.recent',
	pinned: 'files.pinned',
} as const

export function parseSavedFilesLocations(value: unknown): SavedFilesLocation[] {
	if (!Array.isArray(value)) return []
	return value
		.map((entry) => normalizeSavedFilesLocation(entry))
		.filter((entry): entry is SavedFilesLocation => entry !== null)
}
