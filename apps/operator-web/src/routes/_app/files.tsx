import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  CaretRightIcon,
  CaretDownIcon,
  ImageIcon,
  FileCodeIcon,
  TableIcon,
  TreeStructureIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { SectionHeader } from '@/components/ui/section-header'
import { KvList } from '@/components/ui/kv-list'
import { RelationLink } from '@/components/ui/relation-link'
import type { FileTreeNode, FileChangeKind } from '@/api/types'
import {
  getWorkspaceTree,
  getFileCode,
  getFileDiff,
  getFileHistory,
} from '@/api/files.api'
import type { FileDiffInfo, FileCommitEntry } from '@/api/files.api'

export const Route = createFileRoute('/_app/files')({
  component: FilesPage,
})

// ── Helpers ──

type Scope = 'all' | 'worktrees' | 'outputs' | 'generated'

function formatSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot) : ''
}

function isCodeFile(name: string): boolean {
  const ext = getFileExtension(name)
  return ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.yaml', '.yml'].includes(ext)
}

function changeLetter(change: FileChangeKind): string | null {
  if (change === 'added') return 'A'
  if (change === 'modified') return 'M'
  if (change === 'deleted') return 'D'
  return null
}

function changeColor(change: FileChangeKind): string {
  if (change === 'added') return 'text-green-500'
  if (change === 'modified') return 'text-amber-500'
  if (change === 'deleted') return 'text-red-500'
  return ''
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

function filterTree(
  nodes: FileTreeNode[],
  searchQuery: string,
  changedOnly: boolean,
  scope: Scope,
): FileTreeNode[] {
  const lowerQuery = searchQuery.toLowerCase()

  function matches(node: FileTreeNode): boolean {
    if (changedOnly && node.type === 'file' && node.change === 'unchanged') return false
    if (lowerQuery && !node.name.toLowerCase().includes(lowerQuery)) {
      // Check if any child matches
      if (node.children) {
        return node.children.some((c) => matches(c) || hasMatchingChild(c))
      }
      return false
    }
    return true
  }

  function hasMatchingChild(node: FileTreeNode): boolean {
    if (!node.children) return false
    return node.children.some((c) => matches(c) || hasMatchingChild(c))
  }

  function filterNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
      .filter((n) => matches(n) || hasMatchingChild(n))
      .map((n) => {
        if (!n.children) return n
        return { ...n, children: filterNodes(n.children) }
      })
  }

  let roots = nodes
  if (scope === 'worktrees') {
    roots = nodes.filter((n) => n.path === '.worktrees')
  } else if (scope === 'outputs' || scope === 'generated') {
    roots = [] // No mock data for these scopes
  }

  return filterNodes(roots)
}

// ── Syntax Highlighting (simple token-based) ──

interface CodeToken {
  text: string
  className: string
}

const KEYWORDS = new Set([
  'import', 'export', 'from', 'function', 'const', 'let', 'var',
  'if', 'else', 'return', 'async', 'await', 'for', 'of', 'in',
  'new', 'type', 'interface', 'extends', 'implements', 'class',
  'default', 'void', 'null', 'undefined', 'true', 'false',
])

const TYPE_NAMES = new Set([
  'Promise', 'string', 'number', 'boolean', 'Set', 'Record',
  'PreviewArtifact', 'WalkOptions', 'Array',
])

function tokenizeLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = []
  let i = 0

  while (i < line.length) {
    // Comment
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.slice(i), className: 'text-muted-foreground italic' })
      break
    }
    // Block comment start
    if (line[i] === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2)
      if (end >= 0) {
        tokens.push({ text: line.slice(i, end + 2), className: 'text-muted-foreground italic' })
        i = end + 2
        continue
      }
      tokens.push({ text: line.slice(i), className: 'text-muted-foreground italic' })
      break
    }
    if (line[i] === '*' && (i === 0 || line.slice(0, i).trim() === '')) {
      // JSDoc line
      tokens.push({ text: line.slice(i), className: 'text-muted-foreground italic' })
      break
    }
    // String (single or double quote or backtick)
    if (line[i] === "'" || line[i] === '"' || line[i] === '`') {
      const quote = line[i]
      let j = i + 1
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++
        j++
      }
      tokens.push({ text: line.slice(i, j + 1), className: 'text-green-500' })
      i = j + 1
      continue
    }
    // Number
    if (/\d/.test(line[i]) && (i === 0 || /[\s(,=+\-*/<>[\]{}:]/.test(line[i - 1]))) {
      let j = i
      while (j < line.length && /[\d._]/.test(line[j])) j++
      tokens.push({ text: line.slice(i, j), className: 'text-amber-500' })
      i = j
      continue
    }
    // Word
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++
      const word = line.slice(i, j)
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, className: 'text-primary' })
      } else if (TYPE_NAMES.has(word)) {
        tokens.push({ text: word, className: 'text-blue-500' })
      } else {
        tokens.push({ text: word, className: '' })
      }
      i = j
      continue
    }
    // Everything else
    tokens.push({ text: line[i], className: '' })
    i++
  }

  return tokens
}

// ── Components ──

function FileIcon({ node }: { node: FileTreeNode }) {
  if (node.type === 'directory') return <FolderIcon className="size-3.5 text-primary/70" weight="bold" />
  if (node.type === 'worktree-root') return <TreeStructureIcon className="size-3.5 text-primary" weight="bold" />
  const ext = getFileExtension(node.name)
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return <FileCodeIcon className="size-3.5 text-muted-foreground" />
  if (['.png', '.jpg', '.svg'].includes(ext)) return <ImageIcon className="size-3.5 text-muted-foreground" />
  if (['.csv'].includes(ext)) return <TableIcon className="size-3.5 text-muted-foreground" />
  return <FileTextIcon className="size-3.5 text-muted-foreground" />
}

function ChangeMarker({ change }: { change: FileChangeKind }) {
  const letter = changeLetter(change)
  if (!letter) return null
  return (
    <span className={cn('font-heading text-[9px] font-bold', changeColor(change))}>
      ({letter})
    </span>
  )
}

function TreeItem({
  node,
  depth,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  node: FileTreeNode
  depth: number
  expanded: boolean
  selected: boolean
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}) {
  const isDir = node.type === 'directory' || node.type === 'worktree-root'
  const hasChildren = Boolean(node.children && node.children.length > 0)

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[12px] transition-colors hover:bg-muted/20',
        selected && 'bg-muted/30',
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={() => {
        if (isDir && hasChildren) onToggle(node.path)
        onSelect(node.path)
      }}
    >
      {isDir && hasChildren ? (
        expanded ? (
          <CaretDownIcon className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <CaretRightIcon className="size-3 shrink-0 text-muted-foreground" />
        )
      ) : (
        <span className="size-3 shrink-0" />
      )}
      {isDir && expanded ? (
        <FolderOpenIcon className="size-3.5 shrink-0 text-primary/70" weight="bold" />
      ) : (
        <FileIcon node={node} />
      )}
      <span className={cn(
        'min-w-0 truncate font-mono',
        node.type === 'worktree-root' && 'font-semibold text-primary',
      )}>
        {node.name}{node.type === 'worktree-root' ? '/' : ''}
      </span>
      <ChangeMarker change={node.change} />
    </button>
  )
}

function TreeView({
  nodes,
  depth,
  expandedDirs,
  selectedPath,
  onToggle,
  onSelect,
}: {
  nodes: FileTreeNode[]
  depth: number
  expandedDirs: Set<string>
  selectedPath: string | null
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}) {
  return (
    <>
      {nodes.map((node) => {
        const isDir = node.type === 'directory' || node.type === 'worktree-root'
        const expanded = expandedDirs.has(node.path)
        return (
          <div key={node.path}>
            <TreeItem
              node={node}
              depth={depth}
              expanded={expanded}
              selected={selectedPath === node.path}
              onToggle={onToggle}
              onSelect={onSelect}
            />
            {isDir && expanded && node.children && (
              <TreeView
                nodes={node.children}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                selectedPath={selectedPath}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function CodeViewer({ code }: { code: string }) {
  const lines = code.split('\n')
  return (
    <div className="overflow-auto font-mono text-[12px] leading-[20px]">
      {lines.map((line, i) => {
        const tokens = tokenizeLine(line)
        return (
          <div key={i} className="flex hover:bg-muted/10">
            <span className="inline-block w-[42px] shrink-0 select-none pr-3 text-right text-muted-foreground/50">
              {i + 1}
            </span>
            <span className="whitespace-pre">
              {tokens.map((token, j) => (
                <span key={j} className={token.className || undefined}>{token.text}</span>
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function DirListing({
  node,
  onSelect,
}: {
  node: FileTreeNode
  onSelect: (path: string) => void
}) {
  const { t } = useTranslation()
  if (!node.children || node.children.length === 0) return null

  return (
    <div className="flex flex-col">
      <div className="border-b border-border px-4 py-2">
        <span className="font-heading text-[11px] uppercase tracking-[0.5px] text-muted-foreground">
          {t('files.dir_contents')}
        </span>
      </div>
      {node.children.map((child) => (
        <button
          key={child.path}
          type="button"
          className="flex items-center gap-3 border-b border-border/50 px-4 py-2 text-left transition-colors hover:bg-muted/20"
          onClick={() => onSelect(child.path)}
        >
          <FileIcon node={child} />
          <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{child.name}</span>
          {child.change !== 'unchanged' && (
            <span className={cn('font-heading text-[10px] border px-1.5 py-0.5', changeBgColor(child.change))}>
              {changeLetter(child.change)}
            </span>
          )}
          <span className="font-heading text-[11px] text-muted-foreground">
            {formatSize(child.size)}
          </span>
        </button>
      ))}
    </div>
  )
}

function CenterPane({
  node,
  codeContent,
  onSelect,
}: {
  node: FileTreeNode | null
  codeContent: Record<string, string>
  onSelect: (path: string) => void
}) {
  const { t } = useTranslation()

  if (!node) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        {t('files.no_preview')}
      </div>
    )
  }

  // Directory
  if (node.type === 'directory' || node.type === 'worktree-root') {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <FileIcon node={node} />
          <span className="font-mono text-[12px] text-muted-foreground">{node.path}/</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <DirListing node={node} onSelect={onSelect} />
        </div>
      </div>
    )
  }

  // Code file
  const code = codeContent[node.path]
  if (code || isCodeFile(node.name)) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="font-mono text-[12px] text-muted-foreground">{node.path}</span>
          <div className="flex items-center gap-3">
            <span className="font-heading text-[11px] text-muted-foreground">{formatSize(node.size)}</span>
            {node.change !== 'unchanged' && (
              <span className={cn('font-heading text-[10px] border px-1.5 py-0.5', changeBgColor(node.change))}>
                {changeLetter(node.change)}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {code ? (
            <CodeViewer code={code} />
          ) : (
            <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">
              {t('files.no_preview')}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
      <FileTextIcon className="size-8" />
      <span className="font-mono text-[13px]">{node.name}</span>
      <span className="text-[12px]">{formatSize(node.size)}</span>
    </div>
  )
}

function RightPane({
  node,
  diffs,
  history: historyMap,
}: {
  node: FileTreeNode | null
  diffs: Record<string, FileDiffInfo>
  history: Record<string, FileCommitEntry[]>
}) {
  const { t } = useTranslation()

  if (!node || node.type === 'directory') {
    return (
      <div className="flex items-center justify-center text-[12px] text-muted-foreground">
        {t('files.no_preview')}
      </div>
    )
  }

  const diff = diffs[node.path]
  const history = historyMap[node.path] ?? []

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-4">
      {/* File info */}
      <div className="flex flex-col gap-2">
        <SectionHeader>{t('files.info')}</SectionHeader>
        <KvList
          items={[
            { label: 'Path', value: <span className="truncate font-mono text-[12px]">{node.path}</span> },
            { label: 'Size', value: formatSize(node.size) },
            { label: 'Type', value: node.mime_type ?? 'unknown' },
            { label: 'Change', value: node.change !== 'unchanged' ? (
              <span className={cn('font-heading text-[11px] border px-1.5 py-0.5', changeBgColor(node.change))}>
                {changeLetter(node.change)}
              </span>
            ) : <span className="text-muted-foreground">—</span> },
          ]}
        />
      </div>

      {/* Diff summary */}
      {diff && (
        <div className="flex flex-col gap-2">
          <SectionHeader>{t('files.diff')}</SectionHeader>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="font-mono text-green-500">{t('files.lines_added', { count: diff.added })}</span>
            <span className="font-mono text-red-500">{t('files.lines_deleted', { count: diff.deleted })}</span>
          </div>
          <div className="overflow-hidden rounded-none border border-border bg-muted/10 p-2 font-mono text-[11px] leading-[18px]">
            {diff.hunks.map((hunk, i) => (
              <div
                key={i}
                className={cn(
                  hunk.type === 'add' && 'text-green-500',
                  hunk.type === 'delete' && 'text-red-500',
                  hunk.type === 'context' && 'text-muted-foreground',
                )}
              >
                {hunk.type === 'add' && '+ '}
                {hunk.type === 'delete' && '- '}
                {hunk.type === 'context' && '  '}
                {hunk.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked context */}
      {(node.linked_task_id || node.linked_run_id) && (
        <div className="flex flex-col gap-2">
          <SectionHeader>{t('files.context')}</SectionHeader>
          <KvList
            items={[
              ...(node.linked_task_id ? [
                {
                  label: 'Task',
                  value: (
                    <RelationLink
                      label="Promo texty na vikendovu akciu"
                      sublabel={node.linked_task_id}
                    />
                  ),
                },
              ] : []),
              ...(node.linked_run_id ? [
                {
                  label: 'Run',
                  value: <RelationLink label={node.linked_run_id} />,
                },
              ] : []),
              ...(node.path.includes('.worktrees/') ? [
                { label: 'Worktree', value: <span className="font-mono text-[12px]">.worktrees/T-151</span> },
                { label: 'Branch', value: <span className="font-mono text-[12px]">task/T-151</span> },
                { label: 'Commit', value: <span className="font-mono text-[12px]">abc123f</span> },
              ] : []),
            ]}
          />
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionHeader>{t('files.history')}</SectionHeader>
          <div className="flex flex-col gap-1.5">
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
    </div>
  )
}

// ── Main Page ──

function FilesPage() {
  const { t } = useTranslation()

  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [codeContent, setCodeContent] = useState<Record<string, string>>({})
  const [diffs, setDiffs] = useState<Record<string, FileDiffInfo>>({})
  const [historyMap, setHistoryMap] = useState<Record<string, FileCommitEntry[]>>({})
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set(['packages', 'packages/worker', 'packages/worker/src', '.worktrees', '.worktrees/T-151'])
  )
  const [selectedPath, setSelectedPath] = useState<string | null>('packages/worker/src/preview.ts')
  const [scope, setScope] = useState<Scope>('all')
  const [changedOnly, setChangedOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Load all file data from adapters
  useEffect(() => {
    getWorkspaceTree().then(setTree)
  }, [])

  // Load code, diff, history for selected file
  useEffect(() => {
    if (!selectedPath) return
    // Only fetch if not already cached
    if (!(selectedPath in codeContent)) {
      getFileCode(selectedPath).then((code) => {
        if (code !== null) {
          setCodeContent((prev) => ({ ...prev, [selectedPath]: code }))
        }
      })
    }
    if (!(selectedPath in diffs)) {
      getFileDiff(selectedPath).then((diff) => {
        if (diff !== null) {
          setDiffs((prev) => ({ ...prev, [selectedPath]: diff }))
        }
      })
    }
    if (!(selectedPath in historyMap)) {
      getFileHistory(selectedPath).then((history) => {
        if (history.length > 0) {
          setHistoryMap((prev) => ({ ...prev, [selectedPath]: history }))
        }
      })
    }
  }, [selectedPath])

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const filteredTree = useMemo(
    () => filterTree(tree, searchQuery, changedOnly, scope),
    [tree, searchQuery, changedOnly, scope],
  )

  const selectedNode = useMemo(
    () => (selectedPath ? findNode(tree, selectedPath) : null),
    [tree, selectedPath],
  )

  const scopes: Array<{ key: Scope; label: string }> = [
    { key: 'all', label: t('files.scope_all') },
    { key: 'worktrees', label: t('files.scope_worktrees') },
    { key: 'outputs', label: t('files.scope_outputs') },
    { key: 'generated', label: t('files.scope_generated') },
  ]

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Left pane: File tree */}
      <div className="flex w-[240px] shrink-0 flex-col border-r border-border">
        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-border px-3 py-3">
          <h2 className="font-heading text-[15px] font-bold tracking-tight">{t('files.title')}</h2>

          {/* Scope chips */}
          <div className="flex flex-wrap gap-1">
            {scopes.map((s) => (
              <button
                key={s.key}
                type="button"
                className={cn(
                  'font-heading text-[10px] px-2 py-0.5 transition-colors',
                  scope === s.key
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setScope(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('files.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/20 py-1 pl-7 pr-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>

          {/* Changed only toggle */}
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 font-heading text-[10px] transition-colors',
              changedOnly ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setChangedOnly(!changedOnly)}
          >
            <span className={cn(
              'size-2.5 rounded-sm border transition-colors',
              changedOnly ? 'border-primary bg-primary' : 'border-muted-foreground/40',
            )} />
            {t('files.changed_only')}
          </button>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          <TreeView
            nodes={filteredTree}
            depth={0}
            expandedDirs={expandedDirs}
            selectedPath={selectedPath}
            onToggle={toggleDir}
            onSelect={setSelectedPath}
          />
        </div>
      </div>

      {/* Center pane: Preview */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <CenterPane node={selectedNode} codeContent={codeContent} onSelect={setSelectedPath} />
      </div>

      {/* Right pane: Metadata */}
      <div className="w-[300px] shrink-0 border-l border-border overflow-hidden">
        <RightPane node={selectedNode} diffs={diffs} history={historyMap} />
      </div>
    </div>
  )
}
