import type { ChatAttachment } from '@/api/types'
import { createContext, useContext } from 'react'

export interface ChatDraftSeed {
	attachments?: ChatAttachment[]
	message?: string
}

interface ChatWorkspaceContextValue {
	open: boolean
	activeSessionId: string | null
	historyOpen: boolean
	draftSeed: ChatDraftSeed | null
	showHistory: () => void
	openSession: (sessionId: string) => void
	openDraftChat: (seed: ChatDraftSeed) => void
	clearDraftChat: () => void
	startNewChat: () => void
	setOpen: (open: boolean) => void
}

export const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(null)

export function useChatWorkspace() {
	const context = useContext(ChatWorkspaceContext)
	if (!context) {
		throw new Error('useChatWorkspace must be used within ChatWorkspaceContext.')
	}
	return context
}
