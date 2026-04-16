import { cn } from '@/lib/utils'

interface SectionHeaderProps extends React.ComponentProps<'div'> {
  children: React.ReactNode
  action?: React.ReactNode
}

function SectionHeader({ children, action, className, ...props }: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn(
        'flex items-center justify-between gap-4',
        className,
      )}
      {...props}
    >
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.5px] text-foreground-subtle">
        {children}
      </span>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export { SectionHeader }
export type { SectionHeaderProps }
