import { DesktopSideNav } from "./desktop-side-nav"
import { MobileSideNav } from "./mobile-side-nav"

/**
 * SideNav composite: renders both desktop sidebar and mobile sheet overlay.
 * Only one is visible at a time based on viewport.
 */
export function SideNav() {
  return (
    <>
      <DesktopSideNav />
      <MobileSideNav />
    </>
  )
}
