import { normalizeSavedFilesLocation, type FilesLayout, type SavedFilesLocation } from '@/features/files/lib/file-paths'

export const FILES_PREFERENCE_KEYS = {
  layout: 'files.layout',
  recent: 'files.recent',
  pinned: 'files.pinned',
} as const

export function isFilesLayout(value: unknown): value is FilesLayout {
  return value === 'list' || value === 'grid' || value === 'columns' || value === 'preview'
}

export function parseSavedFilesLocations(value: unknown): SavedFilesLocation[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => normalizeSavedFilesLocation(entry))
    .filter((entry): entry is SavedFilesLocation => entry !== null)
}
