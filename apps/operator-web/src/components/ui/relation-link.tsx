import { cn } from '@/lib/utils'

interface RelationLinkProps extends Omit<React.ComponentProps<'button'>, 'children'> {
  label: string
  sublabel?: string
}

function RelationLink({ label, sublabel, className, ...props }: RelationLinkProps) {
  return (
    <button
      type="button"
      data-slot="relation-link"
      className={cn(
        'group inline-flex cursor-pointer flex-col items-start text-left transition-colors hover:text-primary',
        className,
      )}
      {...props}
    >
      <span className="text-[13px] font-medium group-hover:underline">{label}</span>
      {sublabel && (
        <span className="text-[12px] text-muted-foreground">{sublabel}</span>
      )}
    </button>
  )
}

export { RelationLink }
export type { RelationLinkProps }
