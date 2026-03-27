import { create } from "zustand"

interface TaskUIState {
  /** Currently selected task ID for detail view */
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void

  /** Active filter/view mode */
  viewMode: "list" | "board"
  setViewMode: (mode: "list" | "board") => void
}

export const useTaskUIStore = create<TaskUIState>()((set) => ({
  selectedTaskId: null,
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),

  viewMode: "list",
  setViewMode: (mode) => set({ viewMode: mode }),
}))
