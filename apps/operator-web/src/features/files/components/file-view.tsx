import { knowledgeContentUrl, knowledgeWrite } from '@/api/knowledge.api'
import { vfsWrite } from '@/api/vfs.api'
import { Button } from '@/components/ui/button'
import { InspectorHeader } from '@/components/ui/inspector-layout'
import { Spinner } from '@/components/ui/spinner'
import { surfaceCardVariants } from '@/components/ui/surface-card'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { filesSourceKeys, useFilesRead } from '@/hooks/use-files-source'
import { joinMarkdownDocument, splitMarkdownDocument } from '@/lib/markdown-document'
import { cn } from '@/lib/utils'
import { resolveViewer } from '@/lib/viewer-registry'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useQueryClient } from '@tanstack/react-query'
import type * as Monaco from 'monaco-editor'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { buildContentUrl, buildWorkspaceUri, formatBytes } from '../lib/file-paths'
import { FilePreviewSurface } from './file-preview-surface'
import { FileTreeSidebar } from './file-tree-sidebar'

interface FileViewProps {
	path: string
	runId: string | null
	projectId: string | null
	onBack: (parentPath: string | null) => void
	onOpenFile: (path: string) => void
}

interface MarkdownHeading {
	depth: number
	text: string
	index: number
}

/** Map file extension to a Monaco language identifier. */
function resolveMonacoLanguage(path: string): string {
	const lastDot = path.lastIndexOf('.')
	const lastSlash = path.lastIndexOf('/')
	const ext = lastDot === -1 || lastDot < lastSlash ? '' : path.slice(lastDot + 1).toLowerCase()

	const MAP: Record<string, string> = {
		ts: 'typescript',
		tsx: 'typescript',
		js: 'javascript',
		jsx: 'javascript',
		mjs: 'javascript',
		cjs: 'javascript',
		json: 'json',
		css: 'css',
		scss: 'scss',
		less: 'less',
		html: 'html',
		htm: 'html',
		xml: 'xml',
		md: 'markdown',
		py: 'python',
		rb: 'ruby',
		go: 'go',
		rs: 'rust',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		h: 'cpp',
		sql: 'sql',
		graphql: 'graphql',
		sh: 'shell',
		bash: 'shell',
		zsh: 'shell',
		yaml: 'yaml',
		yml: 'yaml',
		toml: 'ini',
		ini: 'ini',
		dockerfile: 'dockerfile',
	}
	return MAP[ext] ?? 'plaintext'
}

interface MonacoEditorViewProps {
	path: string
	value: string
	readOnly: boolean
	onEditorMount: OnMount
}

function MonacoEditorView({ path, value, readOnly, onEditorMount }: MonacoEditorViewProps) {
	const language = resolveMonacoLanguage(path)

	return (
		<div className="h-full w-full overflow-hidden">
			<Editor
				height="100%"
				language={language}
				value={value}
				theme="vs-dark"
				onMount={onEditorMount}
				options={{
					readOnly,
					minimap: { enabled: false },
					fontSize: 13,
					fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
					lineNumbers: 'on' as const,
					scrollBeyondLastLine: false,
					padding: { top: 12 },
					renderLineHighlight: readOnly ? 'none' : 'line',
					selectionHighlight: !readOnly,
					occurrencesHighlight: readOnly ? 'off' : 'singleFile',
					contextmenu: !readOnly,
					folding: true,
					wordWrap: 'off',
					automaticLayout: true,
				}}
			/>
		</div>
	)
}

function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
	const headings: MarkdownHeading[] = []
	for (const line of markdown.split('\n')) {
		const match = /^(#{1,3})\s+(.+)$/.exec(line.trim())
		if (!match) continue
		headings.push({
			depth: match[1].length,
			text: match[2].replace(/\s+#+$/, '').trim(),
			index: headings.length,
		})
	}
	return headings
}

function FloatingMarkdownToc({
	headings,
	containerRef,
}: {
	headings: MarkdownHeading[]
	containerRef: RefObject<HTMLDivElement | null>
}) {
	if (headings.length === 0) return null

	return (
		<div className="absolute right-4 top-4 z-10 hidden max-h-[60vh] w-56 overflow-y-auto rounded-lg border border-border bg-background/90 p-2 backdrop-blur lg:block">
			<p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
				Outline
			</p>
			{headings.map((heading) => (
				<button
					key={`${heading.index}-${heading.text}`}
					type="button"
					className="block min-h-9 w-full truncate rounded-md px-2 py-1 text-left text-xs text-muted-foreground transition-[background-color,color,transform] hover:bg-muted/50 hover:text-foreground active:scale-[0.96]"
					style={{ paddingLeft: 8 + (heading.depth - 1) * 10 }}
					onClick={() => {
						const headingsInDom = containerRef.current?.querySelectorAll('h1,h2,h3')
						headingsInDom?.[heading.index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
					}}
				>
					{heading.text}
				</button>
			))}
		</div>
	)
}

export function FileView({ path, runId, projectId, onBack, onOpenFile }: FileViewProps) {
	const contentUrl = runId
		? buildContentUrl(buildWorkspaceUri(runId, path))
		: knowledgeContentUrl(path, { projectId })
	const { data, isLoading, error } = useFilesRead(runId, path, projectId)
	const queryClient = useQueryClient()
	const viewer = data ? resolveViewer(path, data.contentType) : null
	const markdownDocument =
		viewer?.type === 'markdown' && data?.content ? splitMarkdownDocument(data.content) : null

	const [editMode, setEditMode] = useState(false)
	const [saving, setSaving] = useState(false)
	const [markdownDraft, setMarkdownDraft] = useState('')
	const [markdownSource, setMarkdownSource] = useState<{ uri: string; body: string } | null>(null)
	const [markdownDirty, setMarkdownDirty] = useState(false)
	const markdownScrollRef = useRef<HTMLDivElement | null>(null)

	// Monaco editor ref — used for code/structured/plain files
	const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

	// Tiptap-managed markdown content — only used when viewer.type === 'markdown'
	const tiptapContentRef = useRef<string>('')

	const handleEditorMount: OnMount = useCallback((editor) => {
		editorRef.current = editor
	}, [])

	useEffect(() => {
		if (viewer?.type !== 'markdown') return

		const nextContent = markdownDocument?.body ?? ''
		tiptapContentRef.current = nextContent
		setMarkdownDraft(nextContent)
		setMarkdownSource({ uri: contentUrl, body: nextContent })
		setMarkdownDirty(false)
	}, [viewer?.type, markdownDocument?.body, contentUrl])

	const handleEdit = useCallback(() => {
		if (viewer?.type === 'markdown') return
		if (data) {
			tiptapContentRef.current = data.content ?? ''
		}
		setEditMode(true)
	}, [data, viewer?.type])

	const handleCancel = useCallback(() => {
		if (viewer?.type === 'markdown') {
			const nextContent = markdownDocument?.body ?? ''
			tiptapContentRef.current = nextContent
			setMarkdownDraft(nextContent)
			setMarkdownSource({ uri: contentUrl, body: nextContent })
			setMarkdownDirty(false)
			return
		}
		// Reset Monaco editor content to the last saved value (code files)
		if (editorRef.current && data) {
			editorRef.current.setValue(data.content ?? '')
		}
		setEditMode(false)
	}, [data, markdownDocument?.body, contentUrl, viewer?.type])

	const handleSave = useCallback(async () => {
		const content =
			viewer?.type === 'markdown'
				? joinMarkdownDocument({
						frontmatterBlock: markdownDocument?.frontmatterBlock ?? null,
						body: tiptapContentRef.current,
					})
				: (editorRef.current?.getValue() ?? '')
		setSaving(true)
		try {
			if (runId) {
				await vfsWrite(buildWorkspaceUri(runId, path), content)
			} else {
				await knowledgeWrite(path, content, data?.contentType, { projectId })
			}
			await queryClient.invalidateQueries({
				queryKey: filesSourceKeys.read(runId, path, projectId),
			})
			await queryClient.invalidateQueries({
				queryKey: filesSourceKeys.stat(runId, path, projectId),
			})
			if (viewer?.type === 'markdown') {
				setMarkdownDirty(false)
			} else {
				setEditMode(false)
			}
		} finally {
			setSaving(false)
		}
	}, [
		runId,
		projectId,
		path,
		data?.contentType,
		queryClient,
		viewer?.type,
		markdownDocument?.frontmatterBlock,
	])

	// Knowledge documents are writable; run workspaces remain read-only.
	const canEdit = runId === null

	const isEditable =
		viewer &&
		(viewer.type === 'code' ||
			viewer.type === 'structured' ||
			viewer.type === 'plain' ||
			viewer.type === 'markdown')
	const headerTitle = runId ? `Run workspace / ${path}` : `Knowledge / ${path}`

	const toolbar =
		canEdit && isEditable && data && !isLoading && !error ? (
			viewer?.type === 'markdown' ? (
				<div className="flex items-center gap-2">
					{markdownDirty ? (
						<>
							<Button variant="ghost" size="xs" onClick={handleCancel} disabled={saving}>
								Cancel
							</Button>
							<Button
								variant="default"
								size="xs"
								onClick={() => void handleSave()}
								loading={saving}
							>
								Save
							</Button>
						</>
					) : (
						<span className="font-mono text-[11px] text-muted-foreground">slash blocks</span>
					)}
				</div>
			) : (
				<div className="flex items-center gap-1">
					{editMode ? (
						<>
							<Button variant="ghost" size="xs" onClick={handleCancel} disabled={saving}>
								Cancel
							</Button>
							<Button
								variant="default"
								size="xs"
								onClick={() => void handleSave()}
								loading={saving}
							>
								Save
							</Button>
						</>
					) : (
						<Button variant="outline" size="xs" onClick={handleEdit}>
							Edit
						</Button>
					)}
				</div>
			)
		) : null

	const content = (
		<div className="relative h-full min-h-0">
			{isLoading && (
				<div className="flex h-full items-center justify-center">
					<Spinner size="lg" className="text-muted-foreground" />
				</div>
			)}

			{error && (
				<div className="flex h-full items-center justify-center">
					<div className="text-center">
						<p className="text-sm font-medium text-muted-foreground">Failed to load file.</p>
						<p className="mt-1 break-all text-xs text-muted-foreground">{path}</p>
					</div>
				</div>
			)}

			{!isLoading &&
				!error &&
				data &&
				(() => {
					if (!viewer) return null

					if (viewer.type === 'markdown') {
						const savedMarkdownBody = markdownDocument?.body ?? ''
						const headings = extractMarkdownHeadings(savedMarkdownBody)
						const editorContent =
							markdownSource?.uri === contentUrl && markdownSource.body === savedMarkdownBody
								? markdownDraft
								: savedMarkdownBody

						return (
							<div ref={markdownScrollRef} className="relative h-full overflow-auto">
								<FloatingMarkdownToc headings={headings} containerRef={markdownScrollRef} />
								{markdownDocument?.frontmatterBlock ? (
									<div className="border-b border-border px-6 py-4">
										<pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-1 px-4 py-3 font-mono text-xs leading-5 text-muted-foreground">
											{markdownDocument.frontmatterBlock.trimEnd()}
										</pre>
									</div>
								) : null}
								<TiptapEditor
									content={editorContent}
									editable={canEdit}
									className="h-full"
									contentClassName="[&_.ProseMirror]:mx-auto [&_.ProseMirror]:max-w-3xl [&_.ProseMirror]:px-6 [&_.ProseMirror]:py-8"
									onChange={(md) => {
										tiptapContentRef.current = md
										setMarkdownDraft(md)
										setMarkdownSource({ uri: contentUrl, body: savedMarkdownBody })
										setMarkdownDirty(md !== savedMarkdownBody)
									}}
								/>
							</div>
						)
					}

					if (
						viewer.type === 'image' ||
						viewer.type === 'pdf' ||
						viewer.type === 'video' ||
						viewer.type === 'docx'
					) {
						return (
							<FilePreviewSurface
								path={path}
								contentUrl={contentUrl}
								viewerType={viewer.type}
								data={data}
								variant="full"
							/>
						)
					}

					if (
						data.isText &&
						(viewer.type === 'code' || viewer.type === 'structured' || viewer.type === 'plain')
					) {
						return (
							<div className="h-full p-4">
								<MonacoEditorView
									path={path}
									value={data.content ?? ''}
									readOnly={!editMode}
									onEditorMount={handleEditorMount}
								/>
							</div>
						)
					}

					return (
						<div className={cn(surfaceCardVariants({ size: 'md' }), 'm-4')}>
							<p className="text-sm text-muted-foreground">
								Preview not available for this file type.
							</p>
							<div className="mt-3 space-y-1">
								<p className="text-sm text-muted-foreground">
									<span className="text-foreground">Path:</span> {path}
								</p>
								<p className="text-sm text-muted-foreground tabular-nums">
									<span className="text-foreground">Size:</span> {formatBytes(data.size)}
								</p>
								<p className="text-sm text-muted-foreground">
									<span className="text-foreground">Type:</span> {data.contentType}
								</p>
							</div>
						</div>
					)
				})()}
		</div>
	)

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden">
			<div className="shrink-0 px-4 py-2.5">
				<InspectorHeader
					onBack={() => onBack(null)}
					title={headerTitle}
					actions={toolbar ? [{ type: 'custom', id: 'file-toolbar', render: toolbar }] : []}
				/>
			</div>

			<div className="flex min-h-0 flex-1 overflow-hidden">
				<aside className="hidden w-64 shrink-0 border-r border-border lg:block">
					<FileTreeSidebar
						runId={runId}
						projectId={projectId}
						selectedPath={path}
						onOpenFile={onOpenFile}
					/>
				</aside>
				<div className="min-w-0 flex-1 overflow-hidden">{content}</div>
			</div>
		</div>
	)
}
