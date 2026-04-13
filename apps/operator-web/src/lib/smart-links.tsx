/**
 * SmartText — detect structured references in plain text and render them as
 * clickable TanStack Router links.
 *
 * Recognised patterns:
 *   TASK-<id>  /  task:<id>     → /tasks?taskId=<id>
 *   RUN-<id>   /  run:<id>      → /tasks (run surfaces inside task detail)
 *   session:<id>                → /chat?sessionId=<id>
 *   file paths (.ts/.tsx/…)     → /files?path=<path>&view=file
 */

import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

// ── Pattern registry ──────────────────────────────────────────────────────────

type MatchType = 'task' | 'run' | 'session' | 'file'

interface PatternDef {
  regex: RegExp
  type: MatchType
  /** Extract the relevant capture group from a RegExpExecArray. */
  capture: (m: RegExpExecArray) => string
}

/**
 * Order matters — more specific patterns first so a task ref like "TASK-abc"
 * doesn't accidentally match the file-path pattern.
 */
const PATTERNS: PatternDef[] = [
  {
    // TASK-<uuid-fragment>  or  task:<uuid-fragment>
    regex: /\b(?:TASK|task)[:-]([a-f0-9-]{4,})/g,
    type: 'task',
    capture: (m) => m[1],
  },
  {
    // RUN-<uuid-fragment>  or  run:<uuid-fragment>
    regex: /\b(?:RUN|run)[:-]([a-f0-9-]{4,})/g,
    type: 'run',
    capture: (m) => m[1],
  },
  {
    // session:<uuid-fragment>
    regex: /\bsession[:-]([a-f0-9-]{4,})/g,
    type: 'session',
    capture: (m) => m[1],
  },
  {
    // Conservative file-path pattern — requires at least one path separator and
    // a known extension, and must be preceded by whitespace or start-of-string.
    regex: /(?:^|\s)((?:\.?\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:ts|tsx|js|jsx|json|yaml|yml|md|css|html|py|rs|go|sh|sql))\b/g,
    type: 'file',
    capture: (m) => m[1],
  },
]

// ── Core parser ───────────────────────────────────────────────────────────────

interface Segment {
  text: string
  link?: { type: MatchType; value: string }
}

/**
 * Parse a plain-text string into ordered segments. Each segment is either raw
 * text or a recognised reference that should become a hyperlink.
 */
export function parseSmartSegments(text: string): Segment[] {
  interface RawMatch {
    start: number
    end: number
    full: string // the matched text (entire match[0])
    type: MatchType
    value: string // the extracted id / path
  }

  const rawMatches: RawMatch[] = []

  for (const def of PATTERNS) {
    def.regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = def.regex.exec(text)) !== null) {
      const value = def.capture(m)
      // For file paths the captured group may have a leading space — trim it.
      const full = m[0].startsWith(' ') ? m[0].slice(1) : m[0]
      const start = m[0].startsWith(' ') ? m.index + 1 : m.index
      rawMatches.push({ start, end: start + full.length, full, type: def.type, value })
    }
  }

  if (rawMatches.length === 0) return [{ text }]

  // Sort by start position; remove overlaps (first match wins).
  rawMatches.sort((a, b) => a.start - b.start)
  const accepted: RawMatch[] = []
  let cursor = 0
  for (const raw of rawMatches) {
    if (raw.start < cursor) continue // overlaps a previously accepted match
    accepted.push(raw)
    cursor = raw.end
  }

  // Build segment list.
  const segments: Segment[] = []
  let pos = 0
  for (const m of accepted) {
    if (m.start > pos) segments.push({ text: text.slice(pos, m.start) })
    segments.push({ text: m.full, link: { type: m.type, value: m.value } })
    pos = m.end
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) })
  return segments
}

// ── Link renderer ─────────────────────────────────────────────────────────────

function SegmentLink({ segment }: { segment: Segment & { link: NonNullable<Segment['link']> } }): ReactNode {
  const cls = 'font-mono text-xs text-primary hover:underline'
  const { type, value } = segment.link

  switch (type) {
    case 'task':
      return (
        <Link to="/tasks" search={{ taskId: value }} className={cls}>
          {segment.text}
        </Link>
      )
    case 'run':
      // Runs surface inside task detail via the task route; pass as taskId param
      // until a dedicated run viewer route exists.
      return (
        <Link to="/tasks" search={{ taskId: value }} className={cls}>
          {segment.text}
        </Link>
      )
    case 'session':
      return (
        <Link to="/chat" search={{ sessionId: value }} className={cls}>
          {segment.text}
        </Link>
      )
    case 'file':
      return (
        <Link to="/files" search={{ path: value, view: 'file' }} className={cls}>
          {segment.text}
        </Link>
      )
  }
}

// ── React component ───────────────────────────────────────────────────────────

interface SmartTextProps {
  text: string
  /** Extra classes to apply to the wrapping span. */
  className?: string
}

/**
 * Render a plain-text string with embedded references turned into links.
 */
export function SmartText({ text, className }: SmartTextProps): ReactNode {
  const segments = parseSmartSegments(text)

  // Fast-path: nothing to linkify
  if (segments.length === 1 && !segments[0].link) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (!seg.link) return <span key={i}>{seg.text}</span>
        return <SegmentLink key={i} segment={seg as Segment & { link: NonNullable<Segment['link']> }} />
      })}
    </span>
  )
}
