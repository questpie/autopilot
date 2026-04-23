import { CaretRight, Eye, ListBullets, SidebarSimple, SquaresFour } from '@phosphor-icons/react'
import { useQueries } from '@tanstack/react-query'
import { vfsList } from '@/api/vfs.api'
import type { VfsListEntry } from '@/api/types'
import { fileIcon } from '@/lib/file-icons'
import { resolveViewer } from '@/lib/viewer-registry'
import { useVfsList, vfsKeys } from '@/hooks/use-vfs'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { setDraggedChatAttachment } from '@/features/chat/lib/chat-dnd'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { InspectorShell } from './inspector-shell'
import { FilesSelectionInspector } from './files-selection-inspector'
import { FilePreviewSurface } from './file-preview-surface'
import {
  buildColumnPaths,
  buildPathSegments,
  buildUri,
  formatBytes,
  getBaseName,
  type FilesLayout,
  type SavedFilesLocation,
} from '../lib/file-paths'

interface DirectoryListingProps {
  path: string | null
  runId: string | null
  layout: FilesLayout
  selectedPath: string | null
  isSelectionPinned: boolean
  onTogglePinned: (location: SavedFilesLocation) => void
  onLayoutChange: (layout: FilesLayout) => void
  onSelectItem: (path: string, type: 'file' | 'directory') => void
  onOpenItem: (path: string | null, type: 'file' | 'directory') => void
}

const LAYOUT_OPTIONS = [
  { value: 'list', label: 'List', icon: ListBullets },
  { value: 'grid', label: 'Grid', icon: SquaresFour },
  { value: 'columns', label: 'Columns', icon: SidebarSimple },
  { value: 'preview', label: 'Preview', icon: Eye },
] as const

interface BreadcrumbNavProps {
  runId: string | null
  path: string | null
  onNavigate: (path: string | null) => void
}

function BreadcrumbNav({ runId, path, onNavigate }: BreadcrumbNavProps) {
  const segments = buildPathSegments(path)
  const rootLabel = runId ? `Run: ${runId.slice(0, 8)}…` : 'Files'

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs text-muted-foreground">
        {segments.length === 0 ? (
          <BreadcrumbItem>
            <BreadcrumbPage className="text-foreground">{rootLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-primary"
                onClick={() => onNavigate(null)}
              >
                {rootLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {segments.map((segment, index) => (
              <div key={segment.path} className="contents">
                <BreadcrumbSeparator className="text-muted-foreground">/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  {index === segments.length - 1 ? (
                    <BreadcrumbPage className="px-1.5 py-0.5 text-foreground">{segment.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="cursor-pointer px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-primary"
                      onClick={() => onNavigate(segment.path)}
                    >
                      {segment.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

interface EntryItemProps {
  entry: VfsListEntry
  runId?: string | null
  selected: boolean
  onSelectItem: (path: string, type: 'file' | 'directory') => void
  onOpenItem: (path: string, type: 'file' | 'directory') => void
}

function EntryRow({ entry, runId, selected, onSelectItem, onOpenItem }: EntryItemProps) {
  const isDirectory = entry.type === 'directory'
  const EntryIcon = fileIcon(entry.name, isDirectory ? 'directory' : 'file')

  return (
    <button
      type="button"
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-[background-color,color]',
        selected ? 'bg-muted text-foreground' : 'hover:bg-muted/70',
      )}
      draggable
      onDragStart={(e) => {
        setDraggedChatAttachment(e.dataTransfer, {
          type: 'ref',
          source: 'drag',
          label: entry.path,
          refType: isDirectory ? 'directory' : 'file',
          refId: entry.path,
          metadata: { view: 'files', path: entry.path, runId },
        })
      }}
      onClick={() => onSelectItem(entry.path, isDirectory ? 'directory' : 'file')}
      onDoubleClick={() => onOpenItem(entry.path, isDirectory ? 'directory' : 'file')}
    >
      <EntryIcon size={16} weight={isDirectory ? 'fill' : 'regular'} className="shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-sm font-medium text-foreground">{entry.name}</span>
      {!isDirectory && entry.size !== undefined ? (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(entry.size)}</span>
      ) : null}
      {isDirectory ? <CaretRight size={16} className="ml-auto shrink-0 text-muted-foreground" /> : null}
    </button>
  )
}

function EntryCard({ entry, runId, selected, onSelectItem, onOpenItem }: EntryItemProps) {
  const isDirectory = entry.type === 'directory'
  const EntryIcon = fileIcon(entry.name, isDirectory ? 'directory' : 'file')

	return (
		<button
			type="button"
			className={cn(
				'flex min-h-32 flex-col items-start gap-3 rounded-lg bg-muted/12 px-4 py-4 text-left transition-[background-color,color,box-shadow] hover:bg-muted/24',
				selected && 'bg-muted/24 shadow-xs',
			)}
			draggable
			onDragStart={(e) => {
				setDraggedChatAttachment(e.dataTransfer, {
					type: 'ref',
					source: 'drag',
					label: entry.path,
					refType: isDirectory ? 'directory' : 'file',
					refId: entry.path,
					metadata: { view: 'files', path: entry.path, runId },
				})
			}}
      onClick={() => onSelectItem(entry.path, isDirectory ? 'directory' : 'file')}
      onDoubleClick={() => onOpenItem(entry.path, isDirectory ? 'directory' : 'file')}
    >
      <EntryIcon size={28} weight={isDirectory ? 'fill' : 'regular'} className="text-muted-foreground" />
      <div className="min-w-0">
        <p className="line-clamp-2 break-words text-sm font-medium text-foreground">{entry.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{isDirectory ? 'Directory' : formatBytes(entry.size)}</p>
      </div>
    </button>
  )
}

function EntryPreviewCard({ entry, selected, onSelectItem, onOpenItem, runId }: EntryItemProps & { runId: string | null }) {
	const isDirectory = entry.type === 'directory'
	const EntryIcon = fileIcon(entry.name, isDirectory ? 'directory' : 'file')
	const viewer = resolveViewer(entry.path, entry.mime_type ?? undefined)
	const uri = buildUri(runId, entry.path)

	return (
		<button
			type="button"
			className={cn(
				'flex min-h-48 flex-col items-start gap-3 overflow-hidden rounded-lg bg-muted/12 px-4 py-4 text-left transition-[background-color,color,box-shadow] hover:bg-muted/24',
				selected && 'bg-muted/24 shadow-xs',
			)}
			draggable
			onDragStart={(e) => {
				setDraggedChatAttachment(e.dataTransfer, {
					type: 'ref',
					source: 'drag',
					label: entry.path,
					refType: isDirectory ? 'directory' : 'file',
					refId: entry.path,
					metadata: { view: 'files', path: entry.path, runId },
				})
			}}
      onClick={() => onSelectItem(entry.path, isDirectory ? 'directory' : 'file')}
      onDoubleClick={() => onOpenItem(entry.path, isDirectory ? 'directory' : 'file')}
    >
			<div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-muted/20">
				{isDirectory ? (
					<EntryIcon size={32} weight="fill" className="text-muted-foreground" />
				) : (
					<FilePreviewSurface
						path={entry.path}
						uri={uri}
						viewerType={viewer.type}
						variant="card"
						fallback={<EntryIcon size={32} weight="regular" className="text-muted-foreground" />}
					/>
				)}
      </div>

      <div className="min-w-0">
        <p className="line-clamp-2 break-words text-sm font-medium text-foreground">{entry.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{isDirectory ? 'Directory' : formatBytes(entry.size)}</p>
      </div>
    </button>
  )
}

function ColumnsView({
  path,
  runId,
  selectedPath,
  onSelectItem,
  onOpenItem,
}: Pick<DirectoryListingProps, 'path' | 'runId' | 'selectedPath' | 'onSelectItem' | 'onOpenItem'>) {
  const columnPaths = buildColumnPaths(path)
  const parts = path?.split('/').filter(Boolean) ?? []

  const columns = useQueries({
    queries: columnPaths.map((columnPath) => {
      const uri = buildUri(runId, columnPath)
      return {
        queryKey: vfsKeys.list(uri),
        queryFn: () => vfsList(uri),
      }
    }),
  })

  return (
		<div className="flex h-full gap-3 overflow-x-auto px-4 py-2">
      {columnPaths.map((columnPath, index) => {
        const result = columns[index]
        const selectedName = index === columnPaths.length - 1
          ? getBaseName(selectedPath)
          : parts[index] ?? null
        const title = index === 0 ? (runId ? `Run ${runId.slice(0, 8)}` : 'Files') : (columnPath?.split('/').pop() ?? 'Directory')

        return (
				<div key={columnPath ?? '__root__'} className="flex h-full w-72 shrink-0 flex-col rounded-xl bg-muted/10 px-2 py-2">
					<div className="px-2 py-1">
						<p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
					</div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {result.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="sm" className="text-muted-foreground" />
                </div>
              ) : result.data?.entries.length ? (
                result.data.entries.map((entry) => {
                  const isDirectory = entry.type === 'directory'
                  const EntryIcon = fileIcon(entry.name, isDirectory ? 'directory' : 'file')
                  const isSelected = entry.name === selectedName

                  return (
                    <button
                      key={entry.path}
                      type="button"
							className={cn(
								'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40',
								isSelected && 'bg-muted/50 text-foreground',
							)}
                      draggable
                      onDragStart={(e) => {
                        setDraggedChatAttachment(e.dataTransfer, {
                          type: 'ref',
                          source: 'drag',
                          label: entry.path,
                          refType: isDirectory ? 'directory' : 'file',
                          refId: entry.path,
                          metadata: { view: 'files', path: entry.path, runId },
                        })
                      }}
                      onClick={() => onSelectItem(entry.path, isDirectory ? 'directory' : 'file')}
                      onDoubleClick={() => onOpenItem(entry.path, isDirectory ? 'directory' : 'file')}
                    >
                      <EntryIcon size={15} weight={isDirectory ? 'fill' : 'regular'} className="shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm text-foreground">{entry.name}</span>
                      {isDirectory ? <CaretRight size={14} className="shrink-0 text-muted-foreground" /> : null}
                    </button>
                  )
                })
              ) : (
                <p className="px-3 py-4 text-sm text-muted-foreground">Empty</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DirectoryListing({
  path,
  runId,
  layout,
  selectedPath,
  isSelectionPinned,
  onTogglePinned,
  onLayoutChange,
  onSelectItem,
  onOpenItem,
}: DirectoryListingProps) {
  const uri = buildUri(runId, path)
  const { data, isLoading } = useVfsList(uri)
  const entries = data?.entries ?? []
  const directoryName = getBaseName(path, runId ? `Run ${runId.slice(0, 8)}` : 'Company files')

  const content = (
    <div className="h-full overflow-y-auto">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="default" className="text-muted-foreground" />
        </div>
      ) : data?.entries.length === 0 ? (
        <EmptyState
          title="No files"
          description="This directory is empty."
          height="h-48"
          className="m-4"
        />
      ) : layout === 'columns' ? (
        <ColumnsView path={path} runId={runId} selectedPath={selectedPath} onSelectItem={onSelectItem} onOpenItem={onOpenItem} />
      ) : layout === 'preview' ? (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <EntryPreviewCard
              key={entry.path}
              entry={entry}
              runId={runId}
              selected={selectedPath === entry.path}
              onSelectItem={onSelectItem}
              onOpenItem={onOpenItem}
            />
          ))}
        </div>
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {entries.map((entry) => (
            <EntryCard
              key={entry.path}
              entry={entry}
              runId={runId}
              selected={selectedPath === entry.path}
              onSelectItem={onSelectItem}
              onOpenItem={onOpenItem}
            />
          ))}
        </div>
      ) : (
        <div>
          {entries.map((entry) => (
            <EntryRow
              key={entry.path}
              entry={entry}
              runId={runId}
              selected={selectedPath === entry.path}
              onSelectItem={onSelectItem}
              onOpenItem={onOpenItem}
            />
          ))}
        </div>
      )}
    </div>
  )

  const toolbar = (
		<div className="flex items-center gap-1 rounded-full bg-muted/20 p-1">
      {LAYOUT_OPTIONS.map((option) => {
        const Icon = option.icon
        return (
          <Button
            key={option.value}
            size="icon-xs"
            variant={layout === option.value ? 'default' : 'ghost'}
            onClick={() => onLayoutChange(option.value)}
            title={option.label}
            className={layout === option.value ? 'shadow-xs' : 'text-muted-foreground'}
          >
            <Icon size={14} />
          </Button>
        )
      })}
    </div>
  )

  return (
    <InspectorShell
      header={
				<div className="space-y-1.5">
					<p className="text-xs font-medium text-muted-foreground">{runId ? 'Run workspace' : 'Files'}</p>
					<h1 className="text-2xl font-semibold text-foreground text-balance">{directoryName}</h1>
					{path ? (
						<BreadcrumbNav
							runId={runId}
							path={path}
							onNavigate={(nextPath) => onOpenItem(nextPath, 'directory')}
						/>
					) : null}
				</div>
      }
      toolbar={toolbar}
      sidebar={
        <FilesSelectionInspector
          currentPath={path}
          selectedPath={selectedPath}
          runId={runId}
          isPinned={isSelectionPinned}
          onOpenSelected={onOpenItem}
          onTogglePinned={onTogglePinned}
        />
      }
      content={content}
    />
  )
}
