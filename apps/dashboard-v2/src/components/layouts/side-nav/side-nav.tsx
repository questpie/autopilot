import { Suspense } from "react"
import { DesktopSideNav } from "./desktop-side-nav"
import { MobileSideNav } from "./mobile-side-nav"

/**
 * SideNav composite: renders both desktop sidebar and mobile sheet overlay.
 * Only one is visible at a time based on viewport.
 */
export function SideNav() {
  return (
    <>
      <Suspense fallback={<div className="hidden w-[56px] shrink-0 border-r border-border bg-sidebar md:block" />}>
        <DesktopSideNav />
      </Suspense>
      <MobileSideNav />
    </>
  )
}
