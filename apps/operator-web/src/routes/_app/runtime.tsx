import { CircleIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'
import { DetailSection } from '@/components/ui/detail-section'
import { useWorkers } from '@/hooks/use-workers'
import type { Worker } from '@/api/types'

export const Route = createFileRoute('/_app/runtime')({
  component: RuntimePage,
})

function StatusDot({ status }: { status: Worker['status'] }) {
  return (
    <CircleIcon
      weight="fill"
      className={cn(
        'size-2.5',
        status === 'online' && 'text-green-500',
        status === 'busy' && 'text-amber-500',
        status === 'offline' && 'text-red-500',
      )}
    />
  )
}

function RuntimePage() {
  const { t } = useTranslation()
  const { data: workers, isLoading: isLoadingWorkers, isError: isWorkersError } = useWorkers()

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Page header */}
      <div className="border-b border-border/50 px-5 py-4">
        <PageHeader title={t('runtime.title')} subtitle={t('runtime.subtitle')} />
      </div>

      {/* Workers */}
      <DetailSection title={t('runtime.workers')}>
        <div className="mt-2 flex flex-col">
          {isLoadingWorkers ? (
            <span className="py-3 text-[13px] text-muted-foreground">{t('runtime.workers_loading')}</span>
          ) : isWorkersError ? (
            <span className="py-3 text-[13px] text-muted-foreground">{t('runtime.workers_error')}</span>
          ) : !workers || workers.length === 0 ? (
            <span className="py-3 text-[13px] text-muted-foreground">{t('runtime.workers_empty')}</span>
          ) : (
            workers.map((worker, i) => (
              <div
                key={worker.id}
                className={cn(
                  'flex items-center gap-3 py-2',
                  i < workers.length - 1 && 'border-b border-border/30',
                )}
              >
                <StatusDot status={worker.status} />
                <span className="flex-1 font-mono text-[13px] text-foreground">
                  {worker.name ?? worker.id}
                </span>
                <span className={cn(
                  'font-heading text-[11px]',
                  worker.status === 'online' && 'text-green-500',
                  worker.status === 'busy' && 'text-amber-500',
                  worker.status === 'offline' && 'text-muted-foreground',
                )}>
                  {t(`runtime.status_${worker.status}`)}
                </span>
                <span className="w-[120px] truncate text-right font-heading text-[11px] text-muted-foreground">
                  {worker.last_heartbeat ?? '—'}
                </span>
              </div>
            ))
          )}
        </div>
      </DetailSection>

      {/* Environment variables */}
      <DetailSection last title={t('runtime.env_vars')}>
        <div className="mt-2 py-3">
          <span className="text-[13px] text-muted-foreground">{t('runtime.env_unavailable')}</span>
        </div>
      </DetailSection>
    </div>
  )
}
