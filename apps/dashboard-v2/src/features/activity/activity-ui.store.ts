import { create } from "zustand"

interface ActivityUIState {
  filterType: string | null
  setFilterType: (type: string | null) => void

  filterAgentId: string | null
  setFilterAgentId: (id: string | null) => void
}

export const useActivityUIStore = create<ActivityUIState>()((set) => ({
  filterType: null,
  setFilterType: (type) => set({ filterType: type }),

  filterAgentId: null,
  setFilterAgentId: (id) => set({ filterAgentId: id }),
}))
