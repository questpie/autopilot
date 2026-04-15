import { cva } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const labelVariants = cva('text-[12px]', {
  variants: {
    variant: {
      default: 'text-foreground',
      success: 'text-green-500',
      warning: 'text-amber-500',
      error: 'text-red-500',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

interface TimelineEvent {
  time: string
  label: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error'
}

interface TimelineProps extends React.ComponentProps<'div'> {
  events: TimelineEvent[]
}

function Timeline({ events, className, ...props }: TimelineProps) {
  return (
    <div data-slot="timeline" className={cn('flex flex-col', className)} {...props}>
      {events.map((event, index) => (
        <div
          key={index}
          className="grid grid-cols-[50px_1fr] items-baseline gap-x-3 py-1.5"
        >
          <span className="font-heading text-[11px] text-muted-foreground">
            {event.time}
          </span>
          <span className={labelVariants({ variant: event.variant })}>
            {event.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export { Timeline }
export type { TimelineProps, TimelineEvent }
