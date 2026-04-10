import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumb?: BreadcrumbItem[]
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-1.5 flex items-center gap-1 font-heading text-[11px] text-muted-foreground">
            {breadcrumb.map((item, index) => (
              <span key={index} className="inline-flex items-center gap-1">
                {index > 0 && <span aria-hidden="true">/</span>}
                {item.onClick ? (
                  <button
                    type="button"
                    className={cn(
                      'cursor-pointer transition-colors hover:text-foreground',
                    )}
                    onClick={item.onClick}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-heading text-[22px] font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[14px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
