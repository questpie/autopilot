import { useRef, useState, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useVfsRead } from '@/hooks/use-vfs'
import { useQueryClient } from '@tanstack/react-query'
import { vfsWrite } from '@/api/vfs.api'
import { vfsKeys } from '@/hooks/use-vfs'
import { resolveViewer } from '@/lib/viewer-registry'
import { Spinner } from '@/components/ui/spinner'
import { Markdown } from '@/components/ui/markdown'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface FileViewProps {
  path: string
  runId: string | null
  onBack: (parentPath: string | null) => void
}

function buildReadUri(runId: string | null, path: string): string {
  if (runId) {
    return `workspace://run/${runId}/${path}`
  }
  return `company://${path}`
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildPathSegments(path: string): { label: string; path: string | null }[] {
  const parts = path.split('/').filter(Boolean)
  return parts.map((part, i) => ({
    label: part,
    path: i === parts.length - 1 ? null : parts.slice(0, i + 1).join('/'),
  }))
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
      <BreadcrumbList className="font-mono text-xs">
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
  const uri = buildReadUri(runId, path)
  const { data, isLoading, error } = useVfsRead(uri)
  const queryClient = useQueryClient()

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // Monaco editor ref — used for code/structured/plain files
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

  // Tiptap-managed markdown content — only used when viewer.type === 'markdown'
  const tiptapContentRef = useRef<string>('')

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  const handleEdit = useCallback(() => {
    if (data) {
      tiptapContentRef.current = data.content ?? ''
    }
    setEditMode(true)
  }, [data])

  const handleCancel = useCallback(() => {
    // Reset Monaco editor content to the last saved value (code files)
    if (editorRef.current && data) {
      editorRef.current.setValue(data.content ?? '')
    }
    // Tiptap resets via key-based remount (content prop drives initial state)
    setEditMode(false)
  }, [data])

  const handleSave = useCallback(async () => {
    const viewer = data ? resolveViewer(path, data.contentType) : null
    const content =
      viewer?.type === 'markdown'
        ? tiptapContentRef.current
        : editorRef.current?.getValue() ?? ''
    setSaving(true)
    try {
      await vfsWrite(uri, content)
      await queryClient.invalidateQueries({ queryKey: vfsKeys.read(uri) })
      setEditMode(false)
    } finally {
      setSaving(false)
    }
  }, [uri, queryClient, data, path])

  // Only company:// URIs are writable (workspace is read-only)
  const canEdit = runId === null

  const viewer = data ? resolveViewer(path, data.contentType) : null
  const isEditable = viewer && (viewer.type === 'code' || viewer.type === 'structured' || viewer.type === 'plain' || viewer.type === 'markdown')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header: breadcrumb + file metadata + edit actions */}
      <div className="shrink-0 bg-muted/30 px-4 py-3 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <BreadcrumbNav runId={runId} path={path} onBack={onBack} />
          {canEdit && isEditable && data && !isLoading && !error && (
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
          )}
        </div>
        {data && (
          <p className={cn('font-mono text-[11px] text-muted-foreground')}>
            {formatBytes(data.size)} · {data.contentType}
            {editMode && <span className="ml-2 text-warning">editing</span>}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Spinner size="lg" className="text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Failed to load file.</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{path}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && data && (() => {
          if (!viewer) return null

          if (viewer.type === 'image') {
            return (
              <div className="flex h-full items-center justify-center overflow-auto p-6">
                <img
                  src={`/api/vfs/read?uri=${encodeURIComponent(uri)}`}
                  alt={path}
                  className="max-w-full"
                />
              </div>
            )
          }

          if (viewer.type === 'markdown' && !editMode) {
            return (
              <div className="h-full overflow-auto">
                <div className="mx-auto max-w-3xl px-6 py-6">
                  <Markdown content={data.content ?? ''} />
                </div>
              </div>
            )
          }

          if (viewer.type === 'markdown' && editMode) {
            return (
              <div className="h-full overflow-hidden">
                <TiptapEditor
                  content={data.content ?? ''}
                  editable
                  onChange={(md) => { tiptapContentRef.current = md }}
                />
              </div>
            )
          }

          if (
            viewer.type === 'code' ||
            viewer.type === 'structured' ||
            viewer.type === 'plain'
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
            <div className="m-4 bg-muted/40 p-4">
              <p className="font-mono text-xs text-muted-foreground">Preview not available for this file type.</p>
              <div className="mt-3 space-y-1">
                <p className="font-mono text-xs text-muted-foreground">
                  <span className="text-foreground">Path:</span> {path}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  <span className="text-foreground">Size:</span> {formatBytes(data.size)}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  <span className="text-foreground">Type:</span> {data.contentType}
                </p>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
