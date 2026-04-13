import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { ListDetail, ListPanel } from '@/components/list-detail'
import { KvList } from '@/components/ui/kv-list'
import { RelationLink } from '@/components/ui/relation-link'
import { MetaToken } from '@/components/ui/meta-token'
import { DetailSection } from '@/components/ui/detail-section'
import { useScripts } from '@/hooks/use-scripts'
import { useWorkflows } from '@/hooks/use-workflows'
import type { Script, ScriptRunner, Workflow } from '@/api/types'

const scriptsSearchSchema = z.object({
  scriptId: z.string().optional(),
})

export const Route = createFileRoute('/_app/scripts')({
  component: ScriptsPage,
  validateSearch: (search) => scriptsSearchSchema.parse(search),
})

// ── Helpers ──

const RUNNER_COLORS: Record<ScriptRunner, string> = {
  bun: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  node: 'border-green-500/30 bg-green-500/10 text-green-400',
  python3: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  bash: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  exec: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
}

// ── Script Row ──

function ScriptRow({
  script,
  selected,
  onClick,
}: {
  script: Script
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b border-border/50 border-l-3 border-l-blue-500 px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-muted/30' : 'hover:bg-muted/20',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className="mt-[7px] block size-1.5 shrink-0 rounded-full bg-blue-500"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{script.name}</div>
          <div className="truncate text-[12px] text-muted-foreground">{script.description}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <MetaToken variant="outline" className={RUNNER_COLORS[script.runner]}>
              {script.runner}
            </MetaToken>
            {script.tags.map((tag) => (
              <span key={tag} className="font-heading text-[11px] text-muted-foreground/60">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Script Detail ──

interface ScriptDetailData {
  script: Script
  // FE-derived: workflows whose step actions reference this script by ID
  usedInWorkflows: Workflow[]
}

function ScriptDetail({ data }: { data: ScriptDetailData }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { script, usedInWorkflows } = data

  return (
    <div className="flex flex-col">
      {/* Header */}
      <DetailSection>
        <h2 className="text-[18px] font-medium text-foreground">{script.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MetaToken variant="outline" className={RUNNER_COLORS[script.runner]}>
            {script.runner}
          </MetaToken>
          <MetaToken mono>{script.entry_point}</MetaToken>
        </div>
      </DetailSection>

      {/* Description */}
      <DetailSection title={t('scripts.description')}>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{script.description}</p>
      </DetailSection>

      {/* Inputs */}
      {script.inputs.length > 0 && (
        <DetailSection title={t('scripts.inputs')}>
          <div className="mt-3 flex flex-col">
            {script.inputs.map((input, idx) => (
              <div
                key={input.name}
                className={cn(
                  'flex items-center gap-3 py-2',
                  idx < script.inputs.length - 1 && 'border-b border-border/20',
                )}
              >
                <span className="font-mono text-[12px] font-medium text-foreground">{input.name}</span>
                <MetaToken variant="outline" mono className="border-border/50 text-muted-foreground">
                  {input.type}
                </MetaToken>
                {input.required && (
                  <span className="font-heading text-[10px] text-amber-400">{t('scripts.required')}</span>
                )}
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Outputs */}
      {script.outputs.length > 0 && (
        <DetailSection title={t('scripts.outputs')}>
          <div className="mt-3 flex flex-col">
            {script.outputs.map((output, idx) => (
              <div
                key={output.name}
                className={cn(
                  'flex items-center gap-3 py-2',
                  idx < script.outputs.length - 1 && 'border-b border-border/20',
                )}
              >
                <span className="font-mono text-[12px] font-medium text-foreground">{output.name}</span>
                <MetaToken variant="outline" mono className="border-border/50 text-muted-foreground">
                  {output.type}
                </MetaToken>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Where used — FE-derived from workflow step actions */}
      {usedInWorkflows.length > 0 && (
        <DetailSection title={t('scripts.where_used')}>
          <div className="mt-3 flex flex-col gap-1">
            {usedInWorkflows.map((wf) => (
              <RelationLink
                key={wf.id}
                label={wf.name}
                sublabel={wf.description}
                onClick={() => void navigate({ to: '/workflows', search: { workflowId: wf.id } })}
              />
            ))}
          </div>
        </DetailSection>
      )}

      {/* Sandbox */}
      <DetailSection title={t('scripts.sandbox')}>
        <div className="mt-3">
          <KvList
            items={[
              { label: t('scripts.sandbox_network'), value: script.sandbox.network },
              { label: t('scripts.sandbox_timeout'), value: `${Math.round(script.sandbox.timeout_ms / 1000)}s` },
              { label: t('scripts.sandbox_fs_read'), value: script.sandbox.fs_scope.read.join(', ') || '\u2014' },
              { label: t('scripts.sandbox_fs_write'), value: script.sandbox.fs_scope.write.join(', ') || t('scripts.sandbox_none') },
            ]}
          />
        </div>
      </DetailSection>

      {/* Source file path */}
      <DetailSection title={t('scripts.source_file')}>
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[12px] text-muted-foreground">{script.entry_point}</span>
          <span className="text-[11px] text-muted-foreground/50">
            {t('scripts.source_file_hint')}
          </span>
        </div>
      </DetailSection>

      {/* Metadata */}
      <DetailSection last title={t('scripts.metadata')}>
        <div className="mt-3">
          <KvList
            items={[
              { label: t('scripts.meta_runner'), value: script.runner },
              { label: t('scripts.meta_entry'), value: <span className="font-mono text-[12px]">{script.entry_point}</span> },
              ...(script.tags.length > 0 ? [{ label: t('scripts.meta_tags'), value: script.tags.join(', ') }] : []),
            ]}
          />
        </div>
      </DetailSection>
    </div>
  )
}

// ── Page ──

function ScriptsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: scripts = [], isLoading: isLoadingScripts } = useScripts()
  const { data: workflows = [] } = useWorkflows()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { scriptId: deepLinkScriptId } = Route.useSearch()

  // Auto-select first
  useEffect(() => {
    if (scripts.length === 0) return
    if (selectedId !== null) return
    if (deepLinkScriptId && scripts.some((s) => s.id === deepLinkScriptId)) {
      setSelectedId(deepLinkScriptId)
      return
    }
    setSelectedId(scripts[0].id)
  }, [scripts, selectedId, deepLinkScriptId])

  const selectedScript = selectedId ? (scripts.find((s) => s.id === selectedId) ?? null) : null

  const detailData: ScriptDetailData | null = selectedScript
    ? {
        script: selectedScript,
        // FE-derived: find workflows that reference this script in step actions
        usedInWorkflows: workflows.filter((wf) =>
          wf.steps.some((step) =>
            step.actions.some((a) => {
              if (typeof a !== 'object' || a === null || !('kind' in a) || !('script_id' in a)) return false
              return a.kind === 'script_ref' && a.script_id === selectedScript.id
            }),
          ),
        ),
      }
    : null

  return (
    <ListDetail
      listSize={40}
      list={
        <ListPanel
          header={
            <PageHeader
              title={t('scripts.title')}
              subtitle={t('scripts.subtitle')}
            />
          }
        >
          {isLoadingScripts ? (
            <EmptyState
              title={t('scripts.empty_title')}
              description={t('scripts.empty_desc')}
            />
          ) : scripts.length === 0 ? (
            <EmptyState
              title={t('scripts.empty_title')}
              description={t('scripts.empty_desc')}
            />
          ) : (
            scripts.map((scr) => (
              <ScriptRow
                key={scr.id}
                script={scr}
                selected={scr.id === selectedId}
                onClick={() => { setSelectedId(scr.id); void navigate({ to: '/scripts', search: { scriptId: scr.id }, replace: true }) }}
              />
            ))
          )}
        </ListPanel>
      }
      detail={
        detailData ? (
          <ScriptDetail data={detailData} />
        ) : (
          <EmptyState
            title={t('scripts.select')}
            description={t('scripts.select_desc')}
          />
        )
      }
    />
  )
}
