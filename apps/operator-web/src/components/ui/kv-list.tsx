import { cn } from '@/lib/utils'

interface KvItem {
  label: string
  value: React.ReactNode
}

interface KvListProps extends React.ComponentProps<'dl'> {
  items: KvItem[]
}

function KvList({ items, className, ...props }: KvListProps) {
  return (
    <dl
      data-slot="kv-list"
      className={cn('grid gap-y-1.5', className)}
      {...props}
    >
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[110px_1fr] items-baseline gap-x-3">
          <dt className="truncate font-mono text-[11px] text-muted-foreground">
            {item.label}
          </dt>
          <dd className="min-w-0 text-[13px] text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export { KvList }
export type { KvListProps, KvItem }
