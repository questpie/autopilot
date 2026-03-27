import { useState, useMemo, useCallback } from "react"
import { CaretRightIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { FileViewProps } from "@/lib/view-registry"

/**
 * Parse YAML or JSON content into a JS value.
 * Tries JSON first, then YAML via simple parsing.
 */
function parseContent(content: string, path: string): unknown {
  // Try JSON first
  if (path.endsWith(".json")) {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  // For YAML, do a basic parse (key: value per line, arrays, nested objects)
  // We use a simple approach since we don't want to bundle a YAML parser
  try {
    return JSON.parse(content)
  } catch {
    // Fallback: try to render as YAML-like key-value structure
    return parseSimpleYaml(content)
  }
}

interface YamlNode {
  key: string
  value: string | YamlNode[]
  indent: number
}

function parseSimpleYaml(content: string): YamlNode[] {
  const lines = content.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"))
  const result: YamlNode[] = []

  for (const line of lines) {
    const indent = line.search(/\S/)
    const trimmed = line.trim()

    if (trimmed.startsWith("- ")) {
      result.push({ key: "", value: trimmed.slice(2), indent })
    } else if (trimmed.includes(":")) {
      const colonIdx = trimmed.indexOf(":")
      const key = trimmed.slice(0, colonIdx).trim()
      const value = trimmed.slice(colonIdx + 1).trim()
      result.push({ key, value: value || "", indent })
    } else {
      result.push({ key: "", value: trimmed, indent })
    }
  }

  return result
}

function getValueColor(value: string): string {
  if (value === "true" || value === "false") return "text-blue-400"
  if (value === "null" || value === "~") return "text-muted-foreground/50"
  if (/^-?\d+(\.\d+)?$/.test(value)) return "text-green-400"
  if (value.startsWith('"') || value.startsWith("'")) return "text-yellow-400"
  return "text-yellow-400"
}

interface TreeNodeProps {
  nodeKey: string
  value: unknown
  depth: number
}

function TreeNode({ nodeKey, value, depth }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  const isExpandable =
    (typeof value === "object" && value !== null) ||
    Array.isArray(value)

  const handleToggle = useCallback(() => {
    if (isExpandable) setExpanded((p) => !p)
  }, [isExpandable])

  if (isExpandable) {
    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>)

    return (
      <div>
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1 py-0.5 hover:bg-muted/50"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          <CaretRightIcon
            size={10}
            className={cn(
              "shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
          {nodeKey && (
            <span className="font-mono text-xs text-purple-400">{nodeKey}:</span>
          )}
          {!expanded && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
            </span>
          )}
        </button>
        {expanded &&
          entries.map(([k, v]) => (
            <TreeNode key={k} nodeKey={k} value={v} depth={depth + 1} />
          ))}
      </div>
    )
  }

  const strValue = value === null ? "null" : String(value)

  return (
    <div
      className="flex items-center gap-2 py-0.5"
      style={{ paddingLeft: `${depth * 16 + 14}px` }}
    >
      {nodeKey && (
        <span className="font-mono text-xs text-purple-400">{nodeKey}:</span>
      )}
      <span className={cn("font-mono text-xs", getValueColor(strValue))}>
        {strValue}
      </span>
    </div>
  )
}

/**
 * Structured data viewer for YAML and JSON files.
 * Renders a collapsible key-value tree with colored values.
 */
function StructuredDataView({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const parsed = useMemo(() => parseContent(content, path), [content, path])

  if (parsed === null) {
    return (
      <div className="p-4">
        <p className="text-xs text-muted-foreground">{t("files.parse_error")}</p>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-foreground">
          {content}
        </pre>
      </div>
    )
  }

  // If it's the YAML simple parse result (array of YamlNode)
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && "indent" in (parsed[0] as Record<string, unknown>)) {
    const nodes = parsed as YamlNode[]
    return (
      <div className="p-4">
        {nodes.map((node, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-0.5"
            style={{ paddingLeft: `${(node.indent / 2) * 16}px` }}
          >
            {node.key && (
              <span className="font-mono text-xs text-purple-400">{node.key}:</span>
            )}
            {typeof node.value === "string" && node.value && (
              <span className={cn("font-mono text-xs", getValueColor(node.value))}>
                {node.value}
              </span>
            )}
          </div>
        ))}
      </div>
    )
  }

  // JSON / properly parsed structure
  return (
    <div className="p-4">
      <TreeNode nodeKey="" value={parsed} depth={0} />
    </div>
  )
}

export default StructuredDataView
