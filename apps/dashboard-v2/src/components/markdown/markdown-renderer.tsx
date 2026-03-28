import { useMemo } from "react"
import Markdown from "react-markdown"
import { MarkdownToc } from "../markdown-toc"
import { cn } from "@/lib/utils"
import { getRemarkPlugins, getRehypePlugins } from "./markdown-config"
import { useMarkdownComponents } from "./use-markdown-components"
import type { MarkdownMode } from "./markdown-config"

interface MarkdownRendererProps {
  content: string
  mode?: MarkdownMode
  className?: string
}

/**
 * Markdown renderer with two modes:
 * - "full": document mode with TOC, line numbers, heading anchors
 * - "inline": compact mode for chat, comments, pins
 */
export function MarkdownRenderer({
  content,
  mode = "full",
  className,
}: MarkdownRendererProps) {
  const remarkPlugins = useMemo(() => getRemarkPlugins(mode), [mode])
  const rehypePlugins = useMemo(() => getRehypePlugins(mode), [mode])
  const components = useMarkdownComponents(mode)

  return (
    <div className={cn("flex gap-8", mode === "full" && "items-start")}>
      {/* Main content */}
      <div
        className={cn(
          "min-w-0 flex-1",
          mode === "full"
            ? "max-w-[720px] font-sans text-sm leading-[1.65]"
            : "font-sans text-sm leading-normal",
          className,
        )}
      >
        <Markdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {content}
        </Markdown>
      </div>

      {/* TOC sidebar (full mode, desktop only) */}
      {mode === "full" && (
        <div className="hidden shrink-0 lg:block lg:w-48 xl:w-56">
          <div className="sticky top-6">
            <MarkdownToc content={content} />
          </div>
        </div>
      )}
    </div>
  )
}
