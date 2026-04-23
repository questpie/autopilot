import { createContext, useContext } from 'react'

interface ChatWorkspaceContextValue {
	open: boolean
	activeSessionId: string | null
	historyOpen: boolean
	showHistory: () => void
	openSession: (sessionId: string) => void
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
