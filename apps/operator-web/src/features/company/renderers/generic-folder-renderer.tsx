import { CaretRight, Folder, File } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { useItemChildren } from '@/hooks/use-items'
import type { RendererProps, ItemRecord } from '@/lib/renderer-registry'

function formatRelativeTime(mtime: string): string {
  const date = new Date(mtime)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

interface ChildRowProps {
  child: ItemRecord
  navigate: (path: string) => void
}

function ChildRow({ child, navigate }: ChildRowProps) {
  const name = child.path.split('/').pop() ?? child.path
  const Icon = child.is_dir ? Folder : File

  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors hover:bg-muted"
      onClick={() => navigate(child.path)}
    >
      <Icon
        size={16}
        weight={child.is_dir ? 'fill' : 'regular'}
        className="shrink-0 text-muted-foreground"
      />

      <span className="flex-1 truncate font-mono text-sm text-foreground">{name}</span>

      {child.type != null && (
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
          {child.type}
        </Badge>
      )}

      <span className="ml-2 shrink-0 font-mono text-[11px] text-muted-foreground">
        {formatRelativeTime(child.mtime)}
      </span>

      {child.is_dir && (
        <CaretRight size={14} className="ml-1 shrink-0 text-muted-foreground" />
      )}
    </button>
  )
}

export function GenericFolderRenderer({ item, navigate }: RendererProps) {
  const { data, isLoading } = useItemChildren(item.path)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-2.5">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Contents
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-foreground">{item.path}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="default" className="text-muted-foreground" />
          </div>
        ) : data?.items.length === 0 ? (
          <EmptyState title="Empty folder" description="This folder has no items." height="h-48" />
        ) : (
          <div>
            {data?.items.map((child) => (
              <ChildRow key={child.path} child={child} navigate={navigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
