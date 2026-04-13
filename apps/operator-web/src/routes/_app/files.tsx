import { useState, useMemo, useCallback } from 'react'
import { z } from 'zod'
import {
  FileTextIcon,
  FileIcon,
  ImageIcon,
  FileCodeIcon,
  TableIcon,
  FolderIcon,
  FolderOpenIcon,
  FileArrowDownIcon,
  CaretRightIcon,
  CaretDownIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { KvList } from '@/components/ui/kv-list'
import { EmptyState } from '@/components/empty-state'
import { FileViewer } from '@/components/file-viewer'
import { ListDetail, ListPanel } from '@/components/list-detail'
import { useVfsList, useVfsRead, useVfsDiff } from '@/hooks/use-vfs'
import { useRuns } from '@/hooks/use-runs'
import { resolveViewer } from '@/lib/viewer-registry'
import type { VfsListEntry, VfsDiffFile } from '@/api/types'

// ── Route ──

const filesSearchSchema = z.object({
  path: z.string().optional(),
  scope: z.enum(['workspace', 'company']).optional(),
})

export const Route = createFileRoute('/_app/files')({
  component: FilesPage,
  validateSearch: (search) => filesSearchSchema.parse(search),
})

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot) : ''
}

type PhosphorIcon = typeof FileTextIcon

function fileIcon(name: string, opts: { isDir?: boolean; expanded?: boolean } = {}): PhosphorIcon {
  if (opts.isDir) return opts.expanded ? FolderOpenIcon : FolderIcon
  const ext = getFileExtension(name).toLowerCase()
  if (ext === '.pdf') return FileIcon
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) return ImageIcon
  if (['.xlsx', '.csv'].includes(ext)) return TableIcon
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.sh'].includes(ext)) return FileCodeIcon
  if (['.zip', '.tar', '.gz'].includes(ext)) return FileArrowDownIcon
  return FileTextIcon
}

function vfsUri(scope: 'company' | 'workspace', path: string, runId: string | null): string {
  if (scope === 'company') return path ? `company://${path}` : 'company://'
  return path ? `workspace://run/${runId}/${path}` : `workspace://run/${runId}`
}

function vfsReadUrl(uri: string): string {
  return `/api/vfs/read?uri=${encodeURIComponent(uri)}`
}

// ── Diff utilities ──

interface DiffStatusBadge {
  letter: string
  colorClass: string
}

function diffStatusBadge(status: string): DiffStatusBadge {
  switch (status) {
    case 'added':
      return { letter: 'A', colorClass: 'bg-green-500/20 text-green-600' }
    case 'modified':
      return { letter: 'M', colorClass: 'bg-amber-500/20 text-amber-600' }
    case 'deleted':
      return { letter: 'D', colorClass: 'bg-red-500/20 text-red-600' }
    case 'renamed':
      return { letter: 'R', colorClass: 'bg-blue-500/20 text-blue-600' }
    default:
      return { letter: status.charAt(0).toUpperCase(), colorClass: 'bg-muted text-muted-foreground' }
  }
}

interface DiffLine {
  type: 'add' | 'delete' | 'context' | 'header'
  content: string
  oldNum: number | null
  newNum: number | null
}

function parseUnifiedDiff(raw: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldNum = 0
  let newNum = 0

  for (const line of raw.split('\n')) {
    if (line.startsWith('@@')) {
      const match = /@@ -(\d+)/.exec(line)
      if (match) {
        oldNum = Number(match[1]) - 1
        const newMatch = /\+(\d+)/.exec(line)
        newNum = newMatch ? Number(newMatch[1]) - 1 : oldNum
      }
      lines.push({ type: 'header', content: line, oldNum: null, newNum: null })
    } else if (line.startsWith('+')) {
      newNum++
      lines.push({ type: 'add', content: line.slice(1), oldNum: null, newNum })
    } else if (line.startsWith('-')) {
      oldNum++
      lines.push({ type: 'delete', content: line.slice(1), oldNum, newNum: null })
    } else if (line.startsWith(' ') || line === '') {
      oldNum++
      newNum++
      lines.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line, oldNum, newNum })
    }
  }
  return lines
}

// ─────────────────────────────────────────────
// Selection type
// ─────────────────────────────────────────────

type SelectedItem =
  | { kind: 'company-file'; entry: VfsListEntry }
  | { kind: 'workspace-file'; entry: VfsListEntry; runId: string }

// ─────────────────────────────────────────────
// FileRow
// ─────────────────────────────────────────────

function FileRow({
  icon: IconComp,
  iconClass,
  name,
  sublabel,
  metaRight,
  selected,
  depth,
  caretExpanded,
  hasChildren,
  isDir,
  onClick,
}: {
  icon: PhosphorIcon
  iconClass?: string
  name: string
  sublabel?: string
  metaRight?: React.ReactNode
  selected?: boolean
  depth?: number
  caretExpanded?: boolean
  hasChildren?: boolean
  isDir?: boolean
  onClick: () => void
}) {
  const paddingLeft = depth ? 16 + depth * 16 : 16
  return (
    <button
      type="button"
      style={{ paddingLeft }}
      className={cn(
        'flex w-full items-center gap-2.5 border-b border-border/50 py-2 pr-4 text-left transition-colors hover:bg-muted/20',
        selected && 'bg-muted/30',
        isDir && 'bg-muted/5',
      )}
      onClick={onClick}
    >
      {hasChildren !== undefined
        ? (hasChildren
          ? (caretExpanded
            ? <CaretDownIcon className="size-3 shrink-0 text-muted-foreground" />
            : <CaretRightIcon className="size-3 shrink-0 text-muted-foreground" />)
          : <span className="size-3 shrink-0" />)
        : null}
      <IconComp
        className={cn('size-[18px] shrink-0', iconClass ?? 'text-muted-foreground')}
        weight={isDir ? 'bold' : 'regular'}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">{name}</div>
        {sublabel && (
          <div className="truncate text-[12px] text-muted-foreground">{sublabel}</div>
        )}
      </div>
      {metaRight && (
        <div className="flex shrink-0 items-center gap-2">{metaRight}</div>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────
// VFS tree rows with lazy directory loading
// ─────────────────────────────────────────────

function VfsDirectoryEntries({
  uri,
  scope,
  runId,
  depth,
  expandedDirs,
  selectedPath,
  diffMap,
  onToggle,
  onSelect,
}: {
  uri: string
  scope: 'company' | 'workspace'
  runId: string | null
  depth: number
  expandedDirs: Set<string>
  selectedPath: string | null
  diffMap: Map<string, VfsDiffFile> | null
  onToggle: (dirUri: string) => void
  onSelect: (entry: VfsListEntry) => void
}) {
  const { data } = useVfsList(uri)
  if (!data) return null
  return (
    <>
      {data.entries.map((entry) => (
        <VfsEntryRow
          key={entry.path}
          entry={entry}
          scope={scope}
          runId={runId}
          depth={depth}
          expandedDirs={expandedDirs}
          selectedPath={selectedPath}
          diffMap={diffMap}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

function VfsEntryRow({
  entry,
  scope,
  runId,
  depth,
  expandedDirs,
  selectedPath,
  diffMap,
  onToggle,
  onSelect,
}: {
  entry: VfsListEntry
  scope: 'company' | 'workspace'
  runId: string | null
  depth: number
  expandedDirs: Set<string>
  selectedPath: string | null
  diffMap: Map<string, VfsDiffFile> | null
  onToggle: (dirUri: string) => void
  onSelect: (entry: VfsListEntry) => void
}) {
  const isDir = entry.type === 'directory'
  const entryUri = vfsUri(scope, entry.path, runId)
  const expanded = isDir && expandedDirs.has(entryUri)

  const Icon = fileIcon(entry.name, { isDir, expanded })
  const iconClass = isDir ? 'text-primary/70' : 'text-muted-foreground'
  const diffEntry = diffMap?.get(entry.path)
  const badge = diffEntry ? diffStatusBadge(diffEntry.status) : null

  return (
    <div>
      <FileRow
        icon={Icon}
        iconClass={iconClass}
        name={`${entry.name}${isDir ? '/' : ''}`}
        metaRight={
          <span className="flex items-center gap-1.5">
            {badge && (
              <span className={cn('inline-flex size-[18px] items-center justify-center rounded text-[10px] font-bold', badge.colorClass)}>
                {badge.letter}
              </span>
            )}
            {!isDir && entry.size != null && (
              <span className="font-heading text-[11px] text-muted-foreground">{formatSize(entry.size)}</span>
            )}
          </span>
        }
        selected={selectedPath === entry.path}
        depth={depth}
        caretExpanded={expanded}
        hasChildren={isDir ? true : undefined}
        isDir={isDir}
        onClick={() => {
          if (isDir) onToggle(entryUri)
          else onSelect(entry)
        }}
      />
      {isDir && expanded && (
        <VfsDirectoryEntries
          uri={entryUri}
          scope={scope}
          runId={runId}
          depth={depth + 1}
          expandedDirs={expandedDirs}
          selectedPath={selectedPath}
          diffMap={diffMap}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Section header for list scopes
// ─────────────────────────────────────────────

function ScopeHeader({
  title,
  description,
  collapsible,
  expanded,
  onToggle,
}: {
  title: string
  description: string
  collapsible?: boolean
  expanded?: boolean
  onToggle?: () => void
}) {
  const inner = (
    <div className={cn('flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/10', collapsible && 'hover:bg-muted/20 transition-colors')}>
      {collapsible && (
        expanded
          ? <CaretDownIcon className="size-3 shrink-0 text-muted-foreground" />
          : <CaretRightIcon className="size-3 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <div className="font-heading text-[11px] uppercase tracking-[0.5px] text-muted-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground/60">{description}</div>
      </div>
    </div>
  )

  if (collapsible) {
    return (
      <button type="button" className="w-full text-left" onClick={onToggle}>
        {inner}
      </button>
    )
  }
  return inner
}

// ─────────────────────────────────────────────
// File detail panel (unified for both scopes)
// ─────────────────────────────────────────────

function DiffView({ diff }: { diff: string }) {
  const lines = useMemo(() => parseUnifiedDiff(diff), [diff])

  if (lines.length === 0) {
    return <div className="py-4 text-center text-[12px] text-muted-foreground">No diff content</div>
  }

  return (
    <div className="overflow-auto font-mono text-[12px] leading-[20px]">
      {lines.map((line, i) => {
        if (line.type === 'header') {
          return (
            <div key={i} className="bg-blue-500/10 px-3 py-0.5 text-blue-600">
              {line.content}
            </div>
          )
        }
        const bgClass =
          line.type === 'add' ? 'bg-green-500/10' :
          line.type === 'delete' ? 'bg-red-500/10' :
          ''
        const textClass =
          line.type === 'add' ? 'text-green-600' :
          line.type === 'delete' ? 'text-red-600' :
          'text-foreground'
        const prefix =
          line.type === 'add' ? '+' :
          line.type === 'delete' ? '-' :
          ' '

        return (
          <div key={i} className={cn('flex', bgClass)}>
            <span className="inline-block w-[36px] shrink-0 select-none pr-1 text-right text-muted-foreground/40">
              {line.oldNum ?? ''}
            </span>
            <span className="inline-block w-[36px] shrink-0 select-none pr-1 text-right text-muted-foreground/40">
              {line.newNum ?? ''}
            </span>
            <span className={cn('whitespace-pre', textClass)}>
              {prefix}{line.content}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function FileDetail({
  item,
  diffMap,
  activeTaskId,
}: {
  item: SelectedItem
  diffMap: Map<string, VfsDiffFile> | null
  activeTaskId: string | null
}) {
  const { t } = useTranslation()
  const readUri = item.kind === 'company-file'
    ? `company://${item.entry.path}`
    : `workspace://run/${item.runId}/${item.entry.path}`

  const isDir = item.entry.type === 'directory'

  // Binary files (image/pdf) — skip JS text fetch, use direct browser URL
  const viewer = resolveViewer(item.entry.path, item.entry.mime_type ?? undefined)
  const isBinaryViewer = viewer.type === 'image' || viewer.type === 'pdf'
  const { data: fileData } = useVfsRead(isDir || isBinaryViewer ? null : readUri)

  const Icon = fileIcon(item.entry.name, { isDir })
  const diffEntry = item.kind === 'workspace-file' ? diffMap?.get(item.entry.path) ?? null : null
  const badge = diffEntry ? diffStatusBadge(diffEntry.status) : null

  // Direct browser URL for binary preview — browser handles binary natively with session cookie
  const binarySrc = !isDir && isBinaryViewer ? vfsReadUrl(readUri) : undefined

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 px-5 py-4">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" weight={isDir ? 'bold' : 'regular'} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-medium text-foreground break-all">
                {item.entry.name}{isDir ? '/' : ''}
              </h2>
              {badge && (
                <span className={cn('inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold', badge.colorClass)}>
                  {badge.letter}
                </span>
              )}
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground/70">{item.entry.path}</div>
            <div className="mt-1 font-heading text-[11px] text-muted-foreground">
              {formatSize(fileData?.size ?? item.entry.size)} · {fileData?.contentType ?? item.entry.mime_type ?? 'unknown'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isDir ? (
          <DirectoryContents uri={readUri} />
        ) : (
          <>
            {/* Preview */}
            <div className="border-b border-border/50">
              <FileViewer
                path={item.entry.path}
                content={fileData?.content}
                mime={fileData?.contentType ?? item.entry.mime_type ?? undefined}
                src={binarySrc}
              />
            </div>

            {/* Diff section — workspace files with diff data */}
            {diffEntry?.diff && (
              <div className="border-b border-border/50 px-5 py-4">
                <SectionHeader>Changes</SectionHeader>
                <div className="mt-3 overflow-hidden rounded border border-border/50">
                  <DiffView diff={diffEntry.diff} />
                </div>
              </div>
            )}

            {/* Info */}
            <div className="px-5 py-4">
              <SectionHeader>{t('files.detail_info')}</SectionHeader>
              <div className="mt-3">
                <KvList items={[
                  { label: t('files.label_path'), value: <span className="truncate font-mono text-[12px]">{item.entry.path}</span> },
                  { label: t('files.label_size'), value: formatSize(fileData?.size ?? item.entry.size) },
                  { label: t('files.label_type'), value: fileData?.contentType ?? item.entry.mime_type ?? 'unknown' },
                  ...(diffEntry ? [{ label: 'Status', value: diffEntry.status }] : []),
                  ...(item.kind === 'workspace-file' ? [{ label: 'Run', value: <span className="font-mono text-[12px]">{item.runId.slice(0, 16)}</span> }] : []),
                  ...(item.kind === 'workspace-file' && activeTaskId ? [{ label: 'Task', value: <span className="font-mono text-[12px]">{activeTaskId.slice(0, 16)}</span> }] : []),
                ]} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DirectoryContents({ uri }: { uri: string }) {
  const { t } = useTranslation()
  const { data } = useVfsList(uri)

  if (!data) {
    return <div className="flex items-center justify-center py-12 text-[12px] text-muted-foreground">Loading...</div>
  }
  if (data.entries.length === 0) {
    return <div className="flex items-center justify-center py-12 text-[12px] text-muted-foreground">{t('files.empty_title')}</div>
  }

  return (
    <div className="flex flex-col">
      {data.entries.map((child) => {
        const ChildIcon = fileIcon(child.name, { isDir: child.type === 'directory' })
        return (
          <div key={child.path} className="flex items-center gap-2.5 border-b border-border/50 px-4 py-2">
            <ChildIcon className="size-[18px] shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{child.name}</span>
            <span className="font-heading text-[11px] text-muted-foreground">{formatSize(child.size)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

function FilesPage() {
  const { t } = useTranslation()
  const { path: deepLinkPath, scope: deepLinkScope } = Route.useSearch()

  // ── Data ──
  const companyList = useVfsList('company://')
  const { data: allRuns } = useRuns()

  const workspaceRuns = useMemo(() => {
    if (!allRuns) return []
    return allRuns.filter((r) => r.status === 'completed' || r.status === 'running')
  }, [allRuns])

  const [userRunId, setUserRunId] = useState<string | null>(null)
  const activeRunId = userRunId ?? workspaceRuns[0]?.id ?? null

  const workspaceUri = activeRunId ? `workspace://run/${activeRunId}` : null
  const workspaceList = useVfsList(workspaceUri)
  const { data: diffData } = useVfsDiff(workspaceUri)

  // ── UI state ──
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true)
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [search, setSearch] = useState('')

  // ── Derived data ──
  const companyEntries = companyList.data?.entries ?? []
  const workspaceEntries = workspaceList.data?.entries ?? []

  const diffMap = useMemo((): Map<string, VfsDiffFile> | null => {
    if (!diffData) return null
    const map = new Map<string, VfsDiffFile>()
    for (const file of diffData.files) {
      map.set(file.path, file)
    }
    return map
  }, [diffData])

  const activeRun = workspaceRuns.find((r) => r.id === activeRunId) ?? null
  const activeTaskId = activeRun?.task_id ?? null

  const filteredCompany = useMemo(() => {
    if (!search.trim()) return companyEntries
    const q = search.trim().toLowerCase()
    return companyEntries.filter((e) => e.name.toLowerCase().includes(q))
  }, [companyEntries, search])

  const filteredWorkspace = useMemo(() => {
    if (!search.trim()) return workspaceEntries
    const q = search.trim().toLowerCase()
    return workspaceEntries.filter((e) => e.name.toLowerCase().includes(q))
  }, [workspaceEntries, search])

  // ── Deep-link resolution ──
  const deepLinkSelected = useMemo((): SelectedItem | null => {
    if (!deepLinkPath) return null
    if (deepLinkScope === 'workspace' && activeRunId) {
      const wsEntry = workspaceEntries.find((e) => e.path === deepLinkPath)
      if (wsEntry) return { kind: 'workspace-file', entry: wsEntry, runId: activeRunId }
      // Synthesize entry for nested paths not yet loaded
      const name = deepLinkPath.split('/').pop() ?? deepLinkPath
      const synthetic: VfsListEntry = { name, path: deepLinkPath, type: 'file' }
      return { kind: 'workspace-file', entry: synthetic, runId: activeRunId }
    }
    const companyEntry = companyEntries.find((e) => e.path === deepLinkPath)
    if (companyEntry) return { kind: 'company-file', entry: companyEntry }
    return null
  }, [deepLinkPath, deepLinkScope, activeRunId, workspaceEntries, companyEntries])

  // ── Effective selection: explicit pick > deep-link > first company file ──
  const autoSelect = useMemo((): SelectedItem | null => {
    if (deepLinkPath || deepLinkScope === 'workspace') return null
    if (companyEntries.length === 0) return null
    return { kind: 'company-file', entry: companyEntries[0] }
  }, [deepLinkPath, deepLinkScope, companyEntries])

  const effectiveSelected = selected ?? deepLinkSelected ?? autoSelect

  // ── Selected paths per scope (for highlighting) ──
  const selectedCompanyPath = effectiveSelected?.kind === 'company-file' ? effectiveSelected.entry.path : null
  const selectedWorkspacePath = effectiveSelected?.kind === 'workspace-file' ? effectiveSelected.entry.path : null

  const toggleDir = useCallback((dirUri: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dirUri)) next.delete(dirUri)
      else next.add(dirUri)
      return next
    })
  }, [])

  return (
    <ListDetail
      listSize={40}
      list={
        <ListPanel
          header={
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-[14px] font-bold tracking-tight">{t('files.title')}</h2>
                <Button size="sm" variant="ghost" onClick={() => alert(t('files.viewer_download'))}>
                  +
                </Button>
              </div>
              {/* Search */}
              <div className="relative mt-3">
                <MagnifyingGlassIcon className="absolute left-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('files.search')}
                  className="h-7 w-full bg-transparent pl-5 font-heading text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </>
          }
        >
          {filteredCompany.length === 0 && filteredWorkspace.length === 0 ? (
            <EmptyState title={t('files.empty_title')} description={t('files.empty_desc')} />
          ) : (
            <>
              {/* ── Company files ── */}
              {filteredCompany.length > 0 && (
                <>
                  <ScopeHeader
                    title={t('files.scope_company')}
                    description={t('files.scope_company_desc')}
                  />
                  {filteredCompany.map((entry) => {
                    const Icon = fileIcon(entry.name, { isDir: entry.type === 'directory' })
                    return (
                      <FileRow
                        key={entry.path}
                        icon={Icon}
                        name={entry.name}
                        sublabel={entry.mime_type ?? undefined}
                        metaRight={
                          entry.size != null
                            ? <span className="font-heading text-[11px] text-muted-foreground">{formatSize(entry.size)}</span>
                            : undefined
                        }
                        selected={selectedCompanyPath === entry.path}
                        onClick={() => setSelected({ kind: 'company-file', entry })}
                      />
                    )
                  })}
                </>
              )}

              {/* ── Workspace files ── */}
              {(workspaceRuns.length > 0 || workspaceEntries.length > 0) && (
                <>
                  <ScopeHeader
                    title={t('files.scope_workspace')}
                    description={t('files.scope_workspace_desc')}
                    collapsible
                    expanded={workspaceExpanded}
                    onToggle={() => setWorkspaceExpanded((v) => !v)}
                  />
                  {workspaceExpanded && (
                    <>
                      {/* Run selector */}
                      {workspaceRuns.length > 0 && (
                        <div className="border-b border-border/50 px-4 py-2">
                          <select
                            value={activeRunId ?? ''}
                            onChange={(e) => setUserRunId(e.target.value || null)}
                            className="w-full bg-transparent font-heading text-[11px] text-muted-foreground outline-none"
                          >
                            {workspaceRuns.map((run) => (
                              <option key={run.id} value={run.id}>
                                {run.id.slice(0, 16)} — {run.agent_id} ({run.status})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Workspace entries */}
                      {filteredWorkspace.length > 0 ? (
                        filteredWorkspace.map((entry) => (
                          <VfsEntryRow
                            key={entry.path}
                            entry={entry}
                            scope="workspace"
                            runId={activeRunId}
                            depth={0}
                            expandedDirs={expandedDirs}
                            selectedPath={selectedWorkspacePath}
                            diffMap={diffMap}
                            onToggle={toggleDir}
                            onSelect={(e) => {
                              if (activeRunId) {
                                setSelected({ kind: 'workspace-file', entry: e, runId: activeRunId })
                              }
                            }}
                          />
                        ))
                      ) : activeRunId ? (
                        <div className="flex items-center justify-center py-8 text-[12px] text-muted-foreground">
                          {t('files.empty_title')}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-8 text-[12px] text-muted-foreground">
                          {t('files.empty_desc')}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </ListPanel>
      }
      detail={
        effectiveSelected ? (
          <FileDetail item={effectiveSelected} diffMap={diffMap} activeTaskId={activeTaskId} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title={t('files.title')}
              description={t('files.empty_desc')}
            />
          </div>
        )
      }
    />
  )
}
