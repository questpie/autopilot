import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

interface TocItem {
  id: string
  text: string
  level: number
}

interface MarkdownTocProps {
  content: string
  className?: string
}

/**
 * Auto-generated table of contents from markdown headings.
 * Only rendered if there are more than 3 headings.
 */
export function MarkdownToc({ content, className }: MarkdownTocProps) {
  const { t } = useTranslation()

  const headings = useMemo(() => {
    const items: TocItem[] = []
    const lines = content.split("\n")

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].replace(/[*_`~]/g, "").trim()
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
        items.push({ id, text, level })
      }
    }

    return items
  }, [content])

  if (headings.length <= 3) return null

  return (
    <nav
      className={cn(
        "flex flex-col gap-1 border-l border-border pl-3",
        className,
      )}
      aria-label={t("a11y.table_of_contents")}
    >
      <p className="mb-1 font-heading text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {t("markdown.toc")}
      </p>
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          className={cn(
            "font-heading text-xs text-muted-foreground transition-colors hover:text-foreground",
            heading.level === 1 && "font-medium",
            heading.level >= 3 && "pl-3",
            heading.level >= 4 && "pl-6",
          )}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  )
}
