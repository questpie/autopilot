import { cn } from '@/lib/utils'

interface FlatListProps<T> extends Omit<React.ComponentProps<'div'>, 'children' | 'onSelect'> {
  items: T[]
  renderRow: (item: T, index: number) => React.ReactNode
  selectedIndex?: number
  onSelect?: (index: number) => void
  emptyState?: React.ReactNode
}

function FlatList<T>({
  items,
  renderRow,
  selectedIndex,
  onSelect,
  emptyState,
  className,
  ...props
}: FlatListProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <div data-slot="flat-list" className={cn('flex flex-col', className)} {...props}>
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            'border-b border-border/50 transition-colors',
            onSelect && 'cursor-pointer hover:bg-muted/20',
            selectedIndex === index && 'bg-muted/30',
          )}
          onClick={onSelect ? () => onSelect(index) : undefined}
          onKeyDown={
            onSelect
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(index)
                  }
                }
              : undefined
          }
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
        >
          {renderRow(item, index)}
        </div>
      ))}
    </div>
  )
}

export { FlatList }
export type { FlatListProps }
