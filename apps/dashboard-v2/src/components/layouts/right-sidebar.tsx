import { Suspense } from "react"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"
import { useAppStore } from "@/stores/app.store"
import { ChatPanel } from "@/features/chat/chat-panel"
import { QuestPieSpinner } from "@/components/brand"

const SIDEBAR_WIDTH = 360

/**
 * Right sidebar panel (360px on desktop, overlay on tablet).
 * Animated with translateX open/close (300ms/200ms).
 * Delegates rendering to ChatPanel or DetailPanel based on mode.
 */
export function RightSidebar() {
  const rightPanel = useAppStore((s) => s.rightPanel)
  const shouldReduce = useReducedMotion()

  return (
    <AnimatePresence>
      {rightPanel.open && (
        <m.aside
          initial={{ width: shouldReduce ? SIDEBAR_WIDTH : 0, x: shouldReduce ? 0 : SIDEBAR_WIDTH }}
          animate={{ width: SIDEBAR_WIDTH, x: 0 }}
          exit={{ width: shouldReduce ? SIDEBAR_WIDTH : 0, x: shouldReduce ? 0 : SIDEBAR_WIDTH }}
          transition={{
            type: "tween",
            duration: shouldReduce ? 0 : 0.3,
          }}
          className="hidden shrink-0 overflow-hidden border-l border-border bg-background lg:flex lg:flex-col"
        >
          {rightPanel.mode === "chat" && (
            <Suspense fallback={<div className="flex flex-1 items-center justify-center"><QuestPieSpinner size={20} /></div>}>
              <ChatPanel />
            </Suspense>
          )}
        </m.aside>
      )}
    </AnimatePresence>
  )
}
