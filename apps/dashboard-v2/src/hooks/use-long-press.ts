import { useRef, useCallback, type PointerEvent } from "react"

interface UseLongPressOptions {
  /** Duration in ms before long-press fires (default: 500) */
  duration?: number
  /** Called when long-press triggers */
  onLongPress: (e: PointerEvent) => void
  /** Called on normal tap/click (optional) */
  onPress?: (e: PointerEvent) => void
}

/**
 * Long-press hook for touch devices.
 * Returns pointer event handlers to spread onto a target element.
 * Fires onLongPress after holding for `duration` ms.
 * Cancels on pointer move (> 10px) or pointer up before threshold.
 */
export function useLongPress({
  duration = 500,
  onLongPress,
  onPress,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      firedRef.current = false
      startPos.current = { x: e.clientX, y: e.clientY }

      timerRef.current = setTimeout(() => {
        firedRef.current = true
        onLongPress(e)
      }, duration)
    },
    [duration, onLongPress],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!timerRef.current) return
      const dx = e.clientX - startPos.current.x
      const dy = e.clientY - startPos.current.y
      // Cancel if moved more than 10px
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        clear()
      }
    },
    [clear],
  )

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      clear()
      if (!firedRef.current && onPress) {
        onPress(e)
      }
    },
    [clear, onPress],
  )

  const onPointerCancel = useCallback(() => {
    clear()
  }, [clear])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }
}
