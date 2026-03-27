import { MarkdownRenderer } from "@/components/markdown-renderer"
import type { FileViewProps } from "@/lib/view-registry"

/**
 * Markdown file viewer — renders markdown with TOC.
 * Reuses the shared MarkdownRenderer from Phase 3.
 */
function MarkdownView({ content }: FileViewProps) {
  return (
    <div className="p-6">
      <MarkdownRenderer content={content} mode="full" />
    </div>
  )
}

export default MarkdownView
