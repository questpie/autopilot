import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { Statusbar } from './statusbar'
import { CommandPalette, useCommandPaletteShortcut } from './command-palette'
import { LayoutModeContext } from './layout-mode-context'
import { useAutoEvents } from '@/hooks/use-auto-events'

/**
 * Layout mode for the main content area.
 *
 * - `wide`      (default) full width, standard padding — tables, dashboards
 * - `default`   max-w-5xl centered — settings, narrow forms
 * - `full`      full width, minimal padding — kanban, calendar
 * - `immersive` no padding — block editor, chat canvas
 */
export type LayoutMode = 'wide' | 'default' | 'full' | 'immersive'

function FloatingSidebarTrigger() {
  const { open } = useSidebar()
  if (open) return null
  return (
    <div className="absolute top-2 left-2 z-50">
      <SidebarTrigger />
    </div>
  )
}

interface ShellLayoutProps {
  children: ReactNode
}

export function ShellLayout({ children }: ShellLayoutProps) {
  useAutoEvents()
  const [commandOpen, setCommandOpen] = useState(false)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('wide')
  const openCommand = useCallback(() => setCommandOpen(true), [])

  useCommandPaletteShortcut(openCommand)

  return (
    <LayoutModeContext.Provider value={{ setLayoutMode }}>
      <SidebarProvider>
        <Sidebar onSearchOpen={openCommand} />
        <SidebarInset className="relative h-dvh overflow-hidden">
          <FloatingSidebarTrigger />
          <div
            id="main-content"
            className="min-h-0 min-w-0 flex-1 overflow-y-auto"
            tabIndex={-1}
          >
            <div
              className={cn(
                'min-w-0 h-full',
                layoutMode === 'default' && 'mx-auto max-w-5xl p-2 md:p-3 lg:p-4',
                layoutMode === 'wide' && 'p-2 md:p-3',
                layoutMode === 'full' && 'p-1 md:p-2',
                layoutMode === 'immersive' && '',
              )}
            >
              {children}
            </div>
          </div>
          <Statusbar />
        </SidebarInset>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        <Toaster position="bottom-right" />
      </SidebarProvider>
    </LayoutModeContext.Provider>
  )
}
