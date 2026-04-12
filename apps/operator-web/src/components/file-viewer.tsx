/**
 * Unified file viewer component.
 * Dispatches to the appropriate view based on viewer-registry resolution.
 * Demo-safe: no external fetches, binary files get placeholder.
 */

import { resolveViewer } from '@/lib/viewer-registry'
import { cn } from '@/lib/utils'

// ── Syntax tokenizer (ported from files.tsx) ──

interface CodeToken {
  text: string
  className: string
}

const KEYWORDS = new Set([
  'import', 'export', 'from', 'function', 'const', 'let', 'var',
  'if', 'else', 'return', 'async', 'await', 'for', 'of', 'in',
  'new', 'type', 'interface', 'extends', 'implements', 'class',
  'default', 'void', 'null', 'undefined', 'true', 'false',
])

const TYPE_NAMES = new Set([
  'Promise', 'string', 'number', 'boolean', 'Set', 'Record',
  'PreviewArtifact', 'WalkOptions', 'Array',
])

function tokenizeLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = []
  let i = 0

  while (i < line.length) {
    // Comment
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.slice(i), className: 'text-muted-foreground italic' })
      break
    }
    // Block comment start
    if (line[i] === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2)
      if (end >= 0) {
        tokens.push({ text: line.slice(i, end + 2), className: 'text-muted-foreground italic' })
        i = end + 2
        continue
      }
      tokens.push({ text: line.slice(i), className: 'text-muted-foreground italic' })
      break
    }
    if (line[i] === '*' && (i === 0 || line.slice(0, i).trim() === '')) {
      tokens.push({ text: line.slice(i), className: 'text-muted-foreground italic' })
      break
    }
    // String (single or double quote or backtick)
    if (line[i] === "'" || line[i] === '"' || line[i] === '`') {
      const quote = line[i]
      let j = i + 1
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++
        j++
      }
      tokens.push({ text: line.slice(i, j + 1), className: 'text-green-500' })
      i = j + 1
      continue
    }
    // Number
    if (/\d/.test(line[i]) && (i === 0 || /[\s(,=+\-*/<>[\]{}:]/.test(line[i - 1]))) {
      let j = i
      while (j < line.length && /[\d._]/.test(line[j])) j++
      tokens.push({ text: line.slice(i, j), className: 'text-amber-500' })
      i = j
      continue
    }
    // Word
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++
      const word = line.slice(i, j)
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, className: 'text-primary' })
      } else if (TYPE_NAMES.has(word)) {
        tokens.push({ text: word, className: 'text-blue-500' })
      } else {
        tokens.push({ text: word, className: '' })
      }
      i = j
      continue
    }
    // Everything else
    tokens.push({ text: line[i], className: '' })
    i++
  }

  return tokens
}

// ── Sub-renderers ──

function CodeRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="overflow-auto font-mono text-[12px] leading-[20px]">
      {lines.map((line, i) => {
        const tokens = tokenizeLine(line)
        return (
          <div key={i} className="flex hover:bg-muted/10">
            <span className="inline-block w-[42px] shrink-0 select-none pr-3 text-right text-muted-foreground/50">
              {i + 1}
            </span>
            <span className="whitespace-pre">
              {tokens.map((token, j) => (
                <span key={j} className={token.className || undefined}>
                  {token.text}
                </span>
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MarkdownRenderer({ content }: { content: string }) {
  // Lightweight inline markdown rendering for demo — no external libs.
  // Handles: headings, bold, inline code, hr, paragraphs.
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const rawLine of lines) {
    const line = rawLine

    // Heading 1
    if (/^#\s/.test(line)) {
      elements.push(
        <h1 key={key++} className="mt-4 mb-2 text-[18px] font-bold text-foreground">
          {line.slice(2)}
        </h1>,
      )
      continue
    }
    // Heading 2
    if (/^##\s/.test(line)) {
      elements.push(
        <h2 key={key++} className="mt-3 mb-1 text-[15px] font-semibold text-foreground">
          {line.slice(3)}
        </h2>,
      )
      continue
    }
    // Heading 3
    if (/^###\s/.test(line)) {
      elements.push(
        <h3 key={key++} className="mt-2 mb-1 text-[13px] font-semibold text-foreground">
          {line.slice(4)}
        </h3>,
      )
      continue
    }
    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={key++} className="my-3 border-border/50" />)
      continue
    }
    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />)
      continue
    }
    // List item
    if (/^[-*]\s/.test(line)) {
      const text = line.slice(2)
      elements.push(
        <div key={key++} className="flex items-start gap-2 py-0.5 text-[13px] text-foreground">
          <span className="mt-[5px] size-1 shrink-0 rounded-full bg-muted-foreground" />
          <span>{inlineFormat(text)}</span>
        </div>,
      )
      continue
    }
    // Paragraph
    elements.push(
      <p key={key++} className="text-[13px] leading-relaxed text-foreground">
        {inlineFormat(line)}
      </p>,
    )
  }

  return <div className="flex flex-col gap-0.5 p-4">{elements}</div>
}

function inlineFormat(text: string): React.ReactNode {
  // Split on **bold** and `code` patterns
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-muted/40 px-1 font-mono text-[11px] text-primary">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function JsonTreeRenderer({ content, label }: { content: string; label: string }) {
  let parsed: unknown = null
  let parseError = false
  try {
    parsed = JSON.parse(content)
  } catch {
    parseError = true
  }

  if (parseError || parsed === null) {
    return <PlainRenderer content={content} />
  }

  return (
    <div className="overflow-auto p-4 font-mono text-[12px]">
      <JsonNode value={parsed} depth={0} label={label} />
    </div>
  )
}

function JsonNode({ value, depth, label }: { value: unknown; depth: number; label?: string }) {
  const indent = depth * 16

  if (Array.isArray(value)) {
    return (
      <div style={{ paddingLeft: indent }}>
        {label && <span className="text-blue-500">{label}: </span>}
        <span className="text-muted-foreground">[{value.length}]</span>
        <div>
          {value.slice(0, 20).map((item, i) => (
            <JsonNode key={i} value={item} depth={depth + 1} label={String(i)} />
          ))}
          {value.length > 20 && (
            <div
              style={{ paddingLeft: (depth + 1) * 16 }}
              className="text-muted-foreground/60"
            >
              ... {value.length - 20} more
            </div>
          )}
        </div>
      </div>
    )
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return (
      <div style={{ paddingLeft: indent }}>
        {label && <span className="text-blue-500">{label}: </span>}
        <div>
          {entries.slice(0, 50).map(([k, v]) => (
            <JsonNode key={k} value={v} depth={depth + 1} label={k} />
          ))}
          {entries.length > 50 && (
            <div
              style={{ paddingLeft: (depth + 1) * 16 }}
              className="text-muted-foreground/60"
            >
              ... {entries.length - 50} more fields
            </div>
          )}
        </div>
      </div>
    )
  }

  const strValue = String(value)
  const valueClass =
    typeof value === 'string'
      ? 'text-green-500'
      : typeof value === 'number'
        ? 'text-amber-500'
        : typeof value === 'boolean'
          ? 'text-primary'
          : 'text-muted-foreground'

  return (
    <div style={{ paddingLeft: indent }}>
      {label && <span className="text-blue-500">{label}: </span>}
      <span className={valueClass}>{strValue}</span>
    </div>
  )
}

function CsvTableRenderer({ content }: { content: string }) {
  const lines = content.trim().split('\n').slice(0, 51)
  if (lines.length === 0) return <PlainRenderer content={content} />

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows = lines
    .slice(1, 51)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')))

  return (
    <div className="overflow-auto p-4">
      <table className="w-full font-mono text-[12px]">
        <thead>
          <tr className="border-b border-border/50 text-left text-muted-foreground">
            {headers.map((h, i) => (
              <th key={i} className="pb-1.5 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/30 text-foreground">
              {row.map((cell, ci) => (
                <td key={ci} className="py-1 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {lines.length > 51 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Showing first 50 rows
        </p>
      )}
    </div>
  )
}

function PlainRenderer({ content }: { content: string }) {
  return (
    <pre className="overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] text-foreground">
      {content}
    </pre>
  )
}

function ImagePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
      <p className="text-[12px]">Image preview not available in demo</p>
    </div>
  )
}

function PdfPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
      <p className="text-[12px]">PDF preview not available in demo</p>
    </div>
  )
}

// ── Public component ──

export interface FileViewerProps {
  path: string
  content?: string
  mime?: string
  className?: string
}

export function FileViewer({ path, content, mime, className }: FileViewerProps) {
  const viewer = resolveViewer(path, mime)

  const body = (() => {
    switch (viewer.type) {
      case 'image':
        return <ImagePlaceholder />

      case 'pdf':
        return <PdfPlaceholder />

      case 'markdown':
        return content ? (
          <MarkdownRenderer content={content} />
        ) : (
          <PdfPlaceholder />
        )

      case 'structured': {
        if (!content) return <PdfPlaceholder />
        const e = path.split('.').pop()?.toLowerCase() ?? ''
        if (e === 'csv') return <CsvTableRenderer content={content} />
        if (e === 'xlsx') {
          // XLSX is binary — show note
          return (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <p className="text-[12px]">Spreadsheet preview not available in demo</p>
            </div>
          )
        }
        // JSON / YAML — show tree
        return <JsonTreeRenderer content={content} label={path.split('/').pop() ?? path} />
      }

      case 'code':
        return content ? (
          <CodeRenderer content={content} />
        ) : (
          <div className="flex items-center justify-center py-12 text-[12px] text-muted-foreground">
            No content available
          </div>
        )

      case 'plain':
      default:
        return content ? (
          <PlainRenderer content={content} />
        ) : (
          <div className="flex items-center justify-center py-12 text-[12px] text-muted-foreground">
            No content available
          </div>
        )
    }
  })()

  return (
    <div className={cn('flex flex-col overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {path.split('/').pop() ?? path}
        </span>
        <span className="font-heading text-[10px] text-muted-foreground/60">
          {viewer.label}
        </span>
      </div>
      <div className="flex-1 overflow-auto">{body}</div>
    </div>
  )
}
