import { useState, useEffect } from 'react'
import { m } from 'framer-motion'
import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { StatusPill } from '@/components/ui/status-pill'
import { SectionHeader } from '@/components/ui/section-header'
import { KvList } from '@/components/ui/kv-list'
import { FlatList } from '@/components/ui/flat-list'
import { RelationLink } from '@/components/ui/relation-link'
import { Button } from '@/components/ui/button'
import { getRuns, getRun } from '@/api/runs.api'
import type { Run, Artifact } from '@/api/types'

export const Route = createFileRoute('/_app/results')({
  component: ResultsPage,
})

// ── UI View Models (derived from backend types) ──

type ResultType = 'task' | 'query' | 'automation'
type ResultStatus = 'done' | 'draft'

interface ResultArtifactVM {
  id: string
  filename: string
  type: string
  size: string
  action: 'download' | 'open'
}

interface ResultItem {
  id: string
  run_id: string
  title: string
  subtitle: string
  source_id: string
  type: ResultType
  status: ResultStatus
  task_id: string | null
  agent_id: string
  summary: string
  created_at: string
  completed_at: string | null
  time_display: string
  date_group: 'today' | 'yesterday' | 'last_week'
  artifacts: ResultArtifactVM[]
  tokens: number
  steps: number
  duration: string
  agent_name: string
  thread_name: string
  playbook_name: string | null
}

// ── Transform helpers ──

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '\u2014'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  return `${minutes}m ${remainSeconds}s`
}

function getDateGroup(dateStr: string): 'today' | 'yesterday' | 'last_week' {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (dateDay.getTime() >= today.getTime()) return 'today'
  if (dateDay.getTime() >= yesterday.getTime()) return 'yesterday'
  return 'last_week'
}

function formatTimeDisplay(dateStr: string): string {
  const date = new Date(dateStr)
  const group = getDateGroup(dateStr)
  if (group === 'today' || group === 'yesterday') {
    return date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('sk-SK', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

function artifactFileExtension(mimeType: string | null, title: string): string {
  if (mimeType) {
    if (mimeType.includes('markdown')) return 'MD'
    if (mimeType.includes('csv')) return 'CSV'
    if (mimeType.includes('html')) return 'HTML'
    if (mimeType.includes('pdf')) return 'PDF'
    if (mimeType.includes('plain')) return 'TXT'
  }
  const ext = title.split('.').pop()?.toUpperCase()
  return ext ?? 'FILE'
}

function artifactToVM(artifact: Artifact): ResultArtifactVM {
  const ext = artifactFileExtension(artifact.mime_type, artifact.title)
  return {
    id: artifact.id,
    filename: artifact.title,
    type: ext,
    size: '\u2014', // Size not available from current API
    action: ext === 'HTML' ? 'open' : 'download',
  }
}

function agentIdToName(agentId: string): string {
  // Simple mapping; would be replaced with real agent lookup
  if (agentId.includes('content')) return 'Content Agent'
  if (agentId.includes('analytics')) return 'Analytics Agent'
  if (agentId.includes('report')) return 'Report Agent'
  if (agentId.includes('hr')) return 'HR Agent'
  return 'Agent'
}

function runToResultItem(run: Run, artifacts: Artifact[]): ResultItem {
  const type: ResultType = run.task_id ? 'task' : 'query'
  const sourceId = run.task_id ?? run.id

  return {
    id: run.id,
    run_id: run.id,
    title: run.summary ?? run.id,
    subtitle: run.instructions ?? '',
    source_id: sourceId,
    type,
    status: run.status === 'completed' ? 'done' : 'draft',
    task_id: run.task_id,
    agent_id: run.agent_id,
    summary: run.summary ?? '',
    created_at: run.created_at,
    completed_at: run.ended_at,
    time_display: formatTimeDisplay(run.created_at),
    date_group: getDateGroup(run.created_at),
    artifacts: artifacts.map(artifactToVM),
    tokens: run.tokens_input + run.tokens_output,
    steps: 0, // Not derivable from Run alone
    duration: formatDuration(run.started_at, run.ended_at),
    agent_name: agentIdToName(run.agent_id),
    thread_name: run.summary ?? run.id,
    playbook_name: null,
  }
}

// ── Filter ──

type FilterValue = 'all' | 'task' | 'query' | 'automation'

const FILTER_OPTIONS: { value: FilterValue; i18nKey: string }[] = [
  { value: 'all', i18nKey: 'results.filter_all' },
  { value: 'task', i18nKey: 'results.filter_tasks' },
  { value: 'query', i18nKey: 'results.filter_queries' },
  { value: 'automation', i18nKey: 'results.filter_automations' },
]

function getTypeChipStyle(type: ResultType): string {
  switch (type) {
    case 'task':
      return 'bg-blue-500/10 text-blue-500'
    case 'query':
      return 'bg-green-500/10 text-green-500'
    case 'automation':
      return 'bg-zinc-500/10 text-zinc-400'
  }
}

function getTypeLabel(type: ResultType, t: (key: string) => string): string {
  switch (type) {
    case 'task':
      return t('results.type_task')
    case 'query':
      return t('results.type_query')
    case 'automation':
      return t('results.type_automation')
  }
}

// ── Components ──

function ResultRow({ item, isSelected, t }: { item: ResultItem; isSelected: boolean; t: (key: string) => string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5',
        isSelected && 'bg-muted/30',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-foreground">
            {item.title}
          </span>
          {item.artifacts.length > 0 && (
            <span className="shrink-0 font-heading text-[10px] text-muted-foreground" title={`${item.artifacts.length} artifacts`}>
              {item.artifacts.length}
            </span>
          )}
        </div>
        <span className="truncate text-[12px] text-muted-foreground">
          {item.subtitle}
        </span>
      </div>

      <span className="shrink-0 font-heading text-[11px] font-medium text-muted-foreground">
        {item.source_id}
      </span>

      <span
        className={cn(
          'shrink-0 rounded-none px-1.5 py-0.5 font-heading text-[11px] font-medium',
          getTypeChipStyle(item.type),
        )}
      >
        {getTypeLabel(item.type, t)}
      </span>

      <span className="w-[60px] shrink-0 text-right font-heading text-[11px] text-muted-foreground">
        {item.time_display}
      </span>
    </div>
  )
}

function ResultDetail({ item, t }: { item: ResultItem; t: (key: string) => string }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-medium text-foreground">{item.title}</h2>
          <StatusPill status={item.status} />
        </div>
        <div className="flex items-center gap-3">
          <span className="font-heading text-[11px] text-muted-foreground">
            {item.run_id}
          </span>
          <span className="font-heading text-[11px] text-muted-foreground">
            {item.created_at}
          </span>
        </div>
      </div>

      {/* Provenance */}
      <div className="flex flex-col gap-2">
        <SectionHeader>{t('results.provenance')}</SectionHeader>
        <KvList
          items={[
            {
              label: t('results.prov_mode'),
              value: <RelationLink label={getTypeLabel(item.type, t)} />,
            },
            {
              label: t('results.prov_thread'),
              value: <RelationLink label={item.thread_name} />,
            },
            ...(item.task_id
              ? [{
                  label: t('results.prov_task'),
                  value: <RelationLink label={item.source_id} sublabel={item.title} />,
                }]
              : []),
            {
              label: 'Run',
              value: (
                <span className="font-heading text-[11px] text-muted-foreground">
                  {item.run_id}
                </span>
              ),
            },
            ...(item.playbook_name
              ? [{
                  label: t('results.prov_playbook'),
                  value: <RelationLink label={item.playbook_name} />,
                }]
              : []),
          ]}
        />
      </div>

      {/* Artifacts */}
      <div className="flex flex-col gap-2">
        <SectionHeader>{t('results.artifacts')}</SectionHeader>
        <FlatList
          items={item.artifacts}
          renderRow={(artifact) => (
            <div className="flex items-center gap-3 px-0 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {artifact.filename}
              </span>
              <span className="shrink-0 rounded-none bg-zinc-500/10 px-1.5 py-0.5 font-heading text-[10px] font-medium text-zinc-400">
                {artifact.type}
              </span>
              <span className="w-[50px] shrink-0 text-right font-heading text-[11px] text-muted-foreground">
                {artifact.size}
              </span>
              <Button variant="ghost" size="xs">
                {artifact.action === 'download' ? t('results.download') : t('results.open')}
              </Button>
            </div>
          )}
          emptyState={
            <span className="text-[12px] text-muted-foreground">
              {t('results.no_artifacts')}
            </span>
          }
        />
      </div>

      {/* Run detail */}
      <div className="flex flex-col gap-2">
        <SectionHeader>{t('results.run_detail')}</SectionHeader>
        <KvList
          items={[
            { label: 'Agent', value: item.agent_name },
            { label: t('results.duration'), value: item.duration },
            { label: 'Tokens', value: item.tokens.toLocaleString() },
            { label: t('results.steps'), value: String(item.steps) },
          ]}
        />
        {item.status === 'draft' && (
          <div className="mt-3 flex items-center gap-3 border-t border-border/50 pt-3">
            <span className="text-[12px] text-amber-500">{t('results.awaiting_approval')}</span>
            <div className="flex gap-2">
              <Button size="xs">{t('actions.approve')}</Button>
              <Button variant="ghost" size="xs">{t('results.return')}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Related */}
      <div className="flex flex-col gap-2">
        <SectionHeader>{t('results.related')}</SectionHeader>
        <div className="flex flex-col gap-1">
          {item.type === 'automation' && (
            <RelationLink
              label={t('results.source_schedule')}
              sublabel={item.source_id}
            />
          )}
          <RelationLink
            label={t('results.other_from_source')}
            sublabel={item.source_id}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──

function ResultsPage() {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filter, setFilter] = useState<FilterValue>('all')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])

  // Load completed runs from adapter
  useEffect(() => {
    getRuns({ status: 'completed' }).then((completedRuns) => {
      // For each completed run, fetch its artifacts
      const detailPromises = completedRuns.map((run) =>
        getRun(run.id).then((detail) => {
          if (!detail) return runToResultItem(run, [])
          return runToResultItem(run, detail.artifacts)
        })
      )
      return Promise.all(detailPromises)
    }).then(setResults)
  }, [])

  const filtered = results.filter((r) => {
    if (filter !== 'all' && r.type !== filter) return false
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const selectedItem = filtered[selectedIndex] ?? filtered[0] ?? null

  const todayItems = filtered.filter((r) => r.date_group === 'today')
  const yesterdayItems = filtered.filter((r) => r.date_group === 'yesterday')
  const lastWeekItems = filtered.filter((r) => r.date_group === 'last_week')

  function handleSelect(item: ResultItem) {
    const idx = filtered.indexOf(item)
    if (idx >= 0) setSelectedIndex(idx)
  }

  function renderGroup(label: string, items: ResultItem[]) {
    if (items.length === 0) return null
    return (
      <div className="flex flex-col">
        <div className="px-4 pb-1 pt-3">
          <span className="font-heading text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
            {label}
          </span>
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/20',
              selectedItem?.id === item.id && 'bg-muted/30',
            )}
            onClick={() => handleSelect(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSelect(item)
              }
            }}
            role="button"
            tabIndex={0}
          >
            <ResultRow item={item} isSelected={selectedItem?.id === item.id} t={t} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* Left panel — list */}
      <div className="flex w-1/2 flex-col border-r border-border/50">
        <m.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex flex-col gap-3 p-6 pb-3"
        >
          <m.div variants={staggerItem}>
            <PageHeader
              title={t('results.title')}
              actions={
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setSelectedIndex(0)
                  }}
                  placeholder={t('common.search')}
                  className="h-7 w-48 rounded-none border border-border bg-transparent px-2.5 font-heading text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              }
            />
          </m.div>

          <m.div variants={staggerItem} className="flex gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  'rounded-none px-2.5 py-1 font-heading text-[11px] font-medium transition-colors',
                  filter === opt.value
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  setFilter(opt.value)
                  setSelectedIndex(0)
                }}
              >
                {t(opt.i18nKey)}
              </button>
            ))}
          </m.div>
        </m.div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              title={t('results.empty_title')}
              description={t('results.empty_desc')}
            />
          ) : (
            <m.div variants={staggerContainer} initial="initial" animate="animate">
              <m.div variants={staggerItem}>
                {renderGroup(t('common.today'), todayItems)}
              </m.div>
              <m.div variants={staggerItem}>
                {renderGroup(t('common.yesterday'), yesterdayItems)}
              </m.div>
              <m.div variants={staggerItem}>
                {renderGroup(t('common.last_week'), lastWeekItems)}
              </m.div>
            </m.div>
          )}
        </div>
      </div>

      {/* Right panel — detail */}
      <div className="flex w-1/2 flex-col overflow-y-auto p-6">
        {selectedItem ? (
          <ResultDetail item={selectedItem} t={t} />
        ) : (
          <EmptyState
            title={t('results.empty_title')}
            description={t('results.empty_desc')}
          />
        )}
      </div>
    </div>
  )
}
