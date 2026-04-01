import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ChatSeenState {
	seenAtBySessionId: Record<string, string>
	markSessionSeen: (sessionId: string, seenAt?: string) => void
}

export const useChatSeenStore = create<ChatSeenState>()(
	persist(
		(set) => ({
			seenAtBySessionId: {},
			markSessionSeen: (sessionId, seenAt = new Date().toISOString()) =>
				set((state) => {
					const currentSeenAt = state.seenAtBySessionId[sessionId]
					if (currentSeenAt && currentSeenAt >= seenAt) {
						return state
					}

					return {
						seenAtBySessionId: {
							...state.seenAtBySessionId,
							[sessionId]: seenAt,
						},
					}
				}),
		}),
		{
			name: 'questpie-chat-seen-store',
			partialize: (state) => ({
				seenAtBySessionId: state.seenAtBySessionId,
			}),
		},
	),
)
