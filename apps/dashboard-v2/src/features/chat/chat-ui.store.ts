import { create } from "zustand"

interface ChatUIState {
  activeChannelId: string | null
  setActiveChannelId: (id: string | null) => void

  drafts: Record<string, string>
  setDraft: (channelId: string, text: string) => void
  clearDraft: (channelId: string) => void
}

export const useChatUIStore = create<ChatUIState>()((set) => ({
  activeChannelId: null,
  setActiveChannelId: (id) => set({ activeChannelId: id }),

  drafts: {},
  setDraft: (channelId, text) =>
    set((state) => ({ drafts: { ...state.drafts, [channelId]: text } })),
  clearDraft: (channelId) =>
    set((state) => {
      const { [channelId]: _, ...rest } = state.drafts
      return { drafts: rest }
    }),
}))
