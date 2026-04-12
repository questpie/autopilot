import { useState, useMemo, useEffect, useCallback } from 'react'
import { z } from 'zod'
import {
  FileTextIcon,
  FileIcon,
  ImageIcon,
  FileCodeIcon,
  TableIcon,
  FolderIcon,
  FolderOpenIcon,
  TreeStructureIcon,
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
import { RelationLink } from '@/components/ui/relation-link'
import { StatusPill } from '@/components/ui/status-pill'
import { EmptyState } from '@/components/empty-state'
import { FileViewer } from '@/components/file-viewer'
import { ListDetail, ListPanel } from '@/components/list-detail'
import { getResources } from '@/api/resources.api'
import type { ResourceData, ResourceType, ResourceStatus } from '@/api/resources.api'
import {
  getWorkspaceTree,
  getFileCode,
  getFileDiff,
  getFileHistory,
} from '@/api/files.api'
import type { FileDiffInfo, FileCommitEntry } from '@/api/files.api'
import type { FileTreeNode, FileChangeKind } from '@/api/types'

// ── Route ──

const filesSearchSchema = z.object({
  // Workspace file path to pre-select (matches artifact ref_value)
  path: z.string().optional(),
  // Force scope: 'workspace' to skip company files and jump straight to workspace tree
  scope: z.enum(['workspace', 'company']).optional(),
})

export const Route = createFileRoute('/_app/files')({
  component: FilesPage,
  validateSearch: (search) => filesSearchSchema.parse(search),
})

// ─────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────

type ResourceFilter = 'all' | 'docs' | 'images' | 'data'

const TYPE_FILTER: Record<ResourceType, ResourceFilter> = {
  PDF: 'docs',
  MD: 'docs',
  XLSX: 'data',
  CSV: 'data',
  ZIP: 'docs',
  PNG: 'images',
}

const STATUS_PILL_MAP: Record<ResourceStatus, 'done' | 'working' | 'pending'> = {
  indexed: 'done',
  processing: 'working',
  unprocessed: 'pending',
}

const STATUS_I18N: Record<ResourceStatus, string> = {
  indexed: 'files.status_indexed',
  processing: 'files.status_processing',
  unprocessed: 'files.status_unprocessed',
}

function formatSize(bytes: number | null | string): string {
  if (bytes === null || bytes === undefined) return '—'
  if (typeof bytes === 'string') return bytes
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot) : ''
}

function changeLetter(change: FileChangeKind): string | null {
  if (change === 'added') return 'A'
  if (change === 'modified') return 'M'
  if (change === 'deleted') return 'D'
  return null
}

function changeBgColor(change: FileChangeKind): string {
  if (change === 'added') return 'bg-green-500/10 border-green-500/30 text-green-500'
  if (change === 'modified') return 'bg-amber-500/10 border-amber-500/30 text-amber-500'
  if (change === 'deleted') return 'bg-red-500/10 border-red-500/30 text-red-500'
  return ''
}

function findNode(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNode(node.children, path)
      if (found) return found
    }
  }
  return null
}

// ─────────────────────────────────────────────
// Unified file icon function
// ─────────────────────────────────────────────

type PhosphorIcon = typeof FileTextIcon

function fileIcon(
  name: string,
  opts: { isDir?: boolean; isWorktreeRoot?: boolean; expanded?: boolean } = {},
): PhosphorIcon {
  if (opts.isWorktreeRoot) return TreeStructureIcon
  if (opts.isDir) return opts.expanded ? FolderOpenIcon : FolderIcon
  const ext = getFileExtension(name).toLowerCase()
  if (ext === '.pdf') return FileIcon
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) return ImageIcon
  if (['.xlsx', '.csv'].includes(ext)) return TableIcon
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.sh'].includes(ext)) return FileCodeIcon
  if (['.zip', '.tar', '.gz'].includes(ext)) return FileArrowDownIcon
  return FileTextIcon
}

// ─────────────────────────────────────────────
// Selection type
// ─────────────────────────────────────────────

type SelectedItem =
  | { kind: 'company-file'; resource: ResourceData }
  | { kind: 'workspace-file'; path: string }

// ─────────────────────────────────────────────
// Unified FileRow — one component for both scopes
// ─────────────────────────────────────────────

function FileRow({
  icon: IconComp,
  iconClass,
  name,
  sublabel,
  metaLeft,
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
  metaLeft?: React.ReactNode
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
      {/* Caret for expandable dirs — occupies fixed width so icons stay aligned */}
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
        <div className="truncate text-[13px] font-medium text-foreground">
          {name}
        </div>
        {sublabel && (
          <div className="truncate text-[12px] text-muted-foreground">{sublabel}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {metaLeft}
        {metaRight}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────
// Workspace file row (recursive)
// ─────────────────────────────────────────────

function WsFileRow({
  node,
  depth,
  expandedDirs,
  selectedPath,
  onToggle,
  onSelect,
}: {
  node: FileTreeNode
  depth: number
  expandedDirs: Set<string>
  selectedPath: string | null
  onToggle: (p: string) => void
  onSelect: (p: string) => void
}) {
  const isDir = node.type === 'directory' || node.type === 'worktree-root'
  const expanded = expandedDirs.has(node.path)
  const changeLet = changeLetter(node.change)

  const Icon = fileIcon(node.name, {
    isDir: node.type === 'directory',
    isWorktreeRoot: node.type === 'worktree-root',
    expanded,
  })

  const iconClass = node.type === 'worktree-root'
    ? 'text-primary'
    : isDir
    ? 'text-primary/70'
    : 'text-muted-foreground'

  return (
    <div>
      <FileRow
        icon={Icon}
        iconClass={iconClass}
        name={`${node.name}${isDir ? '/' : ''}`}
        sublabel={undefined}
        metaLeft={
          changeLet
            ? <span className={cn('font-heading text-[10px] border px-1.5 py-0.5', changeBgColor(node.change))}>{changeLet}</span>
            : undefined
        }
        metaRight={
          !isDir
            ? <span className="font-heading text-[11px] text-muted-foreground">{formatSize(node.size)}</span>
            : undefined
        }
        selected={selectedPath === node.path}
        depth={depth}
        caretExpanded={expanded}
        hasChildren={isDir ? true : undefined}
        isDir={isDir}
        onClick={() => {
          if (isDir) onToggle(node.path)
          onSelect(node.path)
        }}
      />
      {isDir && expanded && node.children?.map((child) => (
        <WsFileRow
          key={child.path}
          node={child}
          depth={depth + 1}
          expandedDirs={expandedDirs}
          selectedPath={selectedPath}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
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
// Detail panels
// ─────────────────────────────────────────────

function CompanyDetail({ resource }: { resource: ResourceData }) {
  const { t } = useTranslation()
  const Icon = fileIcon(resource.filename)
  return (
    <div className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 px-5 py-4">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-[18px] font-medium text-foreground">{resource.filename}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{resource.type} · {resource.size} · {resource.date}</span>
              <StatusPill
                status={STATUS_PILL_MAP[resource.status]}
                label={t(STATUS_I18N[resource.status])}
                pulse={resource.status === 'processing'}
              />
            </div>
          </div>
        </div>
        {resource.description && (
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{resource.description}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Preview — primary */}
        <div className="border-b border-border/50 px-5 py-4">
          <SectionHeader>{t('files.detail_preview')}</SectionHeader>
          <div className="mt-3 border border-border/50 bg-muted/10">
            <FileViewer
              path={resource.filename}
              content={resource.preview_content}
              mime={resource.preview_mime}
            />
          </div>
        </div>

        {/* Relations */}
        {resource.relations.length > 0 && (
          <div className="border-b border-border/50 px-5 py-4">
            <SectionHeader>{t('files.detail_where_used')}</SectionHeader>
            <div className="mt-3 flex flex-col gap-2">
              {resource.relations.map((rel, i) => (
                <div key={i} className="flex items-baseline gap-2">
                  <span className="shrink-0 font-heading text-[11px] text-muted-foreground">{rel.kind}:</span>
                  <RelationLink label={rel.label} sublabel={rel.sublabel} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Versions */}
        {resource.versions.length > 0 && (
          <div className="px-5 py-4">
            <SectionHeader>{t('files.detail_versions')}</SectionHeader>
            <div className="mt-3 flex flex-col gap-1">
              {resource.versions.map((v) => (
                <div key={v.version} className="flex items-baseline gap-2 py-1 text-[12px]">
                  <span className={cn('font-medium', v.current ? 'text-foreground' : 'text-muted-foreground')}>
                    v{v.version}{v.current && <span className="ml-1 font-heading text-[11px] text-muted-foreground">({t('files.label_current')})</span>}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{v.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WorkspaceDetail({
  node, codeContent, diffs, historyMap,
}: {
  node: FileTreeNode
  codeContent: Record<string, string>
  diffs: Record<string, FileDiffInfo>
  historyMap: Record<string, FileCommitEntry[]>
}) {
  const { t } = useTranslation()
  const isDir = node.type === 'directory' || node.type === 'worktree-root'
  const diff = diffs[node.path]
  const history = historyMap[node.path] ?? []
  const code = codeContent[node.path]
  const changeLet = changeLetter(node.change)

  const Icon = fileIcon(node.name, {
    isDir: node.type === 'directory',
    isWorktreeRoot: node.type === 'worktree-root',
  })

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" weight={isDir ? 'bold' : 'regular'} />
            <div className="min-w-0">
              <h2 className="text-[18px] font-medium text-foreground break-all">{node.name}{isDir ? '/' : ''}</h2>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground/70">{node.path}</div>
              <div className="mt-1 font-heading text-[11px] text-muted-foreground">{formatSize(node.size)} · {node.mime_type ?? 'unknown'}</div>
            </div>
          </div>
          {changeLet && (
            <span className={cn('mt-1 shrink-0 font-heading text-[10px] border px-1.5 py-0.5', changeBgColor(node.change))}>{changeLet}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isDir ? (
          /* Directory listing */
          <div className="flex flex-col">
            {(node.children ?? []).length > 0
              ? (node.children ?? []).map((child) => {
                  const ChildIcon = fileIcon(child.name, {
                    isDir: child.type === 'directory',
                    isWorktreeRoot: child.type === 'worktree-root',
                  })
                  const childChangeLet = changeLetter(child.change)
                  return (
                    <div key={child.path} className="flex items-center gap-2.5 border-b border-border/50 px-4 py-2">
                      <ChildIcon className="size-[18px] shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{child.name}</span>
                      {childChangeLet && (
                        <span className={cn('font-heading text-[10px] border px-1.5 py-0.5', changeBgColor(child.change))}>{childChangeLet}</span>
                      )}
                      <span className="font-heading text-[11px] text-muted-foreground">{formatSize(child.size)}</span>
                    </div>
                  )
                })
              : (
                <div className="flex items-center justify-center py-12 text-[12px] text-muted-foreground">{t('files.empty_title')}</div>
              )}
          </div>
        ) : (
          <>
            {/* Preview — always first */}
            <div className="border-b border-border/50">
              <FileViewer path={node.path} content={code} mime={node.mime_type ?? undefined} />
            </div>

            {/* Diff — shown only when file has changes */}
            {diff && node.change !== 'unchanged' && (
              <div className="border-b border-border/50 px-5 py-4">
                <SectionHeader>{t('files.detail_changes')}</SectionHeader>
                <div className="mt-3 flex items-center gap-3 text-[12px]">
                  <span className="font-mono text-green-500">{t('files.lines_added', { count: diff.added })}</span>
                  <span className="font-mono text-red-500">{t('files.lines_deleted', { count: diff.deleted })}</span>
                </div>
                <div className="mt-3 overflow-hidden border border-border bg-muted/10 p-2 font-mono text-[11px] leading-[18px]">
                  {diff.hunks.map((hunk, i) => (
                    <div
                      key={i}
                      className={cn(
                        hunk.type === 'add' && 'text-green-500',
                        hunk.type === 'delete' && 'text-red-500',
                        hunk.type === 'context' && 'text-muted-foreground',
                      )}
                    >
                      {hunk.type === 'add' ? '+ ' : hunk.type === 'delete' ? '- ' : '  '}{hunk.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="border-b border-border/50 px-5 py-4">
              <SectionHeader>{t('files.detail_info')}</SectionHeader>
              <div className="mt-3">
                <KvList items={[
                  { label: t('files.label_path'), value: <span className="truncate font-mono text-[12px]">{node.path}</span> },
                  { label: t('files.label_size'), value: formatSize(node.size) },
                  { label: t('files.label_type'), value: node.mime_type ?? 'unknown' },
                  ...(node.change !== 'unchanged'
                    ? [{ label: t('files.label_change'), value: <span className={cn('font-heading text-[11px] border px-1.5 py-0.5', changeBgColor(node.change))}>{changeLetter(node.change)}</span> }]
                    : []),
                ]} />
              </div>
            </div>

            {/* Context links */}
            {(node.linked_task_id ?? node.linked_run_id) && (
              <div className="border-b border-border/50 px-5 py-4">
                <SectionHeader>{t('files.context')}</SectionHeader>
                <div className="mt-3">
                  <KvList items={[
                    ...(node.linked_task_id ? [{ label: t('files.label_task'), value: <RelationLink label="Promo texty na víkendovú akciu" sublabel={node.linked_task_id} /> }] : []),
                    ...(node.linked_run_id ? [{ label: t('files.label_run'), value: <RelationLink label={node.linked_run_id} /> }] : []),
                    ...(node.path.includes('.worktrees/') ? [
                      { label: t('files.label_worktree'), value: <span className="font-mono text-[12px]">.worktrees/T-151</span> },
                      { label: t('files.label_branch'), value: <span className="font-mono text-[12px]">task/T-151</span> },
                      { label: t('files.label_commit'), value: <span className="font-mono text-[12px]">abc123f</span> },
                    ] : []),
                  ]} />
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="px-5 py-4">
                <SectionHeader>{t('files.detail_history')}</SectionHeader>
                <div className="mt-3 flex flex-col gap-1.5">
                  {history.slice(0, 3).map((commit) => (
                    <div key={commit.hash} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-primary">{commit.hash}</span>
                        <span className="text-[11px] text-muted-foreground">{commit.time}</span>
                      </div>
                      <span className="text-[12px] text-foreground">{commit.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

const RESOURCE_FILTERS: ResourceFilter[] = ['all', 'docs', 'images', 'data']
const RESOURCE_FILTER_KEYS: Record<ResourceFilter, string> = {
  all: 'files.filter_all',
  docs: 'files.filter_docs',
  images: 'files.filter_images',
  data: 'files.filter_data',
}

function matchesResourceFilter(resource: ResourceData, filter: ResourceFilter): boolean {
  if (filter === 'all') return true
  return TYPE_FILTER[resource.type] === filter
}

function flattenTree(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.children) {
      result.push(...flattenTree(node.children))
    }
  }
  return result
}

function FilesPage() {
  const { t } = useTranslation()
  const { path: deepLinkPath, scope: deepLinkScope } = Route.useSearch()

  // Data
  const [resources, setResources] = useState<ResourceData[]>([])
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [codeContent, setCodeContent] = useState<Record<string, string>>({})
  const [diffs, setDiffs] = useState<Record<string, FileDiffInfo>>({})
  const [historyMap, setHistoryMap] = useState<Record<string, FileCommitEntry[]>>({})

  // Workspace tree expansion
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set(['.worktrees', '.worktrees/T-151', 'packages', 'packages/worker', 'packages/worker/src', 'artifacts']),
  )
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true)

  // Selection
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  // Track whether deep-link has been applied (so it fires once after data loads)
  const [deepLinkApplied, setDeepLinkApplied] = useState(false)

  // Filters / search
  const [activeFilter, setActiveFilter] = useState<ResourceFilter>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getResources().then((res) => {
      setResources(res)
      // Only auto-select first company file when there is no deep-link
      if (!deepLinkPath && deepLinkScope !== 'workspace' && res.length > 0) {
        setSelected({ kind: 'company-file', resource: res[0] })
      }
    })
  }, [deepLinkPath, deepLinkScope])
  useEffect(() => { getWorkspaceTree().then(setTree) }, [])

  // Lazy-load code/diff/history for selected workspace file
  const selectedWsPath = useMemo(() => {
    if (selected?.kind === 'workspace-file') return selected.path
    return null
  }, [selected])

  useEffect(() => {
    if (!selectedWsPath) return
    if (!(selectedWsPath in codeContent)) {
      getFileCode(selectedWsPath).then((code) => {
        if (code !== null) setCodeContent((prev) => ({ ...prev, [selectedWsPath]: code }))
      })
    }
    if (!(selectedWsPath in diffs)) {
      getFileDiff(selectedWsPath).then((diff) => {
        if (diff !== null) setDiffs((prev) => ({ ...prev, [selectedWsPath]: diff }))
      })
    }
    if (!(selectedWsPath in historyMap)) {
      getFileHistory(selectedWsPath).then((history) => {
        if (history.length > 0) setHistoryMap((prev) => ({ ...prev, [selectedWsPath]: history }))
      })
    }
  }, [selectedWsPath])

  // Apply deep-link once tree is loaded
  useEffect(() => {
    if (deepLinkApplied || tree.length === 0) return
    if (!deepLinkPath) return
    // Expand parent dirs so the target file is visible
    const parts = deepLinkPath.split('/')
    const dirsToExpand: string[] = []
    for (let i = 1; i < parts.length; i++) {
      dirsToExpand.push(parts.slice(0, i).join('/'))
    }
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      for (const d of dirsToExpand) next.add(d)
      return next
    })
    setWorkspaceExpanded(true)
    const node = findNode(tree, deepLinkPath)
    if (node && node.type !== 'directory' && node.type !== 'worktree-root') {
      setSelected({ kind: 'workspace-file', path: deepLinkPath })
    }
    setDeepLinkApplied(true)
  }, [deepLinkPath, deepLinkApplied, tree])

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // Filtered company resources
  const filteredResources = useMemo(() => {
    let items = resources.filter((r) => matchesResourceFilter(r, activeFilter))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(
        (r) => r.filename.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q),
      )
    }
    return items
  }, [resources, activeFilter, search])

  // Filtered workspace files (flat search when searching)
  const filteredWsNodes = useMemo(() => {
    if (!search.trim()) return tree
    const q = search.trim().toLowerCase()
    return flattenTree(tree).filter((n) => n.name.toLowerCase().includes(q))
  }, [tree, search])

  const selectedWsNode = useMemo(() => {
    if (selected?.kind === 'workspace-file') return findNode(tree, selected.path)
    return null
  }, [selected, tree])

  const selectedResourceItem = selected?.kind === 'company-file' ? selected.resource : null

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
              {/* Filters */}
              <div className="mt-2 flex flex-wrap gap-1">
                {RESOURCE_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      'font-heading text-[11px] px-2 py-0.5 transition-colors',
                      activeFilter === f
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t(RESOURCE_FILTER_KEYS[f])}
                  </button>
                ))}
              </div>
            </>
          }
        >
          {filteredResources.length === 0 && filteredWsNodes.length === 0 ? (
            <EmptyState title={t('files.empty_title')} description={t('files.empty_desc')} />
          ) : (
            <>
              {/* Company files section */}
              {filteredResources.length > 0 && (
                <>
                  <ScopeHeader
                    title={t('files.scope_company')}
                    description={t('files.scope_company_desc')}
                  />
                  {filteredResources.map((resource) => {
                    const Icon = fileIcon(resource.filename)
                    return (
                      <FileRow
                        key={resource.id}
                        icon={Icon}
                        name={resource.filename}
                        sublabel={resource.description ?? resource.type}
                        metaRight={
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-[11px] text-muted-foreground">{resource.size}</span>
                            <StatusPill
                              status={STATUS_PILL_MAP[resource.status]}
                              label={t(STATUS_I18N[resource.status])}
                              pulse={resource.status === 'processing'}
                            />
                          </div>
                        }
                        selected={selected?.kind === 'company-file' && selected.resource.id === resource.id}
                        onClick={() => setSelected({ kind: 'company-file', resource })}
                      />
                    )
                  })}
                </>
              )}

              {/* Task files section — collapsible */}
              {tree.length > 0 && (
                <>
                  <ScopeHeader
                    title={t('files.scope_workspace')}
                    description={t('files.scope_workspace_desc')}
                    collapsible
                    expanded={workspaceExpanded}
                    onToggle={() => setWorkspaceExpanded((v) => !v)}
                  />
                  {workspaceExpanded && (search.trim() ? filteredWsNodes : tree).map((node) => (
                    <WsFileRow
                      key={node.path}
                      node={node}
                      depth={0}
                      expandedDirs={expandedDirs}
                      selectedPath={selected?.kind === 'workspace-file' ? selected.path : null}
                      onToggle={toggleDir}
                      onSelect={(path) => {
                        const n = findNode(tree, path)
                        if (!n) return
                        const isDir = n.type === 'directory' || n.type === 'worktree-root'
                        if (!isDir) setSelected({ kind: 'workspace-file', path })
                      }}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ListPanel>
      }
      detail={
        selectedResourceItem ? (
          <CompanyDetail resource={selectedResourceItem} />
        ) : selectedWsNode ? (
          <WorkspaceDetail
            node={selectedWsNode}
            codeContent={codeContent}
            diffs={diffs}
            historyMap={historyMap}
          />
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
