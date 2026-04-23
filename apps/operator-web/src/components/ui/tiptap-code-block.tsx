import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import CodeBlock from '@tiptap/extension-code-block'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import type { ThemedToken } from 'shiki'
import { formatCodeLanguageLabel, highlightCodeTokens, resolveShikiTheme, type ShikiThemeName } from '@/lib/shiki'
import { cn } from '@/lib/utils'

const FONT_STYLE_ITALIC = 1
const FONT_STYLE_BOLD = 2
const FONT_STYLE_UNDERLINE = 4
const FONT_STYLE_STRIKETHROUGH = 8

function tokenStyle(token: ThemedToken) {
  return {
    ...(token.htmlStyle ?? {}),
    ...(token.color ? { color: token.color } : {}),
    ...(token.bgColor ? { backgroundColor: token.bgColor } : {}),
    ...(token.fontStyle && (token.fontStyle & FONT_STYLE_ITALIC) ? { fontStyle: 'italic' } : {}),
    ...(token.fontStyle && (token.fontStyle & FONT_STYLE_BOLD) ? { fontWeight: 700 } : {}),
    ...(token.fontStyle && (token.fontStyle & FONT_STYLE_UNDERLINE) ? { textDecoration: 'underline' } : {}),
    ...(token.fontStyle && (token.fontStyle & FONT_STYLE_STRIKETHROUGH) ? { textDecoration: 'line-through' } : {}),
  }
}

function useShikiTheme() {
  const [theme, setTheme] = useState<ShikiThemeName>(resolveShikiTheme)

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setTheme(resolveShikiTheme())
    })

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  return theme
}

function useCodeBlockActive({
  editor,
  getPos,
  nodeSize,
}: Pick<ReactNodeViewProps<HTMLDivElement>, 'editor' | 'getPos'> & { nodeSize: number }) {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    function syncActiveState() {
      let pos: number | null = null
      try {
        pos = typeof getPos === 'function' ? (getPos() ?? null) : null
      } catch {
        pos = null
      }

      if (typeof pos !== 'number' || !editor.isEditable || !editor.isFocused) {
        setIsActive(false)
        return
      }

      const { from, to } = editor.state.selection
      const start = pos + 1
      const end = pos + nodeSize - 1

      setIsActive(from >= start && to <= end)
    }

    syncActiveState()
    editor.on('selectionUpdate', syncActiveState)
    editor.on('focus', syncActiveState)
    editor.on('blur', syncActiveState)

    return () => {
      editor.off('selectionUpdate', syncActiveState)
      editor.off('focus', syncActiveState)
      editor.off('blur', syncActiveState)
    }
  }, [editor, getPos, nodeSize])

  return isActive
}

function renderHighlightedTokens(tokens: ThemedToken[][]) {
  return tokens.map((line, lineIndex) => (
    <span key={lineIndex}>
      {line.map((token, tokenIndex) => (
        <span key={`${lineIndex}-${tokenIndex}`} style={tokenStyle(token)}>
          {token.content}
        </span>
      ))}
      {lineIndex < tokens.length - 1 ? '\n' : null}
    </span>
  ))
}

function ShikiCodeBlockView(props: ReactNodeViewProps<HTMLDivElement>) {
  const { editor, getPos, node } = props
  const theme = useShikiTheme()
  const deferredCode = useDeferredValue(node.textContent ?? '')
  const isActive = useCodeBlockActive({
    editor,
    getPos,
    nodeSize: node.nodeSize,
  })
  const [tokens, setTokens] = useState<ThemedToken[][]>([])

  useEffect(() => {
    let cancelled = false

    void highlightCodeTokens(deferredCode, node.attrs.language, theme)
      .then((nextTokens) => {
        if (cancelled) return
        startTransition(() => {
          setTokens(nextTokens)
        })
      })
      .catch(() => {
        if (cancelled) return
        startTransition(() => {
          setTokens([[{ content: deferredCode, offset: 0 }]])
        })
      })

    return () => {
      cancelled = true
    }
  }, [deferredCode, node.attrs.language, theme])

  const languageLabel = useMemo(
    () => formatCodeLanguageLabel(node.attrs.language),
    [node.attrs.language],
  )
  const showOverlay = !editor.isEditable || !isActive

  return (
    <NodeViewWrapper className="tiptap-code-block not-prose my-5">
      <div
        contentEditable={false}
        className="mb-2 flex items-center justify-between gap-3"
      >
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {languageLabel}
        </span>
      </div>

      <pre className="relative overflow-x-auto rounded-md border border-border bg-surface-1">
        <div className="relative min-h-[56px] px-4 py-3">
          <code
            aria-hidden={editor.isEditable}
            className={cn(
              'pointer-events-none absolute inset-0 whitespace-pre px-4 py-3 font-mono text-[13px] leading-6',
              !editor.isEditable && 'pointer-events-auto select-text',
              showOverlay ? 'opacity-100' : 'opacity-0',
            )}
          >
            {renderHighlightedTokens(tokens)}
          </code>

          <NodeViewContent<'code'>
            as="code"
            spellCheck={false}
            className={cn(
              'relative block whitespace-pre font-mono text-[13px] leading-6 outline-none',
              showOverlay ? 'opacity-0' : 'opacity-100',
              editor.isEditable ? 'caret-foreground' : 'caret-transparent',
              '[&_*]:text-inherit',
            )}
            style={
              showOverlay
                ? {
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                  }
                : undefined
            }
          />
        </div>
      </pre>
    </NodeViewWrapper>
  )
}

export const ShikiCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ShikiCodeBlockView)
  },
})
