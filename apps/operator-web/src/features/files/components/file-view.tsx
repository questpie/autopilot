import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useVfsRead, useVfsStat } from '@/hooks/use-vfs'
import { useQueryClient } from '@tanstack/react-query'
import { vfsWrite } from '@/api/vfs.api'
import { vfsKeys } from '@/hooks/use-vfs'
import { resolveViewer } from '@/lib/viewer-registry'
import { Spinner } from '@/components/ui/spinner'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { Button } from '@/components/ui/button'
import { KvList } from '@/components/ui/kv-list'
import { surfaceCardVariants } from '@/components/ui/surface-card'
import { joinMarkdownDocument, splitMarkdownDocument } from '@/lib/markdown-document'
import { cn } from '@/lib/utils'
import {
	buildPathSegments,
	buildUri,
	formatBytes,
	getBaseName,
} from '../lib/file-paths'
import { FilePreviewSurface } from './file-preview-surface'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { InspectorShell } from './inspector-shell'

interface FileViewProps {
  path: string
  runId: string | null
  onBack: (parentPath: string | null) => void
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

interface BreadcrumbNavProps {
  runId: string | null
  path: string
  onBack: (parentPath: string | null) => void
}

function BreadcrumbNav({ runId, path, onBack }: BreadcrumbNavProps) {
  const segments = buildPathSegments(path)
  const rootLabel = runId ? `Run: ${runId.slice(0, 8)}…` : 'Files'

	return (
		<Breadcrumb>
			<BreadcrumbList className="text-xs text-muted-foreground">
				<BreadcrumbItem>
          <BreadcrumbLink
            className="cursor-pointer text-muted-foreground hover:text-primary px-1.5 py-0.5 transition-colors"
            onClick={() => onBack(null)}
          >
            {rootLabel}
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((seg, i) => (
          <div key={i} className="contents">
            <BreadcrumbSeparator className="text-muted-foreground">/</BreadcrumbSeparator>
            <BreadcrumbItem>
              {seg.path !== null ? (
                <BreadcrumbLink
                  className="cursor-pointer text-muted-foreground hover:text-primary px-1.5 py-0.5 transition-colors"
                  onClick={() => onBack(seg.path)}
                >
                  {seg.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-foreground px-1.5 py-0.5">{seg.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
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

export function FileView({ path, runId, onBack }: FileViewProps) {
  const uri = buildUri(runId, path)
  const { data, isLoading, error } = useVfsRead(uri)
  const statQuery = useVfsStat(uri)
  const queryClient = useQueryClient()
  const viewer = data ? resolveViewer(path, data.contentType) : null
  const markdownDocument = viewer?.type === 'markdown' && data?.content
    ? splitMarkdownDocument(data.content)
    : null

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [markdownDraft, setMarkdownDraft] = useState('')
  const [markdownSource, setMarkdownSource] = useState<{ uri: string; body: string } | null>(null)
  const [markdownDirty, setMarkdownDirty] = useState(false)

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
    setMarkdownSource({ uri, body: nextContent })
    setMarkdownDirty(false)
  }, [viewer?.type, markdownDocument?.body, uri])

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
      setMarkdownSource({ uri, body: nextContent })
      setMarkdownDirty(false)
      return
    }
    // Reset Monaco editor content to the last saved value (code files)
    if (editorRef.current && data) {
      editorRef.current.setValue(data.content ?? '')
    }
    setEditMode(false)
  }, [data, markdownDocument?.body, uri, viewer?.type])

  const handleSave = useCallback(async () => {
    const content =
      viewer?.type === 'markdown'
        ? joinMarkdownDocument({
            frontmatterBlock: markdownDocument?.frontmatterBlock ?? null,
            body: tiptapContentRef.current,
          })
        : editorRef.current?.getValue() ?? ''
    setSaving(true)
    try {
      await vfsWrite(uri, content)
      await queryClient.invalidateQueries({ queryKey: vfsKeys.read(uri) })
      if (viewer?.type === 'markdown') {
        setMarkdownDirty(false)
      } else {
        setEditMode(false)
      }
    } finally {
      setSaving(false)
    }
  }, [uri, queryClient, viewer?.type, markdownDocument?.frontmatterBlock])

  // Only company:// URIs are writable (workspace is read-only)
  const canEdit = runId === null

  const isEditable = viewer && (viewer.type === 'code' || viewer.type === 'structured' || viewer.type === 'plain' || viewer.type === 'markdown')
  const fileName = getBaseName(path, path)

	const sidebar = (
		<div className="space-y-4">
			<div>
				<p className="text-sm font-medium text-muted-foreground">File</p>
				<p className="mt-2 truncate text-sm text-foreground">{fileName}</p>
				<p className="mt-1 break-all text-xs text-muted-foreground">{path}</p>
			</div>

			{statQuery.isLoading ? (
				<div className="flex items-center gap-2 text-muted-foreground">
					<Spinner size="sm" />
					<span className="text-sm">Loading metadata…</span>
				</div>
			) : statQuery.isError ? (
				<p className="text-sm text-destructive">Failed to load metadata.</p>
			) : statQuery.data ? (
        <KvList
          items={[
						{
							label: 'Scope',
							value: <span className="text-sm text-muted-foreground">{runId ? `run:${runId.slice(0, 8)}` : 'company'}</span>,
						},
						{
							label: 'Type',
							value: <span className="text-sm text-muted-foreground">{statQuery.data.type}</span>,
						},
						{
							label: 'Size',
							value: <span className="text-sm text-muted-foreground tabular-nums">{formatBytes(data?.size ?? statQuery.data.size ?? null)}</span>,
						},
						{
							label: 'MIME',
							value: <span className="text-sm text-muted-foreground">{statQuery.data.mime_type ?? data?.contentType ?? '—'}</span>,
						},
						{
							label: 'Writable',
							value: <span className="text-sm text-muted-foreground">{statQuery.data.writable ? 'yes' : 'no'}</span>,
						},
						{
							label: 'ETag',
							value: <span className="break-all text-sm text-muted-foreground">{statQuery.data.etag ?? '—'}</span>,
						},
					]}
				/>
			) : null}

      {viewer?.type === 'markdown' && canEdit ? (
        <p className="text-sm text-muted-foreground">Inline markdown mode. Type `/` on an empty line to insert a block.</p>
      ) : editMode ? (
        <p className="text-sm text-warning">Editing mode is active.</p>
      ) : null}
		</div>
  )

  const toolbar = canEdit && isEditable && data && !isLoading && !error ? (
    viewer?.type === 'markdown' ? (
      <div className="flex items-center gap-2">
        {markdownDirty ? (
          <>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleCancel}
              disabled={saving}
            >
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
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCancel}
            disabled={saving}
          >
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
        <Button
          variant="outline"
          size="xs"
          onClick={handleEdit}
        >
          Edit
        </Button>
        )}
      </div>
    )
  ) : null

  const content = (
    <>
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

      {!isLoading && !error && data && (() => {
        if (!viewer) return null

        if (viewer.type === 'markdown') {
          const savedMarkdownBody = markdownDocument?.body ?? ''
          const editorContent = markdownSource?.uri === uri && markdownSource.body === savedMarkdownBody
            ? markdownDraft
            : savedMarkdownBody

          return (
            <div className="h-full overflow-auto">
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
                contentClassName="[&_.ProseMirror]:px-6 [&_.ProseMirror]:py-6"
                onChange={(md) => {
                  tiptapContentRef.current = md
                  setMarkdownDraft(md)
                  setMarkdownSource({ uri, body: savedMarkdownBody })
                  setMarkdownDirty(md !== savedMarkdownBody)
                }}
              />
            </div>
          )
        }

        if (viewer.type === 'image' || viewer.type === 'pdf' || viewer.type === 'video' || viewer.type === 'docx') {
          return (
            <FilePreviewSurface path={path} uri={uri} viewerType={viewer.type} data={data} variant="full" />
          )
        }

        if (
          data.isText &&
          (viewer.type === 'code' ||
            viewer.type === 'structured' ||
            viewer.type === 'plain')
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
					<p className="text-sm text-muted-foreground">Preview not available for this file type.</p>
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
    </>
  )

  return (
    <InspectorShell
      header={<BreadcrumbNav runId={runId} path={path} onBack={onBack} />}
      toolbar={toolbar}
      sidebar={sidebar}
      content={content}
    />
  )
}
