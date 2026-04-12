import type { FileTreeNode } from '../types'

// ── Workspace file tree (used by Files screen) ──
// Simulates what buildTreeFromVfsList() would produce from VFS list responses.

export const mockWorkspaceTree: FileTreeNode[] = [
  {
    path: 'packages',
    name: 'packages',
    type: 'directory',
    change: 'unchanged',
    size: null,
    mime_type: null,
    linked_task_id: null,
    linked_run_id: null,
    children: [
      {
        path: 'packages/orchestrator',
        name: 'orchestrator',
        type: 'directory',
        change: 'unchanged',
        size: null,
        mime_type: null,
        linked_task_id: null,
        linked_run_id: null,
        children: [
          {
            path: 'packages/orchestrator/src',
            name: 'src',
            type: 'directory',
            change: 'unchanged',
            size: null,
            mime_type: null,
            linked_task_id: null,
            linked_run_id: null,
            children: [
              { path: 'packages/orchestrator/src/orchestrator.ts', name: 'orchestrator.ts', type: 'file', change: 'unchanged', size: 4280, mime_type: 'text/typescript', linked_task_id: null, linked_run_id: null },
              { path: 'packages/orchestrator/src/queue.ts', name: 'queue.ts', type: 'file', change: 'unchanged', size: 2140, mime_type: 'text/typescript', linked_task_id: null, linked_run_id: null },
              { path: 'packages/orchestrator/src/steer-service.ts', name: 'steer-service.ts', type: 'file', change: 'unchanged', size: 3560, mime_type: 'text/typescript', linked_task_id: null, linked_run_id: null },
            ],
          },
          {
            path: 'packages/orchestrator/api/routes',
            name: 'api/routes',
            type: 'directory',
            change: 'unchanged',
            size: null,
            mime_type: null,
            linked_task_id: null,
            linked_run_id: null,
            children: [
              { path: 'packages/orchestrator/api/routes/tasks.ts', name: 'tasks.ts', type: 'file', change: 'unchanged', size: 1820, mime_type: 'text/typescript', linked_task_id: null, linked_run_id: null },
              { path: 'packages/orchestrator/api/routes/runs.ts', name: 'runs.ts', type: 'file', change: 'unchanged', size: 1440, mime_type: 'text/typescript', linked_task_id: null, linked_run_id: null },
              { path: 'packages/orchestrator/api/routes/schedules.ts', name: 'schedules.ts', type: 'file', change: 'unchanged', size: 2080, mime_type: 'text/typescript', linked_task_id: null, linked_run_id: null },
            ],
          },
        ],
      },
      {
        path: 'packages/worker',
        name: 'worker',
        type: 'directory',
        change: 'unchanged',
        size: null,
        mime_type: null,
        linked_task_id: null,
        linked_run_id: null,
        children: [
          {
            path: 'packages/worker/src',
            name: 'src',
            type: 'directory',
            change: 'unchanged',
            size: null,
            mime_type: null,
            linked_task_id: null,
            linked_run_id: null,
            children: [
              { path: 'packages/worker/src/preview.ts', name: 'preview.ts', type: 'file', change: 'modified', size: 5120, mime_type: 'text/typescript', linked_task_id: 'T-151', linked_run_id: 'run-177612' },
              { path: 'packages/worker/src/worker.ts', name: 'worker.ts', type: 'file', change: 'modified', size: 3840, mime_type: 'text/typescript', linked_task_id: 'T-151', linked_run_id: 'run-177612' },
              { path: 'packages/worker/src/preview.test.ts', name: 'preview.test.ts', type: 'file', change: 'added', size: 2460, mime_type: 'text/typescript', linked_task_id: 'T-151', linked_run_id: 'run-177612' },
            ],
          },
        ],
      },
    ],
  },
  {
    path: 'apps',
    name: 'apps',
    type: 'directory',
    change: 'unchanged',
    size: null,
    mime_type: null,
    linked_task_id: null,
    linked_run_id: null,
    children: [
      {
        path: 'apps/operator-web',
        name: 'operator-web',
        type: 'directory',
        change: 'unchanged',
        size: null,
        mime_type: null,
        linked_task_id: null,
        linked_run_id: null,
        children: [
          {
            path: 'apps/operator-web/src/routes/_app',
            name: 'src/routes/_app',
            type: 'directory',
            change: 'unchanged',
            size: null,
            mime_type: null,
            linked_task_id: null,
            linked_run_id: null,
            children: [
              { path: 'apps/operator-web/src/routes/_app/tasks.tsx', name: 'tasks.tsx', type: 'file', change: 'unchanged', size: 8240, mime_type: 'text/typescript', linked_task_id: null, linked_run_id: null },
              { path: 'apps/operator-web/src/routes/_app/chat.tsx', name: 'chat.tsx', type: 'file', change: 'unchanged', size: 6120, mime_type: 'text/typescript', linked_task_id: null, linked_run_id: null },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '.worktrees',
    name: '.worktrees',
    type: 'directory',
    change: 'unchanged',
    size: null,
    mime_type: null,
    linked_task_id: null,
    linked_run_id: null,
    children: [
      {
        path: '.worktrees/T-151',
        name: 'T-151',
        type: 'worktree-root',
        change: 'unchanged',
        size: null,
        mime_type: null,
        linked_task_id: 'T-151',
        linked_run_id: 'run-177612',
        children: [
          { path: '.worktrees/T-151/preview.ts', name: 'preview.ts', type: 'file', change: 'modified', size: 5120, mime_type: 'text/typescript', linked_task_id: 'T-151', linked_run_id: 'run-177612' },
          { path: '.worktrees/T-151/worker.ts', name: 'worker.ts', type: 'file', change: 'modified', size: 3840, mime_type: 'text/typescript', linked_task_id: 'T-151', linked_run_id: 'run-177612' },
          { path: '.worktrees/T-151/preview.test.ts', name: 'preview.test.ts', type: 'file', change: 'added', size: 2460, mime_type: 'text/typescript', linked_task_id: 'T-151', linked_run_id: 'run-177612' },
        ],
      },
    ],
  },
  { path: 'package.json', name: 'package.json', type: 'file', change: 'unchanged', size: 1240, mime_type: 'application/json', linked_task_id: null, linked_run_id: null },
  { path: 'tsconfig.json', name: 'tsconfig.json', type: 'file', change: 'unchanged', size: 480, mime_type: 'application/json', linked_task_id: null, linked_run_id: null },
  // Task-generated artifacts (ref_value paths from mockTaskArtifacts)
  {
    path: 'artifacts',
    name: 'artifacts',
    type: 'directory',
    change: 'unchanged',
    size: null,
    mime_type: null,
    linked_task_id: null,
    linked_run_id: null,
    children: [
      // tsk_01 — Newsletter draft r1
      { path: 'artifacts/newsletter-draft.md', name: 'newsletter-draft.md', type: 'file', change: 'unchanged', size: 4300, mime_type: 'text/markdown', linked_task_id: 'tsk_01JR8VQM3K0000000000000001', linked_run_id: 'run_01JR8VQM3K0000000000000003' },
      { path: 'artifacts/subject-lines.txt', name: 'subject-lines.txt', type: 'file', change: 'unchanged', size: 512, mime_type: 'text/plain', linked_task_id: 'tsk_01JR8VQM3K0000000000000001', linked_run_id: 'run_01JR8VQM3K0000000000000003' },
      // tsk_01 — Newsletter draft r2 (post-rejection)
      { path: 'artifacts/newsletter-draft-v2.md', name: 'newsletter-draft-v2.md', type: 'file', change: 'modified', size: 4608, mime_type: 'text/markdown', linked_task_id: 'tsk_01JR8VQM3K0000000000000001', linked_run_id: 'run_01JR8VQM3K0000000000000004' },
      { path: 'artifacts/subject-lines-v2.txt', name: 'subject-lines-v2.txt', type: 'file', change: 'modified', size: 614, mime_type: 'text/plain', linked_task_id: 'tsk_01JR8VQM3K0000000000000001', linked_run_id: 'run_01JR8VQM3K0000000000000004' },
      // tsk_04 — Content plan april
      { path: 'artifacts/content-plan-april.md', name: 'content-plan-april.md', type: 'file', change: 'unchanged', size: 7373, mime_type: 'text/markdown', linked_task_id: 'tsk_01JR8VQM3K0000000000000004', linked_run_id: 'run_01JR8VQM3K0000000000000009' },
      { path: 'artifacts/posts-april.csv', name: 'posts-april.csv', type: 'file', change: 'unchanged', size: 3240, mime_type: 'text/csv', linked_task_id: 'tsk_01JR8VQM3K0000000000000004', linked_run_id: 'run_01JR8VQM3K0000000000000009' },
      // tsk_05 — Partial competitors data (failed task)
      { path: 'artifacts/competitors-partial.csv', name: 'competitors-partial.csv', type: 'file', change: 'unchanged', size: 1820, mime_type: 'text/csv', linked_task_id: 'tsk_01JR8VQM3K0000000000000005', linked_run_id: 'run_01JR8VQM3K0000000000000007' },
    ],
  },
]

// ── Mock code content for file preview ──

export const mockCodeContent: Record<string, string> = {
  'packages/worker/src/preview.ts': `import { resolve, join } from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import type { PreviewArtifact, WalkOptions } from './types'

/**
 * Collect all preview-eligible files from the given directory,
 * filtering by extension and size constraints.
 */
export async function collectPreviewDir(
  rootDir: string,
  options: WalkOptions = {}
): Promise<PreviewArtifact[]> {
  const maxDepth = options.maxDepth ?? 10
  const maxFileSize = options.maxFileSize ?? 1024 * 1024 // 1MB
  const files = await walkDirectory(rootDir, maxDepth)

  return buildPreviewArtifacts(files, maxFileSize)
}

async function walkDirectory(
  dir: string,
  maxDepth: number,
  depth = 0
): Promise<string[]> {
  if (depth >= maxDepth) return []

  const entries = await readdir(dir, { withFileTypes: true })
  const results: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await walkDirectory(fullPath, maxDepth, depth + 1)
      results.push(...nested)
    } else {
      results.push(fullPath)
    }
  }

  return results
}

function buildPreviewArtifacts(
  files: string[],
  maxFileSize: number
): PreviewArtifact[] {
  return files
    .filter((f) => isPreviewable(f))
    .map((filePath) => ({
      path: filePath,
      relativePath: filePath,
      size: 0,
      mime: guessMime(filePath),
    }))
}

const PREVIEW_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json',
  '.md', '.css', '.html', '.yaml', '.yml',
])

function isPreviewable(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.'))
  return PREVIEW_EXTENSIONS.has(ext)
}

function guessMime(filePath: string): string {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'text/typescript'
  if (filePath.endsWith('.json')) return 'application/json'
  if (filePath.endsWith('.md')) return 'text/markdown'
  return 'text/plain'
}`,
  '.worktrees/T-151/preview.ts': `import { resolve, join } from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import type { PreviewArtifact, WalkOptions } from './types'

/**
 * Collect all preview-eligible files from the given directory,
 * filtering by extension and size constraints.
 */
export async function collectPreviewDir(
  rootDir: string,
  options: WalkOptions = {}
): Promise<PreviewArtifact[]> {
  const maxDepth = options.maxDepth ?? 10
  const maxFileSize = options.maxFileSize ?? 1024 * 1024 // 1MB
  const files = await walkDirectory(rootDir, maxDepth)

  return buildPreviewArtifacts(files, maxFileSize)
}`,
  // Task artifact file previews
  'artifacts/newsletter-draft.md': `# Newsletter — Svadobná sezóna 2026

Milí priatelia Kaviarne Kveta,

Jar je tu a s ňou prichádza najkrajšie obdobie roka — svadobná sezóna! 💐

Chceme vás pozvať na naše špeciálne **svadobné menu**, ktoré sme pripravili
špeciálne pre tento výnimočný čas.

## Čo ponúkame

- Torty na mieru podľa vášho vkusu
- Svadobný aperitív pre hostí
- Exkluzívny catering pre malé slávnosti (do 30 osôb)

Rezervácie: 0900 123 456

_Tím Kaviarne Kveta_`,
  'artifacts/subject-lines.txt': `Variant A: Svadobná sezóna v Kaviarni Kveta — rezervujte si termín!
Variant B: 🌸 Jaro, svadby a naša nová ponuka — pre vás
Variant C: Špeciálna ponuka pre svadobnú sezónu 2026`,
  'artifacts/newsletter-draft-v2.md': `# Newsletter — Svadobná sezóna 2026

Milí priatelia Kaviarne Kveta,

Jar je tu a s ňou prichádza najkrajšie obdobie roka — svadobná sezóna!

Chceme vás pozvať na naše špeciálne **svadobné menu**, ktoré sme pripravili
špeciálne pre tento výnimočný čas.

## Čo ponúkame

- Torty na mieru podľa vášho vkusu
- Svadobný aperitív pre hostí
- Exkluzívny catering pre malé slávnosti (do 30 osôb)

Rezervácie: 0900 123 456

_Tím Kaviarne Kveta_`,
  'artifacts/subject-lines-v2.txt': `Variant A: Svadobná sezóna v Kaviarni Kveta
Variant B: Jaro, svadby a naša nová ponuka
Variant C: Špeciálna ponuka 2026`,
  'artifacts/content-plan-april.md': `# Content plán — Apríl 2026

## Instagram (10 príspevkov)

| Dátum | Téma | Formát |
|-------|------|--------|
| 1. apr | Aprílové menu | Foto |
| 5. apr | Zákulisie prípravy | Reels |
| 8. apr | Jarne špeciality | Karusel |
| 12. apr | Zákaznícky príbeh | Story |
| 15. apr | Barista tip | Reels |
| 19. apr | Svadobná ponuka | Foto |
| 22. apr | Nová káva mesiaca | Foto |
| 25. apr | Za scénou | Reels |
| 28. apr | Víkendová špeciálna ponuka | Story |
| 30. apr | Aprílové zhrnutie | Karusel |`,
  'artifacts/posts-april.csv': `date,platform,type,topic,status
2026-04-01,instagram,photo,Aprílové menu,planned
2026-04-05,instagram,reels,Zákulisie prípravy,planned
2026-04-08,instagram,carousel,Jarne špeciality,planned
2026-04-12,instagram,story,Zákaznícky príbeh,planned
2026-04-15,instagram,reels,Barista tip,planned`,
  'artifacts/competitors-partial.csv': `name,address,avg_price,rating,notes
Kafé Modrá,Hlavná 12,4.20,4.3,Silná espresso ponuka
Espresso Bar,Námestie 5,3.80,4.1,Lacnejšia alternatíva
Kavička,Sadová 8,4.50,4.6,Prémiová káva — priamy súper
# Nedokončené — timeout pred stiahnutím zvyšných 2 konkurentov`,
}

// ── Mock diff data ──

export interface FileDiffInfo {
  added: number
  deleted: number
  hunks: Array<{ type: 'add' | 'delete' | 'context'; text: string }>
}

export const mockDiffs: Record<string, FileDiffInfo> = {
  'packages/worker/src/preview.ts': {
    added: 82,
    deleted: 14,
    hunks: [
      { type: 'add', text: 'export async function collectPreviewDir(' },
      { type: 'add', text: '  rootDir: string,' },
      { type: 'add', text: '  options: WalkOptions = {}' },
      { type: 'add', text: '): Promise<PreviewArtifact[]> {' },
      { type: 'add', text: '  const files = await walkDirectory(rootDir, maxDepth)' },
      { type: 'add', text: '  return buildPreviewArtifacts(files, maxFileSize)' },
      { type: 'context', text: '' },
      { type: 'delete', text: 'function collectPreviewFiles(' },
      { type: 'add', text: 'async function walkDirectory(' },
    ],
  },
  'packages/worker/src/worker.ts': {
    added: 24,
    deleted: 8,
    hunks: [
      { type: 'add', text: "import { collectPreviewDir } from './preview'" },
      { type: 'delete', text: "import { collectFiles } from './preview'" },
      { type: 'context', text: '' },
      { type: 'add', text: '  const artifacts = await collectPreviewDir(workDir)' },
      { type: 'delete', text: '  const artifacts = collectFiles(workDir)' },
    ],
  },
  '.worktrees/T-151/preview.ts': {
    added: 82,
    deleted: 14,
    hunks: [
      { type: 'add', text: 'export async function collectPreviewDir(' },
      { type: 'add', text: '  rootDir: string,' },
      { type: 'add', text: '): Promise<PreviewArtifact[]> {' },
      { type: 'context', text: '' },
      { type: 'delete', text: 'function collectPreviewFiles(' },
      { type: 'add', text: 'async function walkDirectory(' },
    ],
  },
  '.worktrees/T-151/worker.ts': {
    added: 24,
    deleted: 8,
    hunks: [
      { type: 'add', text: "import { collectPreviewDir } from './preview'" },
      { type: 'delete', text: "import { collectFiles } from './preview'" },
    ],
  },
}

// ── Mock commit history ──

export interface FileCommitEntry {
  hash: string
  message: string
  time: string
}

export const mockHistory: Record<string, FileCommitEntry[]> = {
  'packages/worker/src/preview.ts': [
    { hash: 'abc123f', message: 'Refactor preview collection to async walk', time: '2h ago' },
    { hash: '9f8e7d6', message: 'Add size constraints to preview artifacts', time: '5h ago' },
    { hash: 'b4c5d6e', message: 'Initial preview module', time: '2d ago' },
  ],
  'packages/worker/src/worker.ts': [
    { hash: 'abc123f', message: 'Use new collectPreviewDir in worker', time: '2h ago' },
    { hash: '1a2b3c4', message: 'Worker heartbeat improvements', time: '1d ago' },
    { hash: 'd5e6f7a', message: 'Worker init refactoring', time: '3d ago' },
  ],
  'packages/worker/src/preview.test.ts': [
    { hash: 'abc123f', message: 'Add tests for preview collection', time: '2h ago' },
  ],
}
  {
    path: '/worktrees/tsk_01JR8VQM3K0000000000000001',
    name: 'T-147 Newsletter k svadobnej sezóne',
    type: 'worktree-root',
    change: 'unchanged',
    size: null,
    mime_type: null,
    linked_task_id: 'tsk_01JR8VQM3K0000000000000001',
    linked_run_id: 'run_01JR8VQM3K0000000000000004',
    children: [
      {
        path: '/worktrees/tsk_01JR8VQM3K0000000000000001/artifacts',
        name: 'artifacts',
        type: 'directory',
        change: 'unchanged',
        size: null,
        mime_type: null,
        linked_task_id: null,
        linked_run_id: null,
        children: [
          {
            path: '/worktrees/tsk_01JR8VQM3K0000000000000001/artifacts/newsletter-draft-v2.md',
            name: 'newsletter-draft-v2.md',
            type: 'file',
            change: 'modified',
            size: 4608,
            mime_type: 'text/markdown',
            linked_task_id: null,
            linked_run_id: 'run_01JR8VQM3K0000000000000004',
          },
          {
            path: '/worktrees/tsk_01JR8VQM3K0000000000000001/artifacts/subject-lines-v2.txt',
            name: 'subject-lines-v2.txt',
            type: 'file',
            change: 'modified',
            size: 614,
            mime_type: 'text/plain',
            linked_task_id: null,
            linked_run_id: 'run_01JR8VQM3K0000000000000004',
          },
          {
            path: '/worktrees/tsk_01JR8VQM3K0000000000000001/artifacts/newsletter-draft.md',
            name: 'newsletter-draft.md',
            type: 'file',
            change: 'unchanged',
            size: 4300,
            mime_type: 'text/markdown',
            linked_task_id: null,
            linked_run_id: 'run_01JR8VQM3K0000000000000003',
          },
        ],
      },
    ],
  },
  {
    path: '/worktrees/tsk_01JR8VQM3K0000000000000004',
    name: 'T-142 Content plan na april',
    type: 'worktree-root',
    change: 'unchanged',
    size: null,
    mime_type: null,
    linked_task_id: 'tsk_01JR8VQM3K0000000000000004',
    linked_run_id: null,
    children: [
      {
        path: '/worktrees/tsk_01JR8VQM3K0000000000000004/artifacts',
        name: 'artifacts',
        type: 'directory',
        change: 'unchanged',
        size: null,
        mime_type: null,
        linked_task_id: null,
        linked_run_id: null,
        children: [
          {
            path: '/worktrees/tsk_01JR8VQM3K0000000000000004/artifacts/content-plan-april-v2.xlsx',
            name: 'content-plan-april-v2.xlsx',
            type: 'file',
            change: 'unchanged',
            size: 19456,
            mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            linked_task_id: null,
            linked_run_id: null,
          },
          {
            path: '/worktrees/tsk_01JR8VQM3K0000000000000004/artifacts/captions-v2.md',
            name: 'captions-v2.md',
            type: 'file',
            change: 'unchanged',
            size: 7373,
            mime_type: 'text/markdown',
            linked_task_id: null,
            linked_run_id: null,
          },
        ],
      },
    ],
  },
  {
    path: '/shared',
    name: 'shared',
    type: 'directory',
    change: 'unchanged',
    size: null,
    mime_type: null,
    linked_task_id: null,
    linked_run_id: null,
    children: [
      {
        path: '/shared/brand-guidelines.pdf',
        name: 'brand-guidelines.pdf',
        type: 'file',
        change: 'unchanged',
        size: 2457600,
        mime_type: 'application/pdf',
        linked_task_id: null,
        linked_run_id: null,
      },
      {
        path: '/shared/templates',
        name: 'templates',
        type: 'directory',
        change: 'unchanged',
        size: null,
        mime_type: null,
        linked_task_id: null,
        linked_run_id: null,
        children: [
          {
            path: '/shared/templates/newsletter.html',
            name: 'newsletter.html',
            type: 'file',
            change: 'added',
            size: 8192,
            mime_type: 'text/html',
            linked_task_id: null,
            linked_run_id: null,
          },
          {
            path: '/shared/templates/social-post.md',
            name: 'social-post.md',
            type: 'file',
            change: 'unchanged',
            size: 1024,
            mime_type: 'text/markdown',
            linked_task_id: null,
            linked_run_id: null,
          },
        ],
      },
    ],
  },
]
