import { Markdown } from '@/components/ui/markdown'
import { DetailSection } from '@/components/ui/detail-section'
import type { RendererProps } from '@/lib/renderer-registry'

export function MarkdownRenderer({ item }: RendererProps) {
  const name = item.path.split('/').pop() ?? item.path
  const content = item.body_preview ?? ''

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <DetailSection>
        <p className="truncate font-mono text-sm font-medium text-foreground">{name}</p>
        {item.size != null && (
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {formatBytes(item.size)}
          </p>
        )}
      </DetailSection>

      <DetailSection last>
        {content.length > 0 ? (
          <Markdown content={content} className="mt-1" />
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">No content preview available.</p>
        )}
      </DetailSection>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
