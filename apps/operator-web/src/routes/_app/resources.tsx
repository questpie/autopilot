import { useState, useMemo, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { FlatList } from '@/components/ui/flat-list'
import { SectionHeader } from '@/components/ui/section-header'
import { KvList } from '@/components/ui/kv-list'
import { RelationLink } from '@/components/ui/relation-link'
import { StatusPill } from '@/components/ui/status-pill'
import { EmptyState } from '@/components/empty-state'
import { getResources } from '@/api/resources.api'
import type {
  ResourceData,
  ResourceType,
  ResourceStatus,
} from '@/api/resources.api'

// --- Types ---

type ResourceFilter = 'all' | 'docs' | 'images' | 'data' | 'unassigned'

// Resource with UI-only preview field, composed from ResourceData
interface Resource extends ResourceData {
  preview: React.ReactNode | null
}

// --- Constants ---

const TYPE_ICONS: Record<ResourceType, string> = {
  PDF: '\u{1F4C4}',
  MD: '\u{1F4C4}',
  XLSX: '\u{1F4CA}',
  CSV: '\u{1F4CA}',
  ZIP: '\u{1F4C4}',
  PNG: '\u{1F5BC}',
}

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

// --- Preview renderers (UI-only, keyed by resource id) ---

const PREVIEW_RENDERERS: Record<string, () => React.ReactNode> = {
  r1: () => (
    <div className="space-y-2 bg-muted/30 p-4 font-mono text-[12px] text-muted-foreground">
      <p className="font-medium text-foreground">Jarn\u00e9 menu 2026</p>
      <div className="space-y-1">
        <p>Avok\u00e1dov\u00fd toast s vajcom .......... 8,90 \u20ac</p>
        <p>Matcha latte ........................ 4,50 \u20ac</p>
        <p>A\u00e7a\u00ed bowl .......................... 9,20 \u20ac</p>
        <p>Banana bread ....................... 3,80 \u20ac</p>
        <p>Flat white ......................... 3,60 \u20ac</p>
      </div>
      <p className="text-[11px]">Alerg\u00e9ny: 1, 3, 7, 8</p>
    </div>
  ),
  r2: () => (
    <div className="space-y-2 bg-muted/30 p-4 font-mono text-[12px] text-muted-foreground">
      <p className="font-medium text-foreground">Brand Guidelines v3</p>
      <p>Prim\u00e1rna farba: #2D5A3D</p>
      <p>Sekund\u00e1rna farba: #F5E6D3</p>
      <p>Font: Inter, fallback sans-serif</p>
    </div>
  ),
  r3: () => (
    <div className="space-y-1.5 bg-muted/30 p-4 text-[12px] text-muted-foreground">
      <p className="font-medium text-foreground">O n\u00e1s</p>
      <p>
        Kavi\u00e1re\u0148 Slnie\u010dnica je rodinn\u00e1 kavi\u00e1re\u0148 v centre Bratislavy. Od roku 2018 pon\u00fakame
        v\u00fdberov\u00fa k\u00e1vu, denn\u00e9 menu a priestor pre komunitn\u00e9 podujatia.
      </p>
    </div>
  ),
  r4: () => (
    <div className="overflow-x-auto bg-muted/30 p-4">
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="border-b border-border/50 text-left text-muted-foreground">
            <th className="pb-1.5 pr-4">Polo\u017eka</th>
            <th className="pb-1.5 pr-4">Cena</th>
            <th className="pb-1.5">Kateg\u00f3ria</th>
          </tr>
        </thead>
        <tbody className="text-foreground">
          <tr className="border-b border-border/30">
            <td className="py-1 pr-4">Espresso</td>
            <td className="py-1 pr-4">2,40 \u20ac</td>
            <td className="py-1">K\u00e1va</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-1 pr-4">Flat white</td>
            <td className="py-1 pr-4">3,60 \u20ac</td>
            <td className="py-1">K\u00e1va</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-1 pr-4">Croissant</td>
            <td className="py-1 pr-4">2,80 \u20ac</td>
            <td className="py-1">Pe\u010divo</td>
          </tr>
          <tr>
            <td className="py-1 pr-4">A\u00e7a\u00ed bowl</td>
            <td className="py-1 pr-4">9,20 \u20ac</td>
            <td className="py-1">{`Ra\u0148ajky`}</td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
  r5: () => (
    <div className="overflow-x-auto bg-muted/30 p-4">
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="border-b border-border/50 text-left text-muted-foreground">
            <th className="pb-1.5 pr-4">N\u00e1zov</th>
            <th className="pb-1.5 pr-4">Kontakt</th>
            <th className="pb-1.5">Kateg\u00f3ria</th>
          </tr>
        </thead>
        <tbody className="text-foreground">
          <tr className="border-b border-border/30">
            <td className="py-1 pr-4">Coffee Import s.r.o.</td>
            <td className="py-1 pr-4">info@coffeeimport.sk</td>
            <td className="py-1">K\u00e1va</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-1 pr-4">BIO Farm\u00e1r</td>
            <td className="py-1 pr-4">objednavky@biofarmar.sk</td>
            <td className="py-1">Potraviny</td>
          </tr>
          <tr>
            <td className="py-1 pr-4">Pack &amp; Go</td>
            <td className="py-1 pr-4">info@packgo.sk</td>
            <td className="py-1">Obaly</td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
  r6: () => (
    <div className="flex items-center justify-center bg-muted/30 px-4 py-8 text-[12px] text-muted-foreground">
      Arch\u00edv \u2014 n\u00e1h\u013ead nedostupn\u00fd
    </div>
  ),
  r7: () => (
    <div className="space-y-1.5 bg-muted/30 p-4 text-[12px] text-muted-foreground">
      <p className="font-medium text-foreground">Svadobn\u00e1 sez\u00f3na 2026</p>
      <p>
        Od m\u00e1ja do septembra pon\u00fakame \u0161peci\u00e1lne svadobn\u00e9 bal\u00edky: dezerty na objedn\u00e1vku,
        catering pre mal\u00e9 oslavy, person\u00e1lne ozdoby.
      </p>
    </div>
  ),
}

// Enrich ResourceData from adapter with UI-only preview JSX
function enrichWithPreview(data: ResourceData[]): Resource[] {
  return data.map((d) => ({
    ...d,
    preview: PREVIEW_RENDERERS[d.id] ? PREVIEW_RENDERERS[d.id]() : null,
  }))
}

// --- Filter helpers ---

const FILTER_KEYS: Record<ResourceFilter, string> = {
  all: 'resources.filter_all',
  docs: 'resources.filter_docs',
  images: 'resources.filter_images',
  data: 'resources.filter_data',
  unassigned: 'resources.filter_unassigned',
}

const FILTERS: ResourceFilter[] = ['all', 'docs', 'images', 'data', 'unassigned']

function matchesFilter(resource: Resource, filter: ResourceFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'unassigned') return resource.relations.length === 0
  return TYPE_FILTER[resource.type] === filter
}

// --- Status i18n keys ---

const STATUS_I18N: Record<ResourceStatus, string> = {
  indexed: 'resources.indexed',
  processing: 'resources.processing',
  unprocessed: 'resources.unprocessed',
}

// --- Route ---

export const Route = createFileRoute('/_app/resources')({
  component: ResourcesPage,
})

// --- Page ---

function ResourcesPage() {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeFilter, setActiveFilter] = useState<ResourceFilter>('all')
  const [search, setSearch] = useState('')
  const [resources, setResources] = useState<Resource[]>([])

  // Load resource data from adapter
  useEffect(() => {
    getResources().then((data) => {
      setResources(enrichWithPreview(data))
    })
  }, [])

  const filtered = useMemo(() => {
    let items = resources.filter((r) => matchesFilter(r, activeFilter))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter(
        (r) =>
          r.filename.toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q),
      )
    }
    return items
  }, [resources, activeFilter, search])

  const selected = filtered[selectedIndex] ?? filtered[0] ?? null

  function handleSelect(index: number) {
    setSelectedIndex(index)
  }

  function handleUploadClick() {
    // VFS write endpoint exists but UI file picker is not wired yet.
    // Truthful feedback instead of a dead button.
    alert(t('resources.upload_coming_soon'))
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — resource list */}
      <div className="flex w-[45%] shrink-0 flex-col border-r border-border/50 overflow-hidden">
        <div className="shrink-0 p-6 pb-0">
          <PageHeader
            title={t('resources.title')}
            subtitle={t('resources.subtitle')}
            actions={
              <Button size="sm" onClick={handleUploadClick}>
                {t('resources.upload')}
              </Button>
            }
          />

          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedIndex(0)
              }}
              placeholder={t('resources.search_placeholder')}
              className="h-7 w-full border-b border-border/50 bg-transparent px-0 font-heading text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Filter chips */}
          <div className="mt-3 flex flex-wrap gap-1.5 pb-3">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setActiveFilter(f)
                  setSelectedIndex(0)
                }}
                className={cn(
                  'font-heading text-[11px] px-2 py-0.5 transition-colors',
                  activeFilter === f
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(FILTER_KEYS[f])}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          <FlatList
            items={filtered}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            emptyState={
              <EmptyState
                title={t('resources.empty_title')}
                description={t('resources.empty_desc')}
              />
            }
            renderRow={(resource) => (
              <div className="flex items-center gap-3 px-6 py-2.5">
                <span className="text-[14px] leading-none">{TYPE_ICONS[resource.type]}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {resource.filename}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {resource.type}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {resource.size}
                </span>
                <StatusPill
                  status={STATUS_PILL_MAP[resource.status]}
                  label={t(STATUS_I18N[resource.status])}
                  pulse={resource.status === 'processing'}
                />
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {resource.date}
                </span>
              </div>
            )}
          />
        </div>
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <ResourceDetail resource={selected} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-[13px] text-muted-foreground">{t('resources.select_hint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Detail ---

function ResourceDetail({ resource }: { resource: Resource }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-[18px] font-medium text-foreground">{resource.filename}</h2>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">
            {resource.type} \u00b7 {resource.size} \u00b7 {resource.date}
          </span>
          <StatusPill
            status={STATUS_PILL_MAP[resource.status]}
            label={t(STATUS_I18N[resource.status])}
            pulse={resource.status === 'processing'}
          />
        </div>
      </div>

      {/* Description */}
      {resource.description && (
        <p className="text-[13px] leading-relaxed text-muted-foreground">{resource.description}</p>
      )}

      {/* Preview */}
      {resource.preview && (
        <div>
          <SectionHeader>{t('resources.preview')}</SectionHeader>
          <div className="mt-2">{resource.preview}</div>
        </div>
      )}

      {/* Context */}
      <div>
        <SectionHeader>{t('resources.context')}</SectionHeader>
        <div className="mt-2">
          <KvList
            items={[
              {
                label: t('resources.context_active'),
                value: (
                  <span
                    className={cn(
                      'text-[13px]',
                      resource.contextActive ? 'text-green-500' : 'text-muted-foreground',
                    )}
                  >
                    {resource.contextActive ? '\u00c1no' : 'Nie'}
                  </span>
                ),
              },
              {
                label: t('resources.context_source'),
                value: resource.contextSource,
              },
              ...(resource.contextIndexed
                ? [
                    {
                      label: t('resources.context_indexed'),
                      value: resource.contextIndexed,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </div>

      {/* Where used */}
      {resource.relations.length > 0 && (
        <div>
          <SectionHeader>{t('resources.where_used')}</SectionHeader>
          <div className="mt-2 flex flex-col gap-2">
            {resource.relations.map((rel, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="shrink-0 font-heading text-[11px] text-muted-foreground">
                  {rel.kind}:
                </span>
                <RelationLink label={rel.label} sublabel={rel.sublabel} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Versions */}
      {resource.versions.length > 0 && (
        <div>
          <SectionHeader>{t('resources.versions')}</SectionHeader>
          <div className="mt-2 flex flex-col gap-1">
            {resource.versions.map((v) => (
              <div
                key={v.version}
                className="flex items-baseline gap-2 py-1 text-[12px]"
              >
                <span
                  className={cn(
                    'font-medium',
                    v.current ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  v{v.version}
                  {v.current && (
                    <span className="ml-1 font-heading text-[11px] text-muted-foreground">
                      (aktu\u00e1lna)
                    </span>
                  )}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{v.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
