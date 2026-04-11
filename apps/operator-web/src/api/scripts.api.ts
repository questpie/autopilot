import type { Script } from './types'
import { mockScripts } from './mock/scripts.mock'
import { delay } from './mock/delay'

export async function getScripts(): Promise<Script[]> {
  await delay(80)
  return mockScripts
}

export async function getScript(id: string): Promise<Script | null> {
  await delay(60)
  return mockScripts.find((s) => s.id === id) ?? null
}
