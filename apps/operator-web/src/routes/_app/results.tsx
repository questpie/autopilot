import { useState, useEffect } from 'react'
import { m } from 'framer-motion'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ListDetail, ListPanel } from '@/components/list-detail'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { StatusPill } from '@/components/ui/status-pill'
import { KvList } from '@/components/ui/kv-list'
import { RelationLink } from '@/components/ui/relation-link'
import { Button } from '@/components/ui/button'
import { resultTypeChip } from '@/lib/status-colors'
import { FilterTabs } from '@/components/ui/filter-tabs'
import { MetaToken } from '@/components/ui/meta-token'
import { DetailSection } from '@/components/ui/detail-section'
import { FileViewer } from '@/components/file-viewer'
import { getTasks } from '@/api/tasks.api'
import { useRuns, useRunDetail } from '@/hooks/use-runs'
import type { Run, Artifact, Task } from '@/api/types'

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
  ref_kind: string
  ref_value: string
  mime_type: string | null
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
  scheduled_by: string | null
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

function formatTimeDisplay(dateStr: string, locale: string): string {
  const date = new Date(dateStr)
  const group = getDateGroup(dateStr)
  if (group === 'today' || group === 'yesterday') {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
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
    ref_kind: artifact.ref_kind,
    ref_value: artifact.ref_value,
    mime_type: artifact.mime_type,
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

function runToResultItem(run: Run, artifacts: Artifact[], locale: string): ResultItem {
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
    time_display: formatTimeDisplay(run.created_at, locale),
    date_group: getDateGroup(run.created_at),
    artifacts: artifacts.map(artifactToVM),
    tokens: run.tokens_input + run.tokens_output,
    steps: 0, // Not derivable from Run alone
    duration: formatDuration(run.started_at, run.ended_at),
    agent_name: agentIdToName(run.agent_id),
    thread_name: run.summary ?? run.id,
    scheduled_by: null,
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

function resultTypeBorder(type: ResultType): string {
  switch (type) {
    case 'task':
      return 'border-l-blue-500'
    case 'query':
      return 'border-l-green-500'
    case 'automation':
      return 'border-l-zinc-400'
  }
}

function resultTypeDot(type: ResultType): string {
  switch (type) {
    case 'task':
      return 'bg-blue-500'
    case 'query':
      return 'bg-green-500'
    case 'automation':
      return 'bg-zinc-400'
  }
}

function ResultRow({ item, isSelected, onClick, t }: { item: ResultItem; isSelected: boolean; onClick: () => void; t: (key: string) => string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b border-border/50 border-l-3 px-3 py-2.5 text-left transition-colors',
        resultTypeBorder(item.type),
        isSelected ? 'bg-muted/30' : 'hover:bg-muted/20',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn('mt-[7px] block size-1.5 shrink-0 rounded-full', resultTypeDot(item.type))}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{item.title}</div>
          <div className="truncate text-[12px] text-muted-foreground">{item.subtitle}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span
              className={cn(
                'inline-block rounded-none px-1.5 py-0.5 font-heading text-[10px] font-medium',
                resultTypeChip(item.type),
              )}
            >
              {getTypeLabel(item.type, t)}
            </span>
            {item.artifacts.length > 0 && (
              <span className="font-heading text-[10px] text-muted-foreground/60">
                {item.artifacts.length} artifacts
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="font-heading text-[11px] text-muted-foreground">{item.time_display}</span>
        <span className="font-mono text-[10px] text-muted-foreground/50">{item.run_id.slice(-8)}</span>
      </div>
    </button>
  )
}

// ── Artifact preview row (used in ResultDetail) ──

function ResultArtifactRow({
  artifact,
  t,
}: {
  artifact: ResultArtifactVM
  t: (key: string) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const canPreview = artifact.ref_kind === 'inline' && artifact.ref_value.length > 0

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center gap-3 py-1">
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
          {artifact.filename}
        </span>
        <MetaToken className="shrink-0 bg-zinc-500/10 font-heading text-[10px] font-medium text-zinc-400">
          {artifact.type}
        </MetaToken>
        <span className="w-[50px] shrink-0 text-right font-heading text-[11px] text-muted-foreground">
          {artifact.size}
        </span>
        {canPreview ? (
          <Button variant="ghost" size="xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? t('results.hide_preview') : t('results.preview')}
          </Button>
        ) : (
          <Button variant="ghost" size="xs">
            {artifact.action === 'download' ? t('results.download') : t('results.open')}
          </Button>
        )}
      </div>
      {expanded && canPreview && (
        <div className="overflow-hidden border border-border/50">
          <FileViewer
            path={artifact.filename}
            content={artifact.ref_value}
            mime={artifact.mime_type ?? undefined}
            className="max-h-[300px]"
          />
        </div>
      )}
    </div>
  )
}

function ResultDetail({
  item,
  t,
  approvedIds,
  returnedIds,
  onApprove,
  onReturn,
}: {
  item: ResultItem
  t: (key: string) => string
  approvedIds: Set<string>
  returnedIds: Set<string>
  onApprove: (id: string) => void
  onReturn: (id: string) => void
}) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col">
      {/* Header */}
      <DetailSection>
        <h2 className="text-[18px] font-medium text-foreground">{item.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill status={item.status} />
          <MetaToken mono>{item.run_id}</MetaToken>
          <MetaToken
            className={cn(
              'font-heading text-[10px] font-medium',
              resultTypeChip(item.type),
            )}
          >
            {getTypeLabel(item.type, t)}
          </MetaToken>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{item.subtitle}</p>
      </DetailSection>

      {/* Provenance */}
      <DetailSection title={t('results.provenance')}>
        <div className="mt-3">
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
                    value: <RelationLink
                      label={item.source_id}
                      sublabel={item.title}
                      onClick={() => void navigate({ to: '/tasks', search: { taskId: item.task_id ?? '' } })}
                    />,
                  }]
                : []),
              {
                label: t('results.label_run'),
                value: (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {item.run_id}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </DetailSection>

      {/* Artifacts */}
      <DetailSection title={t('results.artifacts')}>
        <div className="mt-3">
          {item.artifacts.length === 0 ? (
            <span className="text-[12px] text-muted-foreground">
              {t('results.no_artifacts')}
            </span>
          ) : (
            <div className="flex flex-col gap-2">
              {item.artifacts.map((artifact) => (
                <ResultArtifactRow key={artifact.id} artifact={artifact} t={t} />
              ))}
            </div>
          )}
        </div>
      </DetailSection>

      {/* Run detail */}
      <DetailSection title={t('results.run_detail')}>
        <div className="mt-3">
          <KvList
            items={[
              { label: t('results.label_agent'), value: item.agent_name },
              { label: t('results.duration'), value: item.duration },
              { label: t('results.label_tokens'), value: item.tokens.toLocaleString() },
              { label: t('results.steps'), value: String(item.steps) },
            ]}
          />
        </div>
        {item.status === 'draft' && !approvedIds.has(item.id) && !returnedIds.has(item.id) && (
          <div className="mt-4 flex items-center gap-3 border-t border-border/50 pt-4">
            <span className="text-[12px] text-amber-500">{t('results.awaiting_approval')}</span>
            <div className="flex gap-2">
              <Button size="xs" onClick={() => onApprove(item.id)}>{t('actions.approve')}</Button>
              <Button variant="ghost" size="xs" onClick={() => onReturn(item.id)}>{t('results.return')}</Button>
            </div>
          </div>
        )}
        {approvedIds.has(item.id) && (
          <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-4">
            <span className="text-[12px] text-green-500">{'\u2713'} {t('results.approved')}</span>
          </div>
        )}
        {returnedIds.has(item.id) && (
          <div className="mt-4 flex items-center gap-2 border-t border-border/50 pt-4">
            <span className="text-[12px] text-amber-500">{'\u21A9'} {t('results.returned')}</span>
          </div>
        )}
      </DetailSection>

      {/* Related */}
      {(item.scheduled_by ?? item.task_id) && (
        <DetailSection last title={t('results.related')}>
          <div className="mt-3 flex flex-col gap-1">
            {item.scheduled_by && (
              <RelationLink
                label={t('results.source_schedule')}
                sublabel={item.scheduled_by}
                onClick={() => void navigate({ to: '/automations', search: { scheduleId: item.scheduled_by ?? undefined } })}
              />
            )}
            {item.task_id && (
              <RelationLink
                label={t('results.prov_task')}
                sublabel={item.task_id}
                onClick={() => void navigate({ to: '/tasks', search: { taskId: item.task_id ?? '' } })}
              />
            )}
          </div>
        </DetailSection>
      )}
    </div>
  )
}

// ── Main Page ──

function ResultsPage() {
  const { t, i18n: i18nInstance } = useTranslation()
  const locale = i18nInstance.language
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterValue>('all')
  const [search, setSearch] = useState('')
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const [returnedIds, setReturnedIds] = useState<Set<string>>(new Set())
  const [tasks, setTasks] = useState<Task[]>([])

  // Tasks still mock-backed — load once for scheduled_by enrichment
  useEffect(() => {
    getTasks().then(setTasks)
  }, [])

  const { data: runs = [], isLoading } = useRuns({ status: 'completed' })
  const { data: runDetail } = useRunDetail(selectedId)

  // Auto-select first run when list loads
  useEffect(() => {
    if (runs.length > 0 && selectedId === null) {
      setSelectedId(runs[0].id)
    }
  }, [runs, selectedId])

  // Derive ResultItems from runs (no artifacts in list — artifacts load on selection)
  const results: ResultItem[] = runs.map((run) => {
    const item = runToResultItem(run, [], locale)
    if (item.task_id) {
      const task = tasks.find((tk) => tk.id === item.task_id)
      if (task?.scheduled_by) {
        return { ...item, scheduled_by: task.scheduled_by }
      }
    }
    return item
  })

  const filtered = results.filter((r) => {
    if (filter !== 'all' && r.type !== filter) return false
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // For the selected item, merge in artifacts from runDetail when available
  const baseSelectedItem = selectedId
    ? (filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null)
    : (filtered[0] ?? null)

  const selectedItem: ResultItem | null = baseSelectedItem && runDetail
    ? { ...baseSelectedItem, artifacts: runDetail.artifacts.map(artifactToVM) }
    : baseSelectedItem

  const todayItems = filtered.filter((r) => r.date_group === 'today')
  const yesterdayItems = filtered.filter((r) => r.date_group === 'yesterday')
  const lastWeekItems = filtered.filter((r) => r.date_group === 'last_week')

  function renderGroup(label: string, items: ResultItem[]) {
    if (items.length === 0) return null
    return (
      <div className="flex flex-col">
        <div className="px-3 pb-1 pt-3">
          <span className="font-heading text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
            {label}
          </span>
        </div>
        {items.map((item) => (
          <ResultRow
            key={item.id}
            item={item}
            isSelected={selectedItem?.id === item.id}
            onClick={() => setSelectedId(item.id)}
            t={t}
          />
        ))}
      </div>
    )
  }

  return (
    <ListDetail
      listSize={50}
      list={
        <ListPanel
          header={
            <m.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-col gap-3"
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
                      }}
                      placeholder={t('common.search')}
                      className="h-7 w-48 rounded-none border border-border bg-transparent px-2.5 font-heading text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  }
                />
              </m.div>
              <m.div variants={staggerItem}>
                <FilterTabs
                  tabs={FILTER_OPTIONS.map((o) => o.value)}
                  active={filter}
                  getLabel={(value) => t(FILTER_OPTIONS.find((o) => o.value === value)!.i18nKey)}
                  onChange={(value) => {
                    setFilter(value)
                  }}
                />
              </m.div>
            </m.div>
          }
        >
          {isLoading ? (
            <EmptyState
              title={t('results.empty_title')}
              description={t('results.empty_desc')}
            />
          ) : filtered.length === 0 ? (
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
        </ListPanel>
      }
      detail={
        selectedItem ? (
          <ResultDetail
            item={selectedItem}
            t={t}
            approvedIds={approvedIds}
            returnedIds={returnedIds}
            onApprove={(id) => setApprovedIds((prev) => new Set(prev).add(id))}
            onReturn={(id) => setReturnedIds((prev) => new Set(prev).add(id))}
          />
        ) : (
          <EmptyState
            title={t('results.empty_title')}
            description={t('results.empty_desc')}
          />
        )
      }
    />
  )
}
