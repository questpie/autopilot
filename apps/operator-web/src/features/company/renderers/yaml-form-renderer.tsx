import { KvList } from '@/components/ui/kv-list'
import { DetailSection } from '@/components/ui/detail-section'
import type { RendererProps } from '@/lib/renderer-registry'

function stringifyValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

export function YamlFormRenderer({ item, type }: RendererProps) {
  const name = item.path.split('/').pop() ?? item.path
  const frontmatter = item.frontmatter ?? {}
  const hasBody = item.body_preview != null && item.body_preview.length > 0

  const frontmatterItems = Object.entries(frontmatter).map(([key, value]) => ({
    label: key,
    value: (
      <span className="font-mono text-xs text-foreground">{stringifyValue(value)}</span>
    ),
  }))

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <DetailSection>
        <p className="truncate font-mono text-sm font-medium text-foreground">{name}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {type?.name ?? 'YAML'}
        </p>
      </DetailSection>

      {frontmatterItems.length > 0 && (
        <DetailSection title="Fields" last={!hasBody}>
          <div className="mt-3">
            <KvList items={frontmatterItems} />
          </div>
        </DetailSection>
      )}

      {hasBody && (
        <DetailSection title="Body" last>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-foreground">
            {item.body_preview}
          </pre>
        </DetailSection>
      )}

      {frontmatterItems.length === 0 && !hasBody && (
        <DetailSection last>
          <p className="font-mono text-[11px] text-muted-foreground">No fields available.</p>
        </DetailSection>
      )}
    </div>
  )
}
