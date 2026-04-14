import { File } from '@phosphor-icons/react'
import { KvList } from '@/components/ui/kv-list'
import { DetailSection } from '@/components/ui/detail-section'
import type { RendererProps } from '@/lib/renderer-registry'

export function GenericFallbackRenderer({ item, type }: RendererProps) {
  const frontmatterItems = item.frontmatter
    ? Object.entries(item.frontmatter).map(([key, value]) => ({
        label: key,
        value: (
          <span className="font-mono text-xs text-foreground">
            {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
          </span>
        ),
      }))
    : []

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <DetailSection>
        <div className="flex items-start gap-3">
          <File size={20} weight="regular" className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-medium text-foreground">{item.path}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {type ? type.name : (item.type ?? 'unknown type')}
              {item.size != null && (
                <span className="ml-2">{formatBytes(item.size)}</span>
              )}
            </p>
          </div>
        </div>
      </DetailSection>

      {frontmatterItems.length > 0 && (
        <DetailSection title="Frontmatter">
          <div className="mt-3">
            <KvList items={frontmatterItems} />
          </div>
        </DetailSection>
      )}

      {item.body_preview != null && item.body_preview.length > 0 && (
        <DetailSection title="Preview" last>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-foreground">
            {item.body_preview}
          </pre>
        </DetailSection>
      )}

      {frontmatterItems.length === 0 && (item.body_preview == null || item.body_preview.length === 0) && (
        <DetailSection last>
          <p className="font-mono text-[11px] text-muted-foreground">No preview available.</p>
        </DetailSection>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
