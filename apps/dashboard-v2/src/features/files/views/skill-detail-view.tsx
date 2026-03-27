import { useMemo } from "react"
import { WrenchIcon, TagIcon, CodeIcon, UsersIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import type { FileViewProps } from "@/lib/view-registry"

interface SkillFrontmatter {
  roles: string[]
  tags: string[]
  scripts: string[]
}

/**
 * Parse a SKILL.md file — extract frontmatter (roles, tags, scripts)
 * and the markdown body.
 */
function parseSkillMd(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const fm: SkillFrontmatter = { roles: [], tags: [], scripts: [] }

  // Check for YAML frontmatter
  if (content.startsWith("---")) {
    const endIdx = content.indexOf("---", 3)
    if (endIdx !== -1) {
      const fmContent = content.slice(3, endIdx)
      const body = content.slice(endIdx + 3).trim()

      const lines = fmContent.split("\n")
      let currentKey = ""
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith("roles:")) currentKey = "roles"
        else if (trimmed.startsWith("tags:")) currentKey = "tags"
        else if (trimmed.startsWith("scripts:")) currentKey = "scripts"
        else if (trimmed.startsWith("- ") && currentKey) {
          fm[currentKey as keyof SkillFrontmatter].push(trimmed.slice(2).trim())
        }
      }

      return { frontmatter: fm, body }
    }
  }

  // Extract from markdown sections
  const body = content
  const rolesMatch = content.match(/## Roles\n([\s\S]*?)(?=\n##|\n$|$)/)
  if (rolesMatch) {
    fm.roles = rolesMatch[1]
      .split("\n")
      .filter((l) => l.trim().startsWith("- "))
      .map((l) => l.trim().slice(2))
  }

  const scriptsMatch = content.match(/## Scripts\n([\s\S]*?)(?=\n##|\n$|$)/)
  if (scriptsMatch) {
    fm.scripts = scriptsMatch[1]
      .split("\n")
      .filter((l) => l.trim().startsWith("- "))
      .map((l) => l.trim().slice(2))
  }

  return { frontmatter: fm, body }
}

/**
 * Skill detail view for SKILL.md files.
 * Shows a skill card with metadata and rendered markdown.
 */
function SkillDetailView({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const { frontmatter, body } = useMemo(() => parseSkillMd(content), [content])

  const skillName = path.split("/").filter(Boolean).slice(-2, -1)[0] ?? t("files.untitled_skill")

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Skill card header */}
      <div className="flex flex-col gap-4 border border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center bg-primary/10">
            <WrenchIcon size={20} className="text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-base font-bold text-foreground">
              {skillName}
            </span>
            <span className="text-[10px] text-muted-foreground">{path}</span>
          </div>
        </div>

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-3">
          {frontmatter.roles.length > 0 && (
            <div className="flex items-center gap-1.5">
              <UsersIcon size={12} className="text-muted-foreground" />
              <span className="font-heading text-[10px] text-muted-foreground">
                {t("files.skill_roles")}:
              </span>
              {frontmatter.roles.map((role) => (
                <Badge key={role} variant="outline" className="rounded-none text-[9px]">
                  {role}
                </Badge>
              ))}
            </div>
          )}

          {frontmatter.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <TagIcon size={12} className="text-muted-foreground" />
              {frontmatter.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="rounded-none text-[9px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {frontmatter.scripts.length > 0 && (
            <div className="flex items-center gap-1.5">
              <CodeIcon size={12} className="text-muted-foreground" />
              <span className="font-heading text-[10px] text-muted-foreground">
                {t("files.skill_scripts")}:
              </span>
              {frontmatter.scripts.map((script) => (
                <Badge key={script} variant="outline" className="rounded-none font-mono text-[9px]">
                  {script}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rendered markdown body */}
      <MarkdownRenderer content={body} mode="full" />
    </div>
  )
}

export default SkillDetailView
