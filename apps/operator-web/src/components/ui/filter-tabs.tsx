import { cn } from '@/lib/utils'

interface FilterTabsProps<T extends string> {
  tabs: readonly T[]
  active: T
  getLabel: (tab: T) => string
  onChange: (tab: T) => void
  className?: string
}

function FilterTabs<T extends string>({
  tabs,
  active,
  getLabel,
  onChange,
  className,
}: FilterTabsProps<T>) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            'font-heading text-[12px] px-2.5 py-1 transition-colors',
            active === tab
              ? 'bg-muted/50 text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {getLabel(tab)}
        </button>
      ))}
    </div>
  )
}

export { FilterTabs }
export type { FilterTabsProps }
