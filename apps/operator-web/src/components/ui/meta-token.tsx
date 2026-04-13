import { cn } from '@/lib/utils'

/**
 * MetaToken — small inline chip for type labels, IDs, and meta tokens.
 *
 * Two visual variants:
 *  - "muted"   (default) — filled muted background, mono text — for IDs, source labels
 *  - "outline" — bordered, heading font — for step types, runner labels, color-coded tags
 *
 * Keep this narrow. StatusPill owns semantic status display.
 */

interface MetaTokenProps extends React.ComponentProps<'span'> {
  variant?: 'muted' | 'outline'
  mono?: boolean
}

function MetaToken({ variant = 'muted', mono, className, children, ...props }: MetaTokenProps) {
  return (
    <span
      data-slot="meta-token"
      className={cn(
        'inline-block rounded-none px-1.5 py-0.5',
        variant === 'muted' && [
          'bg-muted/40',
          mono ? 'font-mono text-[11px] text-muted-foreground' : 'font-heading text-[11px] text-muted-foreground',
        ],
        variant === 'outline' && [
          'border',
          mono ? 'font-mono text-[10px]' : 'font-heading text-[10px]',
        ],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { MetaToken }
export type { MetaTokenProps }
