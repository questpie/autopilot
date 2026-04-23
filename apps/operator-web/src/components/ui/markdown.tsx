import { Children, cloneElement, isValidElement, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { SmartText } from '@/lib/smart-links'

interface MarkdownProps {
  content: string
  className?: string
}

function linkifyNode(node: ReactNode): ReactNode {
  if (typeof node === 'string') {
    return <SmartText text={node} />
  }

  if (!isValidElement(node)) {
    return node
  }

  if (typeof node.type === 'string' && (node.type === 'a' || node.type === 'code' || node.type === 'pre')) {
    return node
  }

  const element = node as ReactElement<{ children?: ReactNode }>
  return cloneElement(element, undefined, linkifyChildren(element.props.children))
}

function linkifyChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => linkifyNode(child))
}

function LinkifiedParagraph({ children, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p {...props}>{linkifyChildren(children)}</p>
}

function LinkifiedListItem({ children, ...props }: ComponentPropsWithoutRef<'li'>) {
  return <li {...props}>{linkifyChildren(children)}</li>
}

function LinkifiedBlockquote({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) {
  return <blockquote {...props}>{linkifyChildren(children)}</blockquote>
}

function LinkifiedHeading1({ children, ...props }: ComponentPropsWithoutRef<'h1'>) {
  return <h1 {...props}>{linkifyChildren(children)}</h1>
}

function LinkifiedHeading2({ children, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return <h2 {...props}>{linkifyChildren(children)}</h2>
}

function LinkifiedHeading3({ children, ...props }: ComponentPropsWithoutRef<'h3'>) {
  return <h3 {...props}>{linkifyChildren(children)}</h3>
}

function LinkifiedHeading4({ children, ...props }: ComponentPropsWithoutRef<'h4'>) {
  return <h4 {...props}>{linkifyChildren(children)}</h4>
}

function LinkifiedHeading5({ children, ...props }: ComponentPropsWithoutRef<'h5'>) {
  return <h5 {...props}>{linkifyChildren(children)}</h5>
}

function LinkifiedHeading6({ children, ...props }: ComponentPropsWithoutRef<'h6'>) {
  return <h6 {...props}>{linkifyChildren(children)}</h6>
}

function LinkifiedTableCell({ children, ...props }: ComponentPropsWithoutRef<'td'>) {
  return <td {...props}>{linkifyChildren(children)}</td>
}

function LinkifiedTableHeader({ children, ...props }: ComponentPropsWithoutRef<'th'>) {
  return <th {...props}>{linkifyChildren(children)}</th>
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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: LinkifiedParagraph,
          li: LinkifiedListItem,
          blockquote: LinkifiedBlockquote,
          h1: LinkifiedHeading1,
          h2: LinkifiedHeading2,
          h3: LinkifiedHeading3,
          h4: LinkifiedHeading4,
          h5: LinkifiedHeading5,
          h6: LinkifiedHeading6,
          td: LinkifiedTableCell,
          th: LinkifiedTableHeader,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
