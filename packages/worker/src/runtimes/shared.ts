/**
 * Shared helpers for runtime adapters.
 *
 * Small reusable pieces — not a framework.
 * Each adapter still owns its subprocess lifecycle and CLI-specific logic.
 */

import { parseStructuredOutput, getSummary } from '../structured-output'
import { collectPreviewDir } from '../preview'
import { resolve } from 'node:path'
import type { RunArtifact } from '@questpie/autopilot-spec'
import type { RunContext } from './adapter'

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

  // Inject capability profile hints (skills + prompt fragments)
  if (context.capabilities) {
    const cap = context.capabilities
    if (cap.skill_hints && cap.skill_hints.length > 0) {
      parts.push(`## Active Skills\n${cap.skill_hints.map(h => `- ${h.id} — ${h.description || h.name}`).join('\n')}`)
    } else if (cap.skills.length > 0) {
      parts.push(`## Active Skills\n${cap.skills.map((s) => `- ${s}`).join('\n')}`)
    }
    if (cap.prompts.length > 0) {
      parts.push(cap.prompts.join('\n\n'))
    }
  }

  // Injected context — small curated docs always present in the prompt
  if (context.injectedContext && Object.keys(context.injectedContext).length > 0) {
    const contextLines: string[] = ['## Context']
    for (const [name, content] of Object.entries(context.injectedContext)) {
      contextLines.push(`### ${name}\n${content}`)
    }
    parts.push(contextLines.join('\n\n'))
  }

  // Context hints — navigation map for agent discovery
  if (context.contextHints && context.contextHints.length > 0) {
    const hintLines: string[] = [
      '## Available Knowledge',
      '',
      'You have access to these knowledge sources. Read them when relevant to your task:',
    ]
    for (const hint of context.contextHints) {
      const label = hint.description ?? hint.type
      hintLines.push(`\n- **${label}**`)
      hintLines.push(`  Path: ${hint.path}`)
      if (hint.files && hint.files.length > 0) {
        hintLines.push(`  Key files: ${hint.files.join(', ')}`)
      }
    }
    parts.push(hintLines.join('\n'))
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
 *
 * When workDir is provided, preview_dir directives are expanded into
 * concrete preview_file artifacts via collectPreviewDir().
 */
export async function extractResult(rawText: string, workDir?: string | null): Promise<ExtractedResult> {
  const structured = parseStructuredOutput(rawText)

  const artifacts: RunArtifact[] = []

  for (const a of structured?.artifacts ?? []) {
    if (a.kind === 'preview_dir') {
      if (!workDir) {
        console.warn('[extractResult] preview_dir artifact found but no workDir provided — skipping')
        continue
      }
      const dirPath = a.attrs.path
      if (!dirPath) {
        console.warn('[extractResult] preview_dir artifact missing "path" attribute — skipping')
        continue
      }

      const resolvedPath = resolve(workDir, dirPath)
      const result = await collectPreviewDir(resolvedPath, {
        entry: a.attrs.entry,
      })

      artifacts.push(...result.files)

      // Emit manifest artifact — orchestrator normalizes unknown kinds to "other"
      artifacts.push({
        kind: 'preview_dir',
        title: `preview_dir:${a.title || a.attrs.title || dirPath}`,
        ref_kind: 'inline',
        ref_value: JSON.stringify(result.metadata),
        metadata: {
          preview_manifest: true,
          preview_entry: result.metadata.entry || null,
          source_dir: dirPath,
        },
      })
      continue
    }

    // Normal artifact — pass through as before
    artifacts.push({
      kind: a.kind,
      title: a.title,
      ref_kind: 'inline',
      ref_value: a.content,
    })
  }

  const outputs = structured && Object.keys(structured.tags).length > 0
    ? structured.tags
    : undefined

  const summary = (structured ? getSummary(structured) : null) ?? structured?.prose ?? rawText

  return { summary, artifacts, outputs }
}

/** Convenience type for subprocess handle. */
export type Subprocess = ReturnType<typeof Bun.spawn>

/**
 * Stream lines from a ReadableStream, calling `onLine` for each complete line.
 * Handles buffering of partial chunks and trailing content.
 */
export async function streamLines(
  stdout: ReadableStream<Uint8Array> | null,
  onLine: (line: string) => void,
): Promise<void> {
  if (!stdout) return

  const reader = stdout.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      while (buffer.includes('\n')) {
        const lineEnd = buffer.indexOf('\n')
        const line = buffer.slice(0, lineEnd).trim()
        buffer = buffer.slice(lineEnd + 1)
        if (line) onLine(line)
      }
    }

    const remaining = buffer.trim()
    if (remaining) onLine(remaining)
  } finally {
    reader.releaseLock()
  }
}

/** Truncate text to `maxLen` characters, appending '...' if truncated. */
export function truncate(text: string, maxLen = 200): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

/** Produce a short human-readable description of a tool call from its name and input args. */
export function summarizeToolInput(name: string, input?: Record<string, unknown>): string {
  if (!input) return name
  switch (name) {
    case 'Read': return `Read ${input.file_path ?? ''}`
    case 'Write': return `Write ${input.file_path ?? ''}`
    case 'Edit': return `Edit ${input.file_path ?? ''}`
    case 'Glob': return `Glob ${input.pattern ?? ''}`
    case 'Grep': return `Grep ${input.pattern ?? ''} ${input.path ? `in ${input.path}` : ''}`
    case 'Bash': return `Bash: ${truncate(String(input.command ?? input.description ?? ''), 120)}`
    case 'Agent': return `Agent: ${truncate(String(input.description ?? input.prompt ?? ''), 120)}`
    case 'WebSearch': return `WebSearch: ${input.query ?? ''}`
    case 'WebFetch': return `WebFetch: ${input.url ?? ''}`
    case 'mcp__autopilot__artifact_create': return `Artifact: ${truncate(String(input.title ?? ''), 100)}`
    default: {
      const firstVal = Object.values(input).find((v) => typeof v === 'string')
      return firstVal ? `${name}: ${truncate(String(firstVal), 100)}` : name
    }
  }
}
