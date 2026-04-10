import { create } from 'zustand'

type SeedAction =
  | 'create_playbook'
  | 'edit_playbook'
  | 'create_integration'
  | 'refine_tone'
  | 'refine_company'
  | 'create_task'

interface ChatSeed {
  action: SeedAction
  /** Human-readable title for the seed thread */
  title: string
  /** AI system context to seed the conversation */
  context: string
  /** Collected wizard fields */
  fields?: Record<string, string>
}

interface ChatSeedState {
  pendingSeed: ChatSeed | null
  setSeed: (seed: ChatSeed) => void
  clearSeed: () => void
}

export const useChatSeedStore = create<ChatSeedState>()((set) => ({
  pendingSeed: null,
  setSeed: (pendingSeed) => set({ pendingSeed }),
  clearSeed: () => set({ pendingSeed: null }),
}))
