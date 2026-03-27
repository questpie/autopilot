import { useMemo } from "react"
import { UserCircleIcon, WrenchIcon, FolderOpenIcon } from "@phosphor-icons/react"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import type { FileViewProps } from "@/lib/view-registry"

interface RoleFrontmatter {
  name?: string
  description?: string
  default_tools?: string[]
  default_fs_scope?: {
    read?: string[]
    write?: string[]
  }
}

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns the frontmatter fields and the body content.
 */
function parseFrontmatter(raw: string): { frontmatter: RoleFrontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: raw }

  const fm: RoleFrontmatter = {}
  const lines = (match[1] ?? "").split("\n")

  let currentKey = ""
  let currentList: string[] | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("- ") && currentList !== null) {
      const value = trimmed.slice(2).replace(/^["'\[]|["'\]]$/g, "")
      currentList.push(value)
      continue
    }

    if (currentList !== null) {
      if (currentKey === "default_tools") fm.default_tools = currentList
      else if (currentKey === "read") {
        fm.default_fs_scope = fm.default_fs_scope ?? {}
        fm.default_fs_scope.read = currentList
      } else if (currentKey === "write") {
        fm.default_fs_scope = fm.default_fs_scope ?? {}
        fm.default_fs_scope.write = currentList
      }
      currentList = null
    }

    const kvMatch = trimmed.match(/^(\w+):\s*(.*)$/)
    if (kvMatch) {
      const [, key, value] = kvMatch
      if (!key) continue

      if (value?.startsWith("[") && value.endsWith("]")) {
        const items = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean)
        if (key === "default_tools") fm.default_tools = items
        continue
      }

      if (!value || value === "") {
        currentKey = key
        currentList = []
        continue
      }

      const cleanValue = value.replace(/^["']|["']$/g, "")
      if (key === "name") fm.name = cleanValue
      else if (key === "description") fm.description = cleanValue
    }
  }

  if (currentList !== null) {
    if (currentKey === "default_tools") fm.default_tools = currentList
    else if (currentKey === "read") {
      fm.default_fs_scope = fm.default_fs_scope ?? {}
      fm.default_fs_scope.read = currentList
    } else if (currentKey === "write") {
      fm.default_fs_scope = fm.default_fs_scope ?? {}
      fm.default_fs_scope.write = currentList
    }
  }

  return { frontmatter: fm, body: (match[2] ?? "").trim() }
}

/**
 * Specialized editor view for role prompt files (team/roles/*.md).
 * Shows frontmatter as a structured summary and the prompt body as rendered markdown.
 */
function RoleEditorView({ content, path }: FileViewProps) {
  const { t } = useTranslation()
  const { frontmatter, body } = useMemo(() => parseFrontmatter(content), [content])

  const roleName = path.split("/").pop()?.replace(".md", "") ?? "unknown"

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Role header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center bg-primary/10">
          <UserCircleIcon size={22} className="text-primary" />
        </div>
        <div className="flex flex-col">
          <h2 className="font-heading text-lg font-bold text-foreground">
            {frontmatter.name ?? roleName}
          </h2>
          {frontmatter.description && (
            <p className="text-xs text-muted-foreground">{frontmatter.description}</p>
          )}
        </div>
      </div>

      {/* Frontmatter summary */}
      <div className="grid grid-cols-1 gap-4 border border-border p-4 md:grid-cols-2">
        {/* Tools */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <WrenchIcon size={14} className="text-muted-foreground" />
            <span className="font-heading text-xs font-medium text-muted-foreground">
              {t("files.default_tools", "Default Tools")}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {(frontmatter.default_tools ?? []).map((tool) => (
              <Badge key={tool} variant="secondary" className="rounded-none font-mono text-[10px]">
                {tool}
              </Badge>
            ))}
            {(!frontmatter.default_tools || frontmatter.default_tools.length === 0) && (
              <span className="text-xs text-muted-foreground/60">
                {t("files.none", "None specified")}
              </span>
            )}
          </div>
        </div>

        {/* FS Scope */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <FolderOpenIcon size={14} className="text-muted-foreground" />
            <span className="font-heading text-xs font-medium text-muted-foreground">
              {t("files.fs_scope", "Filesystem Scope")}
            </span>
          </div>
          {frontmatter.default_fs_scope ? (
            <div className="flex flex-col gap-1">
              {frontmatter.default_fs_scope.read && (
                <div className="flex items-start gap-1">
                  <span className="font-mono text-[10px] text-green-500">R</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {frontmatter.default_fs_scope.read.join(", ")}
                  </span>
                </div>
              )}
              {frontmatter.default_fs_scope.write && (
                <div className="flex items-start gap-1">
                  <span className="font-mono text-[10px] text-amber-500">W</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {frontmatter.default_fs_scope.write.join(", ")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/60">
              {t("files.none", "None specified")}
            </span>
          )}
        </div>
      </div>

      {/* Prompt body */}
      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-sm font-medium text-foreground">
          {t("files.system_prompt", "System Prompt")}
        </h3>
        <div className="border border-border p-4">
          <MarkdownRenderer content={body} mode="full" />
        </div>
      </div>
    </div>
  )
}

export default RoleEditorView
