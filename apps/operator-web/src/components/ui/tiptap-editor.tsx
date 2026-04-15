import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import {
  TextB,
  TextItalic,
  Code,
  TextHOne,
  TextHTwo,
  TextHThree,
  ListBullets,
  ListNumbers,
  CodeBlock,
  Quotes,
  Minus,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface TiptapEditorProps {
  content: string
  onChange?: (markdown: string) => void
  editable?: boolean
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={cn(
        'size-7 flex items-center justify-center text-muted-foreground',
        'hover:bg-muted hover:text-foreground transition-colors',
        active && 'bg-muted text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function ToolbarSep() {
  return <div className="h-4 w-px bg-border mx-0.5" />
}

function TiptapToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 bg-muted/30 px-2 py-1 flex-wrap">
      <ToolbarButton
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      >
        <TextB size={14} weight="bold" />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      >
        <TextItalic size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
      >
        <Code size={14} />
      </ToolbarButton>

      <ToolbarSep />

      <ToolbarButton
        title="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
      >
        <TextHOne size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
      >
        <TextHTwo size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
      >
        <TextHThree size={14} />
      </ToolbarButton>

      <ToolbarSep />

      <ToolbarButton
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      >
        <ListBullets size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Ordered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      >
        <ListNumbers size={14} />
      </ToolbarButton>

      <ToolbarSep />

      <ToolbarButton
        title="Code block"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
      >
        <CodeBlock size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
      >
        <Quotes size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={14} />
      </ToolbarButton>
    </div>
  )
}

export function TiptapEditor({ content, onChange, editable = true }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      // tiptap-markdown stores getMarkdown on editor.storage.markdown
      const storage = ed.storage as unknown as { markdown: { getMarkdown(): string } }
      onChange?.(storage.markdown.getMarkdown())
    },
  })

  return (
    <div className="bg-muted/40 flex flex-col h-full">
      {editable && editor && <TiptapToolbar editor={editor} />}
      <div className="flex-1 overflow-auto">
        <EditorContent
          editor={editor}
          className={cn(
            // prose base — mirrors markdown.tsx token mapping
            '[&_.ProseMirror]:prose [&_.ProseMirror]:prose-sm [&_.ProseMirror]:max-w-none',
            '[&_.ProseMirror]:p-4 [&_.ProseMirror]:font-sans [&_.ProseMirror]:text-sm',
            '[&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none',
            // heading colors
            '[&_.ProseMirror_h1]:text-foreground [&_.ProseMirror_h1]:font-medium',
            '[&_.ProseMirror_h2]:text-foreground [&_.ProseMirror_h2]:font-medium',
            '[&_.ProseMirror_h3]:text-foreground [&_.ProseMirror_h3]:font-medium',
            '[&_.ProseMirror_h4]:text-foreground [&_.ProseMirror_h4]:font-medium',
            '[&_.ProseMirror_h5]:text-foreground [&_.ProseMirror_h5]:font-medium',
            '[&_.ProseMirror_h6]:text-foreground [&_.ProseMirror_h6]:font-medium',
            // paragraph / text
            '[&_.ProseMirror_p]:text-foreground [&_.ProseMirror_p]:leading-relaxed',
            // links
            '[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:no-underline hover:[&_.ProseMirror_a]:underline',
            // inline code
            '[&_.ProseMirror_code]:text-foreground [&_.ProseMirror_code]:bg-[--surface-3] [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-[13px]',
            // code blocks
            '[&_.ProseMirror_pre]:bg-[--surface-1] [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:border-border [&_.ProseMirror_pre]:overflow-x-auto',
            // blockquote
            '[&_.ProseMirror_blockquote]:border-l-primary [&_.ProseMirror_blockquote]:text-muted-foreground',
            // lists
            '[&_.ProseMirror_li]:text-foreground',
            '[&_.ProseMirror_ul]:text-foreground [&_.ProseMirror_ol]:text-foreground',
            // hr
            '[&_.ProseMirror_hr]:border-border',
            // strong / em
            '[&_.ProseMirror_strong]:text-foreground [&_.ProseMirror_strong]:font-semibold',
            '[&_.ProseMirror_em]:text-foreground',
          )}
        />
      </div>
    </div>
  )
}
