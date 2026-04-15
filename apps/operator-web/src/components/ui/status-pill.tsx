import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

const statusPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-none px-2 py-0.5 font-mono text-[11px] font-medium',
  {
    variants: {
      status: {
        working: 'bg-info-surface text-info',
        'needs-input': 'bg-warning-surface text-warning',
        done: 'bg-success-surface text-success',
        failed: 'bg-destructive-surface text-destructive',
        pending: 'bg-muted text-foreground-muted',
        draft: 'bg-muted text-foreground-muted',
        blocked: 'bg-destructive-surface text-destructive',
      },
    },
    defaultVariants: {
      status: 'pending',
    },
  },
)

const dotVariants = cva('size-1.5 rounded-full', {
  variants: {
    status: {
      working: 'bg-info',
      'needs-input': 'bg-warning',
      done: 'bg-success',
      failed: 'bg-destructive',
      pending: 'bg-foreground-muted',
      draft: 'bg-foreground-muted',
      blocked: 'bg-destructive',
    },
  },
  defaultVariants: {
    status: 'pending',
  },
})

const I18N_KEYS: Record<StatusPillStatus, string> = {
  working: 'status.working',
  'needs-input': 'status.needs_input',
  done: 'status.done',
  failed: 'status.failed',
  pending: 'status.pending',
  draft: 'status.draft',
  blocked: 'status.blocked',
}

type StatusPillStatus = NonNullable<VariantProps<typeof statusPillVariants>['status']>

interface StatusPillProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  status: StatusPillStatus
  label?: string
  pulse?: boolean
}

function StatusPill({ status, label, pulse, className, ...props }: StatusPillProps) {
  const { t } = useTranslation()

  return (
    <span
      data-slot="status-pill"
      className={cn(statusPillVariants({ status, className }))}
      {...props}
    >
      <span
        className={cn(dotVariants({ status }), pulse && 'animate-pulse')}
        aria-hidden="true"
      />
      {label ?? t(I18N_KEYS[status])}
    </span>
  )
}

export { StatusPill, statusPillVariants }
export type { StatusPillProps, StatusPillStatus }
