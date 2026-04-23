import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { type ChatDraftSeed, ChatWorkspaceContext } from '@/features/chat/chat-workspace-context'
import { ChatRail } from '@/features/chat/components/chat-rail'
import { useActiveView } from '@/hooks/use-active-view'
import { useHydrateAppPreferences } from '@/hooks/use-app-preferences'
import { useAutoEvents } from '@/hooks/use-auto-events'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { ChatCircle } from '@phosphor-icons/react'
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { CommandPalette, useCommandPaletteShortcut } from './command-palette'
import { LayoutModeContext } from './layout-mode-context'
import { Sidebar } from './sidebar'

/**
 * Layout mode for the main content area.
 *
 * - `wide`      (default) full width, standard padding — tables, dashboards
 * - `default`   max-w-5xl centered — settings, narrow forms
 * - `full`      full width, minimal padding — kanban, calendar
 * - `immersive` no padding — block editor, chat canvas
 */
export type LayoutMode = 'wide' | 'default' | 'full' | 'immersive'

interface ShellLayoutProps {
	children: ReactNode
}

export function ShellLayout({ children }: ShellLayoutProps) {
	useAutoEvents()
	useHydrateAppPreferences()
	const [commandOpen, setCommandOpen] = useState(false)
	const [layoutMode, setLayoutMode] = useState<LayoutMode>('wide')
	const [chatRailOpen, setChatRailOpen] = useState(true)
	const [chatHistoryOpen, setChatHistoryOpen] = useState(false)
	const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null)
	const [chatDraftSeed, setChatDraftSeed] = useState<ChatDraftSeed | null>(null)
	const openCommand = useCallback(() => setCommandOpen(true), [])
	const activeView = useActiveView()
	const isMobile = useIsMobile()
	const showDesktopChatRail = chatRailOpen && !isMobile && activeView !== 'chat'

	const chatWorkspace = {
		open: chatRailOpen,
		activeSessionId: activeChatSessionId,
		historyOpen: chatHistoryOpen,
		draftSeed: chatDraftSeed,
		showHistory: () => {
			setChatRailOpen(true)
			setChatHistoryOpen(true)
		},
		openSession: (sessionId: string) => {
			setChatRailOpen(true)
			setChatHistoryOpen(false)
			setActiveChatSessionId(sessionId)
			setChatDraftSeed(null)
		},
		openDraftChat: (seed: ChatDraftSeed) => {
			setChatRailOpen(true)
			setChatHistoryOpen(false)
			setActiveChatSessionId(null)
			setChatDraftSeed(seed)
		},
		clearDraftChat: () => {
			setChatDraftSeed(null)
		},
		startNewChat: () => {
			setChatRailOpen(true)
			setChatHistoryOpen(false)
			setActiveChatSessionId(null)
			setChatDraftSeed(null)
		},
		setOpen: (open: boolean) => setChatRailOpen(open),
	}

	useCommandPaletteShortcut(openCommand)

	return (
		<ChatWorkspaceContext.Provider value={chatWorkspace}>
			<LayoutModeContext.Provider value={{ setLayoutMode }}>
				<SidebarProvider>
					<Sidebar onSearchOpen={openCommand} />
					<div className="bg-sidebar pt-3 h-dvh w-full">
						<SidebarInset className="flex h-full flex-col overflow-hidden rounded-tl-2xl">
							{showDesktopChatRail ? (
								<div className="flex min-h-0 flex-1 gap-3 pr-2">
									<div className="min-h-0 min-w-0 flex-1">
										<div
											id="main-content"
											className="min-h-0 min-w-0 h-full overflow-y-auto"
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
									</div>
									<aside className="h-full w-[420px] shrink-0 min-w-[360px] max-w-[460px] py-2">
										<ChatRail />
									</aside>
								</div>
							) : (
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
							)}
							{!chatRailOpen && activeView !== 'chat' && (
								<Button
									size="icon-sm"
									variant="outline"
									onClick={() => setChatRailOpen(true)}
									className="absolute bottom-4 right-3 z-40 rounded-full bg-background/92 shadow-xs"
									title="Open chat"
								>
									<ChatCircle size={16} weight="fill" />
								</Button>
							)}
						</SidebarInset>
						{isMobile && activeView !== 'chat' && (
							<Sheet open={chatRailOpen} onOpenChange={setChatRailOpen}>
								<SheetContent
									side="right"
									className="w-full p-0 sm:max-w-md"
									showCloseButton={false}
								>
									<ChatRail />
								</SheetContent>
							</Sheet>
						)}
						<CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
						<Toaster position="bottom-right" />
					</div>
				</SidebarProvider>
			</LayoutModeContext.Provider>
		</ChatWorkspaceContext.Provider>
	)
}
