import { ShikiCodeBlock } from '@/components/ui/tiptap-code-block'
import { parseSmartSegments } from '@/lib/smart-links'
import { cn } from '@/lib/utils'
import {
	CodeBlock,
	ListBullets,
	ListNumbers,
	Minus,
	Quotes,
	TextHOne,
	TextHThree,
	TextHTwo,
} from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'
import { TableKit } from '@tiptap/extension-table'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { type MouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Markdown } from 'tiptap-markdown'

interface TiptapEditorProps {
	content: string
	onChange?: (markdown: string) => void
	editable?: boolean
	className?: string
	contentClassName?: string
}

interface TiptapMarkdownStorage {
	markdown: {
		getMarkdown(): string
	}
}

interface SlashMenuState {
	query: string
	from: number
	to: number
	x: number
	y: number
	activeIndex: number
}

interface SlashCommandDef {
	id: string
	label: string
	description: string
	icon: ReactNode
	matches: string[]
	run: (editor: Editor, range: { from: number; to: number }) => void
}

const TIPTAP_CONTENT_CLASSNAME = cn(
	'[&_.ProseMirror]:prose [&_.ProseMirror]:prose-sm [&_.ProseMirror]:max-w-none',
	'[&_.ProseMirror]:min-h-full',
	'[&_.ProseMirror]:font-sans [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-[22px] [&_.ProseMirror]:text-foreground',
	'[&_.ProseMirror]:outline-none [&_.ProseMirror]:break-words',
	'[&_.ProseMirror>*+*]:mt-4',
	'[&_.ProseMirror_h1]:mt-8 [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:text-balance [&_.ProseMirror_h1]:text-[28px] [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h1]:tracking-[-0.02em] [&_.ProseMirror_h1]:text-foreground',
	'[&_.ProseMirror_h2]:mt-7 [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:text-balance [&_.ProseMirror_h2]:text-[22px] [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:tracking-[-0.02em] [&_.ProseMirror_h2]:text-foreground',
	'[&_.ProseMirror_h3]:mt-6 [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:text-balance [&_.ProseMirror_h3]:text-[18px] [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-foreground',
	'[&_.ProseMirror_p]:my-0 [&_.ProseMirror_p]:text-pretty [&_.ProseMirror_p]:text-foreground',
	'[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:no-underline hover:[&_.ProseMirror_a]:underline',
	'[&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_strong]:text-foreground',
	'[&_.ProseMirror_em]:text-foreground',
	'[&_.ProseMirror_code]:rounded-sm [&_.ProseMirror_code]:bg-surface-3 [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-[13px] [&_.ProseMirror_code]:text-foreground',
	'[&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:border-border [&_.ProseMirror_pre]:bg-surface-1 [&_.ProseMirror_pre]:px-4 [&_.ProseMirror_pre]:py-3',
	'[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0',
	'[&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-l-primary [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-foreground-muted',
	'[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:text-foreground',
	'[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:text-foreground',
	'[&_.ProseMirror_li]:my-1',
	'[&_.ProseMirror_hr]:my-6 [&_.ProseMirror_hr]:border-border',
	'[&_.ProseMirror_table]:my-5 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:font-sans',
	'[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:bg-surface-2 [&_.ProseMirror_th]:px-3 [&_.ProseMirror_th]:py-2 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:font-medium [&_.ProseMirror_th]:text-foreground',
	'[&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:px-3 [&_.ProseMirror_td]:py-2 [&_.ProseMirror_td]:align-top [&_.ProseMirror_td]:text-foreground',
	'[&_.smart-ref]:cursor-pointer [&_.smart-ref]:font-mono [&_.smart-ref]:text-[12px] [&_.smart-ref]:font-medium [&_.smart-ref]:text-primary',
	'selection:bg-primary/18',
)

const SLASH_COMMANDS: SlashCommandDef[] = [
	{
		id: 'heading-1',
		label: 'Heading 1',
		description: 'Large page heading',
		icon: <TextHOne size={14} />,
		matches: ['h1', 'heading', 'title'],
		run: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run()
		},
	},
	{
		id: 'heading-2',
		label: 'Heading 2',
		description: 'Section heading',
		icon: <TextHTwo size={14} />,
		matches: ['h2', 'heading', 'section'],
		run: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run()
		},
	},
	{
		id: 'heading-3',
		label: 'Heading 3',
		description: 'Subsection heading',
		icon: <TextHThree size={14} />,
		matches: ['h3', 'heading', 'subsection'],
		run: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run()
		},
	},
	{
		id: 'bullet-list',
		label: 'Bullet List',
		description: 'List with bullets',
		icon: <ListBullets size={14} />,
		matches: ['bullet', 'list', 'ul'],
		run: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run()
		},
	},
	{
		id: 'ordered-list',
		label: 'Numbered List',
		description: 'List with ordered steps',
		icon: <ListNumbers size={14} />,
		matches: ['ordered', 'numbered', 'list', 'ol'],
		run: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run()
		},
	},
	{
		id: 'blockquote',
		label: 'Quote',
		description: 'Call out quoted text',
		icon: <Quotes size={14} />,
		matches: ['quote', 'blockquote', 'callout'],
		run: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBlockquote().run()
		},
	},
	{
		id: 'code-block',
		label: 'Code Block',
		description: 'Insert fenced code',
		icon: <CodeBlock size={14} />,
		matches: ['code', 'snippet', 'pre'],
		run: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
		},
	},
	{
		id: 'divider',
		label: 'Divider',
		description: 'Insert horizontal rule',
		icon: <Minus size={14} />,
		matches: ['divider', 'rule', 'hr'],
		run: (editor, range) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run()
		},
	},
]

function getMarkdown(editor: Editor): string {
	const storage = editor.storage as unknown as TiptapMarkdownStorage
	return storage.markdown.getMarkdown()
}

function getFilteredSlashCommands(query: string): SlashCommandDef[] {
	const normalized = query.trim().toLowerCase()
	if (!normalized) return SLASH_COMMANDS

	return SLASH_COMMANDS.filter((command) =>
		[command.label, command.description, ...command.matches].some((value) =>
			value.toLowerCase().includes(normalized),
		),
	)
}

function buildSmartDecorations(doc: ProseMirrorNode) {
	const decorations: Decoration[] = []

	doc.descendants((node, pos, parent) => {
		if (!node.isText || !node.text) return
		if (parent?.type.name === 'codeBlock' || parent?.type.spec.code) return

		const segments = parseSmartSegments(node.text)
		let offset = 0

		for (const segment of segments) {
			const start = offset
			const end = start + segment.text.length

			if (segment.link) {
				decorations.push(
					Decoration.inline(pos + start, pos + end, {
						class: 'smart-ref',
						'data-smart-link-type': segment.link.type,
						'data-smart-link-value': segment.link.value,
					}),
				)
			}

			offset = end
		}
	})

	return DecorationSet.create(doc, decorations)
}

function resolveSlashMenuState(
	editor: Editor,
	view: EditorView | null,
): Omit<SlashMenuState, 'activeIndex'> | null {
	if (!view) return null

	const { selection } = editor.state
	if (!selection.empty) return null

	const parent = selection.$from.parent
	if (!parent.isTextblock) return null
	if (parent.type.name === 'codeBlock' || parent.type.spec.code) return null

	const beforeCursor = parent.textContent.slice(0, selection.$from.parentOffset)
	const match = beforeCursor.match(/^\/([\w-]*)$/)
	if (!match) return null

	const commands = getFilteredSlashCommands(match[1] ?? '')
	if (commands.length === 0) return null

	const container = view.dom.parentElement
	if (!container) return null

	const containerRect = container.getBoundingClientRect()
	const coords = view.coordsAtPos(selection.from)

	return {
		query: match[1] ?? '',
		from: selection.$from.start(),
		to: selection.from,
		x: coords.left - containerRect.left + container.scrollLeft,
		y: coords.bottom - containerRect.top + container.scrollTop + 8,
	}
}

function navigateToSmartLink(
	navigate: ReturnType<typeof useNavigate>,
	type: string,
	value: string,
) {
	if (type === 'task' || type === 'run') {
		void navigate({ to: '/tasks', search: { taskId: value } })
		return
	}

	if (type === 'session') {
		void navigate({ to: '/chat', search: { sessionId: value } })
		return
	}

	if (type === 'file') {
		void navigate({ to: '/files', search: { path: value, view: 'file' } })
	}
}

export function TiptapEditor({
	content,
	onChange,
	editable = true,
	className,
	contentClassName,
}: TiptapEditorProps) {
	const navigate = useNavigate()
	const editorRef = useRef<Editor | null>(null)
	const slashMenuRef = useRef<SlashMenuState | null>(null)
	const editableRef = useRef(editable)
	const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)

	editableRef.current = editable

	const syncSlashMenu = useCallback((editor: Editor | null) => {
		if (!editableRef.current || !editor) {
			setSlashMenu(null)
			return
		}

		const nextState = resolveSlashMenuState(editor, editor.view)
		if (!nextState) {
			setSlashMenu(null)
			return
		}

		setSlashMenu((current) => {
			const commands = getFilteredSlashCommands(nextState.query)
			if (commands.length === 0) return null

			return {
				...nextState,
				activeIndex:
					current && current.query === nextState.query
						? Math.min(current.activeIndex, commands.length - 1)
						: 0,
			}
		})
	}, [])

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				codeBlock: false,
			}),
			ShikiCodeBlock,
			TableKit.configure({
				table: {
					resizable: false,
					renderWrapper: false,
				},
			}),
			Markdown.configure({
				html: false,
				linkify: true,
				tightLists: true,
				transformPastedText: true,
				transformCopiedText: false,
			}),
		],
		content,
		editable,
		onCreate: ({ editor: createdEditor }) => {
			editorRef.current = createdEditor
			syncSlashMenu(createdEditor)
		},
		onUpdate: ({ editor: currentEditor }) => {
			syncSlashMenu(currentEditor)
			onChange?.(getMarkdown(currentEditor))
		},
		onSelectionUpdate: ({ editor: currentEditor }) => {
			syncSlashMenu(currentEditor)
		},
		onBlur: () => {
			setSlashMenu(null)
		},
		editorProps: {
			handleKeyDown: (_view, event) => {
				const currentEditor = editorRef.current
				const currentMenu = slashMenuRef.current
				if (!editableRef.current || !currentEditor || !currentMenu) return false

				const commands = getFilteredSlashCommands(currentMenu.query)
				if (commands.length === 0) return false

				if (event.key === 'ArrowDown') {
					event.preventDefault()
					setSlashMenu((state) =>
						state
							? {
									...state,
									activeIndex: (state.activeIndex + 1) % commands.length,
								}
							: state,
					)
					return true
				}

				if (event.key === 'ArrowUp') {
					event.preventDefault()
					setSlashMenu((state) =>
						state
							? {
									...state,
									activeIndex: (state.activeIndex - 1 + commands.length) % commands.length,
								}
							: state,
					)
					return true
				}

				if (event.key === 'Escape') {
					event.preventDefault()
					setSlashMenu(null)
					return true
				}

				if (event.key === 'Enter' || event.key === 'Tab') {
					const command = commands[currentMenu.activeIndex] ?? commands[0]
					if (!command) return false

					event.preventDefault()
					command.run(currentEditor, { from: currentMenu.from, to: currentMenu.to })
					setSlashMenu(null)
					return true
				}

				return false
			},
			decorations: (state) => buildSmartDecorations(state.doc),
		},
	})

	useEffect(() => {
		editorRef.current = editor ?? null
	}, [editor])

	useEffect(() => {
		slashMenuRef.current = slashMenu
	}, [slashMenu])

	useEffect(() => {
		if (!editor) return
		editor.setEditable(editable)
		syncSlashMenu(editor)
	}, [editor, editable, syncSlashMenu])

	useEffect(() => {
		if (!editor) return

		const currentMarkdown = getMarkdown(editor)
		if (currentMarkdown === content) return

		editor.commands.setContent(content, { emitUpdate: false })
		syncSlashMenu(editor)
	}, [content, editor, syncSlashMenu])

	const filteredCommands = slashMenu ? getFilteredSlashCommands(slashMenu.query) : []

	const handleSlashCommandSelect = useCallback((index: number) => {
		const currentEditor = editorRef.current
		const currentMenu = slashMenuRef.current
		if (!currentEditor || !currentMenu) return

		const commands = getFilteredSlashCommands(currentMenu.query)
		const command = commands[index]
		if (!command) return

		command.run(currentEditor, { from: currentMenu.from, to: currentMenu.to })
		setSlashMenu(null)
	}, [])

	const handleClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (editable) return

			const target = event.target
			if (!(target instanceof HTMLElement)) return

			const smartLink = target.closest<HTMLElement>('[data-smart-link-type][data-smart-link-value]')
			if (!smartLink) return

			const type = smartLink.dataset.smartLinkType
			const value = smartLink.dataset.smartLinkValue
			if (!type || !value) return

			event.preventDefault()
			event.stopPropagation()
			navigateToSmartLink(navigate, type, value)
		},
		[editable, navigate],
	)

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Smart links are rendered inside ProseMirror content and delegated here.
		<div className={cn('relative w-full', className)} onClick={handleClick}>
			<EditorContent editor={editor} className={cn(TIPTAP_CONTENT_CLASSNAME, contentClassName)} />

			{editable && slashMenu && filteredCommands.length > 0 ? (
				<div
					className="absolute z-20 w-[320px] max-w-[calc(100%-24px)] overflow-hidden rounded-md border border-border bg-surface-2"
					style={{ left: slashMenu.x, top: slashMenu.y }}
				>
					<div className="border-b border-border px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
						Insert Block
					</div>

					<div className="p-1">
						{filteredCommands.map((command, index) => (
							<button
								key={command.id}
								type="button"
								onMouseDown={(event) => {
									event.preventDefault()
									handleSlashCommandSelect(index)
								}}
								className={cn(
									'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors',
									index === slashMenu.activeIndex
										? 'bg-surface-3 text-foreground'
										: 'text-muted-foreground hover:bg-surface-3 hover:text-foreground',
								)}
							>
								<span className="shrink-0 text-muted-foreground">{command.icon}</span>
								<span className="min-w-0 flex-1">
									<span className="block text-sm font-medium text-foreground">{command.label}</span>
									<span className="block truncate text-xs text-muted-foreground">
										{command.description}
									</span>
								</span>
							</button>
						))}
					</div>
				</div>
			) : null}
		</div>
	)
}
