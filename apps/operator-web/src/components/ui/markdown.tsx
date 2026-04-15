import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        // Base prose
        'prose prose-sm max-w-none break-words',
        // Dark theme overrides — uses design token colors
        'prose-headings:text-foreground prose-headings:font-medium',
        'prose-p:text-foreground prose-p:leading-relaxed',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-strong:text-foreground prose-strong:font-semibold',
        'prose-em:text-foreground',
        'prose-code:text-foreground prose-code:bg-surface-3 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-surface-1 prose-pre:border prose-pre:border-border prose-pre:rounded-md',
        'prose-pre:overflow-x-auto',
        'prose-blockquote:border-l-primary prose-blockquote:text-foreground-muted',
        'prose-li:text-foreground',
        'prose-hr:border-border',
        'prose-th:text-foreground prose-td:text-foreground',
        'prose-img:rounded-md',
        // Lists
        'prose-ul:text-foreground prose-ol:text-foreground',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
