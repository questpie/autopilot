import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkBreaks from "remark-breaks"
import rehypeHighlight from "rehype-highlight"
import rehypeSlug from "rehype-slug"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import { remarkResourceLinks } from "@/lib/remark-resource-links"

export type MarkdownMode = "full" | "inline"

export const MAX_COLLAPSED_LINES = 20
export const COLLAPSED_SHOW_LINES = 10

export function getRemarkPlugins(mode: MarkdownMode) {
  return [
    remarkGfm,
    remarkMath,
    ...(mode === "inline" ? [remarkBreaks] : []),
    remarkResourceLinks,
  ]
}

export function getRehypePlugins(mode: MarkdownMode) {
  return [
    rehypeHighlight,
    ...(mode === "full"
      ? [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }] as [typeof rehypeAutolinkHeadings, { behavior: string }]]
      : []),
  ]
}
