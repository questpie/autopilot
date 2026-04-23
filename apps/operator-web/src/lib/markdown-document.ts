const FRONTMATTER_BLOCK_RE = /^(---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)\r?\n?)([\s\S]*)$/

export interface MarkdownDocumentParts {
  frontmatterBlock: string | null
  body: string
}

export function splitMarkdownDocument(content: string): MarkdownDocumentParts {
  const match = content.match(FRONTMATTER_BLOCK_RE)
  if (!match) {
    return {
      frontmatterBlock: null,
      body: content,
    }
  }

  return {
    frontmatterBlock: match[1] ?? null,
    body: match[2] ?? '',
  }
}

export function joinMarkdownDocument(parts: MarkdownDocumentParts): string {
  return parts.frontmatterBlock ? `${parts.frontmatterBlock}${parts.body}` : parts.body
}
