import { create } from "zustand"

interface ReplyingTo {
  messageId: string
  senderName: string
  content: string
}

interface ThreadTarget {
  messageId: string
  channelId: string
}

interface ChatUIState {
  activeChannelId: string | null
  setActiveChannelId: (id: string | null) => void

  drafts: Record<string, string>
  setDraft: (channelId: string, text: string) => void
  clearDraft: (channelId: string) => void

  /** Reply-in-place: sets the message being replied to */
  replyingTo: ReplyingTo | null
  setReplyingTo: (msg: ReplyingTo | null) => void
  clearReplyingTo: () => void

  /** Thread panel: which message's thread is open */
  threadTarget: ThreadTarget | null
  openThread: (target: ThreadTarget) => void
  closeThread: () => void

  /** Editing state: which message is being edited inline */
  editingMessageId: string | null
  setEditingMessageId: (id: string | null) => void

  /** Delete confirmation dialog */
  deletingMessageId: string | null
  setDeletingMessageId: (id: string | null) => void

  /** Pinned messages panel open */
  pinnedPanelOpen: boolean
  setPinnedPanelOpen: (open: boolean) => void
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

  replyingTo: null,
  setReplyingTo: (msg) => set({ replyingTo: msg }),
  clearReplyingTo: () => set({ replyingTo: null }),

  threadTarget: null,
  openThread: (target) => set({ threadTarget: target }),
  closeThread: () => set({ threadTarget: null }),

  editingMessageId: null,
  setEditingMessageId: (id) => set({ editingMessageId: id }),

  deletingMessageId: null,
  setDeletingMessageId: (id) => set({ deletingMessageId: id }),

  pinnedPanelOpen: false,
  setPinnedPanelOpen: (open) => set({ pinnedPanelOpen: open }),
}))
