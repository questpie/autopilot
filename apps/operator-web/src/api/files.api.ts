// Mock adapter for workspace file tree data.
// Swap to real API: replace with hc<AppType>('/api/vfs').get().$get() (Hono client)

import type { FileTreeNode } from './types'
import {
  mockWorkspaceTree,
  mockCodeContent,
  mockDiffs,
  mockHistory,
} from './mock/files.mock'
import type { FileDiffInfo, FileCommitEntry } from './mock/files.mock'
import { delay } from './mock/delay'

export type { FileDiffInfo, FileCommitEntry }

export async function getWorkspaceTree(): Promise<FileTreeNode[]> {
  await delay(80)
  return mockWorkspaceTree
}

export async function getFileCode(
  path: string,
): Promise<string | null> {
  await delay(60)
  return mockCodeContent[path] ?? null
}

export async function getFileDiff(
  path: string,
): Promise<FileDiffInfo | null> {
  await delay(60)
  return mockDiffs[path] ?? null
}

export async function getFileHistory(
  path: string,
): Promise<FileCommitEntry[]> {
  await delay(60)
  return mockHistory[path] ?? []
}
