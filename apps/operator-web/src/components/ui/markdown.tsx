import { TiptapEditor } from '@/components/ui/tiptap-editor'

interface MarkdownProps {
  content: string
  className?: string
  contentClassName?: string
}

export function Markdown({ content, className, contentClassName }: MarkdownProps) {
  return (
    <TiptapEditor
      content={content}
      editable={false}
      className={className}
      contentClassName={contentClassName}
    />
  )
}
