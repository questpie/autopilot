import { cn } from '@/lib/utils'

interface FilterTabsProps<T extends string> {
  tabs: readonly T[]
  active: T
  getLabel: (tab: T) => string
  getCount?: (tab: T) => number | undefined
  onChange: (tab: T) => void
  className?: string
}

function FilterTabs<T extends string>({
  tabs,
  active,
  getLabel,
  getCount,
  onChange,
  className,
}: FilterTabsProps<T>) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {tabs.map((tab) => {
        const count = getCount?.(tab)
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[12px] transition-colors',
              active === tab
                ? 'bg-surface-3 text-foreground'
                : 'text-foreground-muted hover:bg-surface-2 hover:text-foreground',
            )}
          >
            {getLabel(tab)}
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] leading-none tabular-nums',
                  active === tab
                    ? 'bg-surface-4 text-foreground'
                    : 'bg-surface-2 text-foreground-subtle',
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export { FilterTabs }
export type { FilterTabsProps }
