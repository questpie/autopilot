import type { Worker } from './types'
import { delay } from './mock/delay'

const mockWorkers: Worker[] = [
  {
    id: 'wrk_01JR8VQM3K0000000000000001',
    name: 'main-orchestrator',
    status: 'online',
    capabilities: [
      {
        runtime: 'bun',
        models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
        maxConcurrent: 4,
        tags: ['content', 'analytics'],
      },
    ],
    registered_at: '2026-04-08T00:00:00.000Z',
    last_heartbeat: '2026-04-10T14:59:55.000Z',
  },
  {
    id: 'wrk_01JR8VQM3K0000000000000002',
    name: 'content-worker',
    status: 'busy',
    capabilities: [
      {
        runtime: 'bun',
        models: ['claude-sonnet-4-20250514'],
        maxConcurrent: 2,
        tags: ['content'],
      },
    ],
    registered_at: '2026-04-09T00:00:00.000Z',
    last_heartbeat: '2026-04-10T14:59:50.000Z',
  },
  {
    id: 'wrk_01JR8VQM3K0000000000000003',
    name: 'analytics-worker',
    status: 'online',
    capabilities: [
      {
        runtime: 'bun',
        models: ['claude-sonnet-4-20250514'],
        maxConcurrent: 2,
        tags: ['analytics'],
      },
    ],
    registered_at: '2026-04-05T00:00:00.000Z',
    last_heartbeat: '2026-04-10T14:59:52.000Z',
  },
  {
    id: 'wrk_01JR8VQM3K0000000000000004',
    name: 'notification-worker',
    status: 'offline',
    capabilities: [
      {
        runtime: 'bun',
        models: ['claude-haiku-4-20250414'],
        maxConcurrent: 8,
        tags: ['notifications'],
      },
    ],
    registered_at: '2026-04-01T00:00:00.000Z',
    last_heartbeat: '2026-04-09T22:15:00.000Z',
  },
]

export async function getWorkers(): Promise<Worker[]> {
  await delay(80)
  return mockWorkers
}

