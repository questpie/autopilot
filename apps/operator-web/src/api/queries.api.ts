import type { Query } from './types'
import { mockQueries } from './mock/queries.mock'
import { delay } from './mock/delay'

export async function getQueries(): Promise<Query[]> {
  await delay(80)
  return mockQueries
}

export async function getQuery(
  id: string,
): Promise<Query | null> {
  await delay(60)
  return mockQueries.find((q) => q.id === id) ?? null
}

export async function createQuery(
  prompt: string,
): Promise<Query> {
  await delay(150)
  // In real implementation: POST /api/queries { prompt }
  const now = new Date().toISOString()
  return {
    id: `qry_mock_${Date.now()}`,
    prompt,
    agent_id: 'agent_content',
    run_id: null,
    status: 'pending',
    allow_repo_mutation: false,
    mutated_repo: false,
    summary: null,
    created_by: 'usr_jana',
    created_at: now,
    ended_at: null,
    metadata: {},
    session_id: null,
  }
}

