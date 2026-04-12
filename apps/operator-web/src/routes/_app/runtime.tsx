import { GearSixIcon, KeyIcon, CircleIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'

export const Route = createFileRoute('/_app/runtime')({
  component: RuntimePage,
})

// ── View models (read-only status snapshot — not backed by live API yet) ──

type WorkerStatus = 'running' | 'idle' | 'stopped'

interface WorkerEntry {
  id: string
  name: string
  status: WorkerStatus
  uptime: string
}

interface EnvEntry {
  key: string
  masked: string
  set: boolean
}

const WORKER_STATUS: WorkerEntry[] = [
  { id: 'main-orchestrator', name: 'main-orchestrator', status: 'running', uptime: '2d 14h' },
  { id: 'content-worker', name: 'content-worker', status: 'running', uptime: '1d 8h' },
  { id: 'analytics-worker', name: 'analytics-worker', status: 'idle', uptime: '5h 22m' },
  { id: 'notification-worker', name: 'notification-worker', status: 'stopped', uptime: '-' },
]

const ENV_STATUS: EnvEntry[] = [
  { key: 'ANTHROPIC_API_KEY', masked: 'sk-ant-***...***8f2', set: true },
  { key: 'INSTAGRAM_TOKEN', masked: 'IGQ***...***xY', set: true },
  { key: 'SLACK_WEBHOOK_URL', masked: '', set: false },
  { key: 'DATABASE_URL', masked: 'postgres://***:***@***:5432/autopilot', set: true },
]

function StatusDot({ status }: { status: WorkerStatus }) {
  return (
    <CircleIcon
      weight="fill"
      className={cn(
        'size-2.5',
        status === 'running' && 'text-green-500',
        status === 'idle' && 'text-amber-500',
        status === 'stopped' && 'text-red-500',
      )}
    />
  )
}

function RuntimePage() {
  const { t } = useTranslation()
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="flex flex-col gap-8">
        <PageHeader title={t('runtime.title')} subtitle={t('runtime.subtitle')} />

        {/* Workers */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <GearSixIcon className="size-4 text-primary" weight="bold" />
            <h2 className="font-heading text-[13px] font-medium uppercase tracking-wider">{t('runtime.workers')}</h2>
          </div>
          <div className="border border-border bg-card">
            {WORKER_STATUS.map((worker, i) => (
              <div
                key={worker.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  i < WORKER_STATUS.length - 1 && 'border-b border-border',
                )}
              >
                <StatusDot status={worker.status} />
                <span className="flex-1 font-mono text-[13px]">{worker.name}</span>
                <span className="font-heading text-[11px] text-muted-foreground">{worker.status}</span>
                <span className="font-heading text-[11px] text-muted-foreground">{worker.uptime}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Environment variables */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <KeyIcon className="size-4 text-primary" weight="bold" />
            <h2 className="font-heading text-[13px] font-medium uppercase tracking-wider">
              {t('runtime.env_vars')}
            </h2>
          </div>
          <div className="border border-border bg-card">
            {ENV_STATUS.map((entry, i) => (
              <div
                key={entry.key}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  i < ENV_STATUS.length - 1 && 'border-b border-border',
                )}
              >
                <span className="flex-1 font-mono text-[13px]">{entry.key}</span>
                {entry.set ? (
                  <span className="font-mono text-[12px] text-muted-foreground">{entry.masked}</span>
                ) : (
                  <span className="font-heading text-[11px] text-red-400">{t('runtime.not_set')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
