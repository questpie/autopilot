/**
 * Resource linking system — auto-detects references in text and maps them to URLs.
 * See spec §12 for patterns and rendering.
 */

export type ResourceType =
  | "task"
  | "agent"
  | "file"
  | "channel"
  | "pr"
  | "artifact"

export interface LinkedReference {
  start: number
  end: number
  type: ResourceType
  ref: string
  displayLabel: string
  url: string
}

interface PatternDef {
  regex: RegExp
  type: ResourceType
  getLabel: (match: RegExpExecArray) => string
  getUrl: (match: RegExpExecArray) => string
}

const PATTERNS: PatternDef[] = [
  {
    regex: /\b(task-\d+|QP-\d+)\b/g,
    type: "task",
    getLabel: (m) => m[1],
    getUrl: (m) => `/tasks/${m[1]}`,
  },
  {
    regex: /\bagent:(\w[\w-]*)\b/g,
    type: "agent",
    getLabel: (m) => m[1],
    getUrl: (m) => `/team/${m[1]}`,
  },
  {
    regex: /(?:^|\s)(\/[\w/.-]+\.\w+)\b/g,
    type: "file",
    getLabel: (m) => {
      const parts = m[1].split("/")
      return parts[parts.length - 1]
    },
    getUrl: (m) => `/files${m[1]}?view=true`,
  },
  {
    regex: /#([\w-]+)\b/g,
    type: "channel",
    getLabel: (m) => `#${m[1]}`,
    getUrl: (m) => `/chat/${m[1]}`,
  },
  {
    regex: /\bPR #(\d+)\b/g,
    type: "pr",
    getLabel: (m) => `PR #${m[1]}`,
    getUrl: () => "#", // External URL would come from context
  },
  {
    regex: /\bartifact:([\w-]+)\b/g,
    type: "artifact",
    getLabel: (m) => m[1],
    getUrl: (m) => `/artifacts/${m[1]}`,
  },
]

/**
 * Scan text for resource references and return an array of matches
 * sorted by position, with no overlaps.
 */
export function resolveReferences(text: string): LinkedReference[] {
  const refs: LinkedReference[] = []

  for (const pattern of PATTERNS) {
    // Reset regex state
    pattern.regex.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.regex.exec(text)) !== null) {
      // For the file pattern, trim leading whitespace
      const fullMatch = match[0]
      const trimmedStart = fullMatch.length - fullMatch.trimStart().length
      const start = match.index + trimmedStart
      const end = match.index + fullMatch.length

      refs.push({
        start,
        end,
        type: pattern.type,
        ref: match[0].trim(),
        displayLabel: pattern.getLabel(match),
        url: pattern.getUrl(match),
      })
    }
  }

  // Sort by position, remove overlaps
  refs.sort((a, b) => a.start - b.start)

  const deduped: LinkedReference[] = []
  let lastEnd = -1
  for (const ref of refs) {
    if (ref.start >= lastEnd) {
      deduped.push(ref)
      lastEnd = ref.end
    }
  }

  return deduped
}
