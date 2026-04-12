import { Group, Panel, Separator } from 'react-resizable-panels'
import type { GroupProps, PanelProps, SeparatorProps } from 'react-resizable-panels'
import { cn } from '@/lib/utils'

function ResizablePanelGroup({
  className,
  ...props
}: GroupProps) {
  return (
    <Group
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  )
}

function ResizablePanel(props: PanelProps) {
  return <Panel {...props} />
}

function ResizableHandle({
  className,
  ...props
}: SeparatorProps) {
  return (
    <Separator
      className={cn(
        'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:-left-1 after:-right-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
