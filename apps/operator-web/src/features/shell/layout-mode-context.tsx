import { createContext, useContext, useEffect } from 'react'
import type { LayoutMode } from './shell-layout'

interface LayoutModeContextValue {
  setLayoutMode: (mode: LayoutMode) => void
}

export const LayoutModeContext = createContext<LayoutModeContextValue | null>(null)

/**
 * Hook used by route-level screen components to declare their preferred layout mode.
 * Must be called inside ShellLayout's tree.
 */
export function useSetLayoutMode(mode: LayoutMode) {
  const ctx = useContext(LayoutModeContext)
  useEffect(() => {
    ctx?.setLayoutMode(mode)
    // When the component unmounts, reset to 'wide'
    return () => ctx?.setLayoutMode('wide')
  }, [ctx, mode])
}
