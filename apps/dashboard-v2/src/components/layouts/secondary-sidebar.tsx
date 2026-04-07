import type { ReactNode } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/stores/app.store"

interface SecondarySidebarProps {
  children: ReactNode
  title?: string
  className?: string
}

function renderSidebarTitle(title: string | undefined): React.ReactNode {
  if (!title) {
    return null
  }

  return (
    <div className="px-4 pt-3 pb-1">
      <h2 className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
    </div>
  )
}

export function SecondarySidebar({
  children,
  title,
  className,
}: SecondarySidebarProps): React.JSX.Element {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)

  const content = (
    <>
      {renderSidebarTitle(title)}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">{children}</div>
      </ScrollArea>
    </>
  )

  return (
    <>
      <aside
        className={cn(
          "hidden w-[260px] shrink-0 flex-col border-r border-border bg-background md:flex",
          className,
        )}
        role="complementary"
        aria-label={title ?? "Section navigation"}
      >
        {content}
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[260px] p-0 font-heading" showCloseButton={false}>
          <SheetTitle className="sr-only">{title ?? "Navigation"}</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    </>
  )
}
