import type { Script } from '../types'

export const mockScripts: Script[] = [
  {
    id: 'scr_01JR8VQM3K0000000000000001',
    name: 'sentiment-analyzer',
    description: 'Analyzes review sentiment using NLP pipeline and returns structured scores.',
    runtime: 'bun',
    entry_point: 'scripts/sentiment-analyzer/index.ts',
    inputs: [
      { name: 'reviews', type: 'string[]', required: true },
      { name: 'language', type: 'string', required: false },
    ],
    outputs: [
      { name: 'scores', type: 'SentimentScore[]' },
      { name: 'summary', type: 'string' },
    ],
    linked_workflow_ids: ['wf_review_analysis'],
    linked_task_ids: ['tsk_01JR8VQM3K0000000000000003'],
    last_run_at: '2026-04-01T06:05:00.000Z',
    created_at: '2026-01-20T10:00:00.000Z',
  },
  {
    id: 'scr_01JR8VQM3K0000000000000002',
    name: 'price-scraper',
    description: 'Scrapes supplier websites for current ingredient prices.',
    runtime: 'python3',
    entry_point: 'scripts/price-scraper/main.py',
    inputs: [
      { name: 'suppliers', type: 'string[]', required: true },
      { name: 'items', type: 'string[]', required: true },
    ],
    outputs: [
      { name: 'prices', type: 'PriceEntry[]' },
    ],
    linked_workflow_ids: [],
    linked_task_ids: [],
    last_run_at: '2026-03-15T07:02:00.000Z',
    created_at: '2026-03-01T12:00:00.000Z',
  },
  {
    id: 'scr_01JR8VQM3K0000000000000003',
    name: 'social-post-formatter',
    description: 'Formats draft content into platform-specific post formats (IG, FB, LinkedIn).',
    runtime: 'bun',
    entry_point: 'scripts/social-formatter/index.ts',
    inputs: [
      { name: 'content', type: 'string', required: true },
      { name: 'platforms', type: 'string[]', required: true },
    ],
    outputs: [
      { name: 'posts', type: 'FormattedPost[]' },
    ],
    linked_workflow_ids: ['wf_content_plan'],
    linked_task_ids: [],
    last_run_at: '2026-03-25T09:10:00.000Z',
    created_at: '2026-02-10T08:00:00.000Z',
  },
]
