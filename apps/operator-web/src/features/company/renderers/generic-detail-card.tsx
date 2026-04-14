import { DetailSection } from '@/components/ui/detail-section'
import { KvList } from '@/components/ui/kv-list'
import { Badge } from '@/components/ui/badge'
import type { RendererProps } from '@/lib/renderer-registry'

type FieldFormat = 'text' | 'number' | 'currency' | 'date' | 'badge'

interface SectionConfig {
  title?: string
  fields: Array<{
    key: string
    label: string
    format?: FieldFormat
  }>
}

function renderFieldValue(raw: unknown, format: FieldFormat): React.ReactNode {
  if (raw == null) {
    return <span className="font-mono text-[11px] text-muted-foreground">—</span>
  }

  if (format === 'badge') {
    return (
      <Badge variant="outline" className="font-mono text-[10px]">
        {String(raw)}
      </Badge>
    )
  }

  if (format === 'date') {
    const d = raw instanceof Date ? raw : new Date(String(raw))
    return (
      <span className="font-mono text-xs text-foreground">
        {isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString()}
      </span>
    )
  }

  if (format === 'currency') {
    const n = Number(raw)
    return (
      <span className="font-mono text-xs text-foreground">
        {isNaN(n) ? String(raw) : n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
      </span>
    )
  }

  if (format === 'number') {
    const n = Number(raw)
    return (
      <span className="font-mono text-xs text-foreground">
        {isNaN(n) ? String(raw) : n.toLocaleString()}
      </span>
    )
  }

  // default: text
  return <span className="font-mono text-xs text-foreground">{String(raw)}</span>
}

function isSectionConfig(v: unknown): v is SectionConfig {
  return typeof v === 'object' && v !== null && 'fields' in v && Array.isArray((v as Record<string, unknown>).fields)
}

export function GenericDetailCardRenderer({ item, type }: RendererProps) {
  const config = type?.renderer?.generic?.config
  const frontmatter = item.frontmatter ?? {}

  // Build sections from config, or fall back to all frontmatter keys in one section
  const sections: SectionConfig[] = []

  if (config != null) {
    const rawSections = config['sections']
    if (Array.isArray(rawSections)) {
      for (const s of rawSections) {
        if (isSectionConfig(s)) {
          sections.push(s)
        }
      }
    }
  }

  // If no sections were configured, derive one from frontmatter
  if (sections.length === 0) {
    const displayColumns = type?.display?.list_columns
    if (displayColumns != null && displayColumns.length > 0) {
      sections.push({
        title: 'Details',
        fields: displayColumns.map((col) => ({
          key: col.key,
          label: col.label,
          format: col.format ?? 'text',
        })),
      })
    } else {
      sections.push({
        title: 'Details',
        fields: Object.keys(frontmatter).map((k) => ({ key: k, label: k, format: 'text' as const })),
      })
    }
  }

  const name = item.path.split('/').pop() ?? item.path

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <DetailSection>
        <p className="truncate font-mono text-sm font-medium text-foreground">{name}</p>
        {type != null && (
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{type.name}</p>
        )}
      </DetailSection>

      {sections.map((section, idx) => {
        const kvItems = section.fields.map((field) => ({
          label: field.label,
          value: renderFieldValue(frontmatter[field.key], field.format ?? 'text'),
        }))

        const isLast = idx === sections.length - 1 && item.body_preview == null

        return (
          <DetailSection key={section.title ?? idx} title={section.title} last={isLast}>
            <div className="mt-3">
              <KvList items={kvItems} />
            </div>
          </DetailSection>
        )
      })}

      {item.body_preview != null && item.body_preview.length > 0 && (
        <DetailSection title="Preview" last>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-foreground">
            {item.body_preview}
          </pre>
        </DetailSection>
      )}
    </div>
  )
}
