import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface FilterTabsProps<T extends string> {
	tabs: readonly T[]
	active: T
	getLabel: (tab: T) => string
	getCount?: (tab: T) => number | undefined
	onChange: (tab: T) => void
	variant?: React.ComponentProps<typeof TabsList>['variant']
	className?: string
}

function FilterTabs<T extends string>({
	tabs,
	active,
	getLabel,
	getCount,
	onChange,
	variant = 'default',
	className,
}: FilterTabsProps<T>) {
	return (
		<Tabs value={active} onValueChange={(value) => onChange(value as T)} className={className}>
			<TabsList variant={variant} className="max-w-full justify-start overflow-x-auto">
				{tabs.map((tab) => {
					const count = getCount?.(tab)

					return (
						<TabsTrigger key={tab} value={tab}>
							{getLabel(tab)}
							{count !== undefined && count > 0 ? (
								<Badge
									variant={active === tab ? 'secondary' : 'outline'}
									className="h-4 min-w-4 px-1.5 font-mono tabular-nums"
								>
									{count}
								</Badge>
							) : null}
						</TabsTrigger>
					)
				})}
			</TabsList>
		</Tabs>
	)
}

export { FilterTabs }
export type { FilterTabsProps }
