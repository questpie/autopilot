import { useState, useEffect } from 'react'
import { ArrowUpIcon, PlusIcon, EyeIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { useSession } from '@/hooks/use-session'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getHomeDashboard } from '@/api/home.api'
import type { HomeDashboard } from '@/api/home.api'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

// ── Components ──

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-[11px] uppercase tracking-[0.5px] text-muted-foreground">
      {children}
    </h2>
  )
}

function StatusDot({ status }: { status: 'ready' | 'needs-input' | 'done' }) {
  return (
    <span
      className={cn(
        'mt-1 block size-2 shrink-0 rounded-full',
        status === 'needs-input' && 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]',
        status === 'ready' && 'bg-green-500',
        status === 'done' && 'bg-green-500',
      )}
      aria-hidden="true"
    />
  )
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  view: 'actions.view',
  approve: 'actions.approve',
  change: 'actions.change',
}

function HomePage() {
  const { user } = useSession()
  const { t } = useTranslation()
  const [chatInput, setChatInput] = useState('')
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null)

  useEffect(() => {
    getHomeDashboard().then(setDashboard)
  }, [])

  if (!dashboard) return null

  const attentionCount = dashboard.attention.length

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl p-8">
          <div className="flex flex-col gap-8">
            {/* Greeting */}
            <PageHeader
              title={t('home.greeting', { name: user?.name ?? t('common.user') })}
              subtitle={t('home.attention_count', { count: attentionCount })}
            />

            {/* Waiting for you */}
            <div className="flex flex-col gap-3">
              <SectionLabel>{t('home.waiting_for_you')}</SectionLabel>
              <div className="flex flex-col gap-2">
                {dashboard.attention.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border border-border bg-card p-4',
                      item.status === 'needs-input' && 'border-l-2 border-l-amber-500',
                    )}
                  >
                    <StatusDot status={item.status} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-[13px] text-muted-foreground">{item.description}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.actions.map((action) => (
                        <Button
                          key={action.type}
                          variant="outline"
                          size="sm"
                          className={cn(
                            action.type === 'approve' &&
                              'border-green-500/30 text-green-600 hover:border-green-500 dark:text-green-400',
                            action.type === 'change' &&
                              'border-amber-500/30 text-amber-600 hover:border-amber-500 dark:text-amber-400',
                            action.type === 'view' &&
                              'border-border text-foreground',
                          )}
                        >
                          {action.type === 'view' && <EyeIcon data-icon="inline-start" />}
                          {t(ACTION_LABEL_KEYS[action.type] ?? action.label)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Working on */}
            <div className="flex flex-col gap-3">
              <SectionLabel>{t('home.working_on')}</SectionLabel>
              <div className="flex flex-col gap-1">
                {dashboard.working.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-1 py-2"
                  >
                    <span className="relative flex size-4 shrink-0 items-center justify-center">
                      <span className="absolute inset-0 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </span>
                    <span className="flex-1 text-sm">{item.title}</span>
                    <span className="font-heading text-[11px] text-muted-foreground">
                      {item.elapsed}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recently done */}
            <div className="flex flex-col gap-3">
              <SectionLabel>{t('home.recently_done')}</SectionLabel>
              <div className="flex flex-col gap-2">
                {dashboard.done.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <StatusDot status="done" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-[13px] text-muted-foreground">{item.description}</span>
                    </div>
                    <span className="shrink-0 font-heading text-[11px] text-muted-foreground">
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat input - sticky bottom */}
      <div className="shrink-0 border-t border-border bg-background px-8 py-4">
        <div className="flex max-w-3xl items-center gap-2">
          <Button variant="outline" size="sm">
            <PlusIcon data-icon="inline-start" weight="bold" />
            {t('home.new_task')}
          </Button>
          <div className="flex flex-1 items-center rounded-none border border-border bg-input/30 focus-within:border-primary">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t('home.input_placeholder')}
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center bg-primary text-primary-foreground transition-colors hover:bg-primary/80"
            >
              <ArrowUpIcon weight="bold" className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
