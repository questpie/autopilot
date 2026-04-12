// Mock adapter. Returns hardcoded data matching API response shapes.
// Swap to real API: replace with hc<AppType>('/api/integrations').get().$get() (Hono client)

import type { Integration } from './types'
import { mockIntegrations } from './mock/integrations.mock'
import { delay } from './mock/delay'

export async function getIntegrations(): Promise<Integration[]> {
  await delay(80)
  return mockIntegrations
}
