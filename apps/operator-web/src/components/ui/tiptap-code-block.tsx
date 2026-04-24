import {
	type ShikiThemeName,
	formatCodeLanguageLabel,
	highlightCodeTokens,
	resolveShikiTheme,
} from '@/lib/shiki'
import { cn } from '@/lib/utils'
import CodeBlock from '@tiptap/extension-code-block'
import {
	NodeViewContent,
	NodeViewWrapper,
	type ReactNodeViewProps,
	ReactNodeViewRenderer,
} from '@tiptap/react'
import {
	type ReactNode,
	startTransition,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from 'react'
import type { ThemedToken } from 'shiki'

const FONT_STYLE_ITALIC = 1
const FONT_STYLE_BOLD = 2
const FONT_STYLE_UNDERLINE = 4
const FONT_STYLE_STRIKETHROUGH = 8

function tokenStyle(token: ThemedToken) {
	return {
		...(token.htmlStyle ?? {}),
		...(token.color ? { color: token.color } : {}),
		...(token.bgColor ? { backgroundColor: token.bgColor } : {}),
		...(token.fontStyle && token.fontStyle & FONT_STYLE_ITALIC ? { fontStyle: 'italic' } : {}),
		...(token.fontStyle && token.fontStyle & FONT_STYLE_BOLD ? { fontWeight: 700 } : {}),
		...(token.fontStyle && token.fontStyle & FONT_STYLE_UNDERLINE
			? { textDecoration: 'underline' }
			: {}),
		...(token.fontStyle && token.fontStyle & FONT_STYLE_STRIKETHROUGH
			? { textDecoration: 'line-through' }
			: {}),
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

function renderHighlightedTokens(tokens: ThemedToken[][]) {
	const renderedLines: ReactNode[] = []
	let absoluteOffset = 0
	let remainingLines = tokens.length

	for (const line of tokens) {
		remainingLines -= 1

		const renderedTokens: ReactNode[] = []
		let tokenOffset = absoluteOffset
		let lineLength = 0

		for (const token of line) {
			renderedTokens.push(
				<span key={`token-${tokenOffset}`} style={tokenStyle(token)}>
					{token.content}
				</span>,
			)
			tokenOffset += token.content.length
			lineLength += token.content.length
		}

		renderedLines.push(
			<span key={`line-${absoluteOffset}`}>
				{renderedTokens}
				{remainingLines > 0 ? '\n' : null}
			</span>,
		)

		absoluteOffset += lineLength + (remainingLines > 0 ? 1 : 0)
	}

	return renderedLines
}

function ShikiCodeBlockView(props: ReactNodeViewProps<HTMLDivElement>) {
	const { editor, node } = props
	const theme = useShikiTheme()
	const code = node.textContent ?? ''
	const deferredCode = useDeferredValue(code)
	const [tokens, setTokens] = useState<ThemedToken[][]>([])
	const [highlightedCode, setHighlightedCode] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		void highlightCodeTokens(deferredCode, node.attrs.language, theme)
			.then((nextTokens) => {
				if (cancelled) return
				startTransition(() => {
					setTokens(nextTokens)
					setHighlightedCode(deferredCode)
				})
			})
			.catch(() => {
				if (cancelled) return
				startTransition(() => {
					setTokens([[{ content: deferredCode, offset: 0 }]])
					setHighlightedCode(deferredCode)
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
	const hasCurrentHighlight = highlightedCode === code

	return (
		<NodeViewWrapper className="tiptap-code-block not-prose my-5">
			<div contentEditable={false} className="mb-2 flex items-center justify-between gap-3">
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
							hasCurrentHighlight ? 'opacity-100' : 'opacity-0',
						)}
					>
						{renderHighlightedTokens(tokens)}
					</code>

					<NodeViewContent<'code'>
						as="code"
						spellCheck={false}
						className={cn(
							'relative block whitespace-pre font-mono text-[13px] leading-6 outline-none',
							hasCurrentHighlight ? 'text-transparent' : 'text-foreground',
							editor.isEditable ? 'caret-foreground' : 'caret-transparent',
							'[&_*]:text-inherit',
						)}
						style={hasCurrentHighlight ? { WebkitTextFillColor: 'transparent' } : undefined}
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
