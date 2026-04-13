import { CaretRight } from '@phosphor-icons/react'
import { fileIcon } from '@/lib/file-icons'
import { useVfsList } from '@/hooks/use-vfs'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { VfsListEntry } from '@/api/types'

interface DirectoryListingProps {
  path: string | null
  runId: string | null
  onNavigate: (path: string | null, type: 'file' | 'directory') => void
}

function buildUri(runId: string | null, path: string | null): string {
  if (runId) {
    return path ? `workspace://run/${runId}/${path}` : `workspace://run/${runId}/`
  }
  return path ? `company://${path}` : 'company://.'
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildPathSegments(path: string | null): { label: string; path: string | null }[] {
  if (!path) return []
  const parts = path.split('/').filter(Boolean)
  return parts.map((part, i) => ({
    label: part,
    path: parts.slice(0, i + 1).join('/'),
  }))
}

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
      <BreadcrumbList className="font-mono text-xs">
        {segments.length === 0 ? (
          <BreadcrumbItem>
            <BreadcrumbPage className="text-foreground">{rootLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer text-muted-foreground hover:text-primary px-1.5 py-0.5 transition-colors"
                onClick={() => onNavigate(null)}
              >
                {rootLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {segments.map((seg, i) => (
              <div key={seg.path} className="contents">
                <BreadcrumbSeparator className="text-muted-foreground">/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  {i === segments.length - 1 ? (
                    <BreadcrumbPage className="text-foreground px-1.5 py-0.5">{seg.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="cursor-pointer text-muted-foreground hover:text-primary px-1.5 py-0.5 transition-colors"
                      onClick={() => onNavigate(seg.path)}
                    >
                      {seg.label}
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

interface EntryRowProps {
  entry: VfsListEntry
  onNavigate: (path: string, type: 'file' | 'directory') => void
}

function EntryRow({ entry, onNavigate }: EntryRowProps) {
  const isDirectory = entry.type === 'directory'
  const EntryIcon = fileIcon(entry.name, isDirectory ? 'directory' : 'file')

  return (
    <button
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left',
        'border-b border-border hover:bg-muted transition-colors',
      )}
      onClick={() => onNavigate(entry.path, isDirectory ? 'directory' : 'file')}
    >
      <EntryIcon size={16} weight={isDirectory ? 'fill' : 'regular'} className="shrink-0 text-muted-foreground" />

      <span className="flex-1 truncate font-mono text-sm text-foreground">
        {entry.name}
      </span>

      {!isDirectory && entry.size !== undefined && (
        <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
          {formatBytes(entry.size)}
        </span>
      )}

      {isDirectory && (
        <CaretRight size={16} className="ml-auto shrink-0 text-muted-foreground" />
      )}
    </button>
  )
}


export function DirectoryListing({
  path,
  runId,
  onNavigate,
}: DirectoryListingProps) {
  const uri = buildUri(runId, path)
  const { data, isLoading } = useVfsList(uri)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar: breadcrumb */}
      <div className="shrink-0 border-b border-border px-4 py-3 flex items-center">
        <BreadcrumbNav
          runId={runId}
          path={path}
          onNavigate={(p) => onNavigate(p, 'directory')}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
        ) : (
          <div>
            {data?.entries.map((entry) => (
              <EntryRow key={entry.path} entry={entry} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
