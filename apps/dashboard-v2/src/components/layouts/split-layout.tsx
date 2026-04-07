import type { ReactNode } from "react"
import { SecondarySidebar } from "./secondary-sidebar"

interface SplitLayoutProps {
  sidebar: ReactNode
  sidebarTitle?: string
  children: ReactNode
}

export function SplitLayout({
  sidebar,
  sidebarTitle,
  children,
}: SplitLayoutProps): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0">
      <SecondarySidebar title={sidebarTitle}>{sidebar}</SecondarySidebar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">{children}</div>
    </div>
  )
}
