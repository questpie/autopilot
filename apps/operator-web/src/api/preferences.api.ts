import type { UserPreference } from './types'

export async function getUserPreferences(): Promise<UserPreference[]> {
  const res = await fetch('/api/preferences', { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to fetch preferences: ${res.status}`)
  return res.json() as Promise<UserPreference[]>
}

export async function setUserPreference(key: string, value: unknown): Promise<UserPreference> {
  const res = await fetch(`/api/preferences/${encodeURIComponent(key)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`Failed to save preference: ${res.status}`)
  return res.json() as Promise<UserPreference>
}

export async function deleteUserPreference(key: string): Promise<void> {
  const res = await fetch(`/api/preferences/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Failed to delete preference: ${res.status}`)
}
