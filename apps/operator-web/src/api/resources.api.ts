// Mock adapter for resource metadata.
// Resources are served via VFS company:// scope; this adapter enriches
// VFS entries with locally-maintained metadata (relations, versions, context).
// Swap to real API when backend adds resource metadata endpoints.

import { mockResources } from './mock/resources.mock'
import type { ResourceData } from './mock/resources.mock'
import { delay } from './mock/delay'

export type { ResourceData }
export type {
  ResourceType,
  ResourceStatus,
  ResourceVersion,
  ResourceRelation,
} from './mock/resources.mock'

export async function getResources(): Promise<ResourceData[]> {
  await delay(80)
  return mockResources
}

export async function getResource(
  id: string,
): Promise<ResourceData | null> {
  await delay(60)
  return mockResources.find((r) => r.id === id) ?? null
}
