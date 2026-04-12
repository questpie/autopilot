// Mock adapter. Returns hardcoded data matching API response shapes.
// Swap to real API: replace with hc<AppType>('/api/company').get().$get() (Hono client)

import type { CompanyProfile } from './types'
import { mockCompanyProfile } from './mock/company.mock'
import { delay } from './mock/delay'

export async function getCompanyProfile(): Promise<CompanyProfile> {
  await delay(80)
  return mockCompanyProfile
}

