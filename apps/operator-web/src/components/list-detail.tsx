import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'

interface ListDetailProps {
  /** Left panel content (header + scrollable list) */
  list: React.ReactNode
  /** Right panel content (detail or empty state) */
  detail: React.ReactNode
  /** Default size of list panel in % (default: 40) */
  listSize?: number
  /** Min size of list panel in % (default: 25) */
  listMinSize?: number
  /** Min size of detail panel in % (default: 30) */
  detailMinSize?: number
}

export function ListDetail({
  list,
  detail,
  listSize = 40,
  listMinSize = 25,
  detailMinSize = 30,
}: ListDetailProps) {
  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel defaultSize={listSize} minSize={listMinSize}>
        <div className="flex h-full flex-col overflow-hidden">
          {list}
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={100 - listSize} minSize={detailMinSize}>
        <div className="h-full overflow-y-auto">
          {detail}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export function ListPanel({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="shrink-0 border-b border-border/50 px-5 py-4">
        {header}
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </>
  )
}
