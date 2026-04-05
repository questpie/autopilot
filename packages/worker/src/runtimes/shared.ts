/**
 * Shared helpers for runtime adapters.
 *
 * Small reusable pieces — not a framework.
 * Each adapter still owns its subprocess lifecycle and CLI-specific logic.
 */

import { parseStructuredOutput, getSummary } from '../structured-output'
import type { RunArtifact } from '@questpie/autopilot-spec'
import type { RunContext, WorkerEvent } from './adapter'

/**
 * Build a prompt string from RunContext.
 * Shared across all adapters — same format regardless of runtime.
 */
export function buildPrompt(context: RunContext): string {
  const parts: string[] = []

  if (context.taskTitle) {
    parts.push(`# Task: ${context.taskTitle}`)
  }
  if (context.taskDescription) {
    parts.push(context.taskDescription)
  }
  if (context.instructions) {
    parts.push(`## Instructions\n${context.instructions}`)
  }

  if (parts.length === 0) {
    parts.push(`Execute run ${context.runId} for agent ${context.agentId}`)
  }

  return parts.join('\n\n')
}

/** Extracted result from structured output parsing. */
export interface ExtractedResult {
  summary: string
  artifacts: RunArtifact[]
  outputs: Record<string, string> | undefined
}

/**
 * Extract structured result from raw agent output text.
 * Parses the <AUTOPILOT_RESULT> block, maps artifacts and output tags.
 * Falls back to raw text as summary if no structured block found.
 */
export function extractResult(rawText: string): ExtractedResult {
  const structured = parseStructuredOutput(rawText)

  const artifacts: RunArtifact[] = (structured?.artifacts ?? []).map((a) => ({
    kind: a.kind as RunArtifact['kind'],
    title: a.title,
    ref_kind: 'inline' as const,
    ref_value: a.content,
  }))

  const outputs = structured && Object.keys(structured.tags).length > 0
    ? structured.tags
    : undefined

  const summary = (structured ? getSummary(structured) : null) ?? structured?.prose ?? rawText

  return { summary, artifacts, outputs }
}

/** Convenience type for subprocess handle. */
export type Subprocess = ReturnType<typeof Bun.spawn>

/** Create an event emitter helper bound to an event handler. */
export function createEmitter(handler: ((event: WorkerEvent) => void) | null) {
  return (event: WorkerEvent): void => {
    handler?.(event)
  }
}
