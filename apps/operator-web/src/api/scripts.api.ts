import type { Script } from './types'
import { api, configFetch } from '@/lib/api'

export async function getScripts(): Promise<Script[]> {
  const res = await api.api.scripts.$get()
  if (!res.ok) throw new Error(`Failed to list scripts: ${res.status}`)
  return res.json() as Promise<Script[]>
}

export async function getScript(id: string): Promise<Script | null> {
  try {
    return await configFetch<Script>(`/api/scripts/${encodeURIComponent(id)}`)
  } catch {
    return null
  }
}
