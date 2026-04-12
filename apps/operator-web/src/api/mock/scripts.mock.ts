import type { Script } from '../types'

export const mockScripts: Script[] = [
  {
    id: 'sentiment-analyzer',
    name: 'sentiment-analyzer',
    description: 'Analyzes review sentiment using NLP pipeline and returns structured scores.',
    runner: 'bun',
    entry_point: 'scripts/sentiment-analyzer/index.ts',
    inputs: [
      { name: 'reviews', description: 'JSON-encoded array of review strings', type: 'json', required: true },
      { name: 'language', description: 'Language code (e.g. sk, en)', type: 'string', required: false },
    ],
    outputs: [
      { name: 'scores', description: 'JSON-encoded array of SentimentScore objects', type: 'json' },
      { name: 'summary', description: 'Human-readable sentiment summary', type: 'string' },
    ],
    sandbox: { fs_scope: { read: ['.'], write: [] }, network: 'unrestricted', timeout_ms: 300000 },
    tags: ['nlp', 'reviews'],
  },
  {
    id: 'price-scraper',
    name: 'price-scraper',
    description: 'Scrapes supplier websites for current ingredient prices.',
    runner: 'python3',
    entry_point: 'scripts/price-scraper/main.py',
    inputs: [
      { name: 'suppliers', description: 'JSON-encoded array of supplier identifiers', type: 'json', required: true },
      { name: 'items', description: 'JSON-encoded array of item names to look up', type: 'json', required: true },
    ],
    outputs: [
      { name: 'prices', description: 'JSON-encoded array of PriceEntry objects', type: 'json' },
    ],
    sandbox: { fs_scope: { read: ['.'], write: [] }, network: 'unrestricted', timeout_ms: 300000 },
    tags: ['scraping', 'pricing'],
  },
  {
    id: 'social-post-formatter',
    name: 'social-post-formatter',
    description: 'Formats draft content into platform-specific post formats (IG, FB, LinkedIn).',
    runner: 'bun',
    entry_point: 'scripts/social-formatter/index.ts',
    inputs: [
      { name: 'content', description: 'Draft content text to format', type: 'string', required: true },
      { name: 'platforms', description: 'JSON-encoded array of platform names (e.g. ["instagram","facebook"])', type: 'json', required: true },
    ],
    outputs: [
      { name: 'posts', description: 'JSON-encoded array of FormattedPost objects', type: 'json' },
    ],
    sandbox: { fs_scope: { read: ['.'], write: ['output/'] }, network: 'none', timeout_ms: 60000 },
    tags: ['social', 'formatting'],
  },
]
