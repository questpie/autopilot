import { create } from "zustand"

interface FileUIState {
  /** Currently expanded directory paths */
  expandedPaths: Set<string>
  togglePath: (path: string) => void

  /** Currently selected file path */
  selectedPath: string | null
  setSelectedPath: (path: string | null) => void
}

export const useFileUIStore = create<FileUIState>()((set) => ({
  expandedPaths: new Set<string>(),
  togglePath: (path) =>
    set((state) => {
      const next = new Set(state.expandedPaths)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedPaths: next }
    }),

  selectedPath: null,
  setSelectedPath: (path) => set({ selectedPath: path }),
}))
