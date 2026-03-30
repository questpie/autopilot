import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ErrorBoundary } from "@/components/feedback/error-boundary"
import { dashboardWidgetsQuery } from "./dashboard.queries"
import { WidgetErrorCard } from "./widget-error-card"
import { Skeleton } from "@/components/feedback/skeleton"

import { API_BASE } from "@/lib/api"

const WIDGET_TIMEOUT_MS = 5000

interface WidgetSummary {
  name: string
  description?: string
}

function WidgetSkeleton() {
  return (
    <div className="flex flex-col gap-3 border border-border p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

function WidgetContainer({ widget }: { widget: WidgetSummary }) {
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setHasTimedOut(true)
    }, WIDGET_TIMEOUT_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [retryKey])

  const handleRetry = useCallback(() => {
    setHasTimedOut(false)
    setRetryKey((k) => k + 1)
  }, [])

  // Memoize the lazy component so it's stable across renders
  const WidgetComponent = useMemo(
    () =>
      lazy(async () => {
        try {
          const mod = await import(
            /* @vite-ignore */ `${API_BASE}/fs/dashboard/widgets/${widget.name}/widget.tsx`
          )
          if (timerRef.current) clearTimeout(timerRef.current)
          return { default: mod.default ?? mod.Widget ?? (() => null) }
        } catch (err) {
          if (timerRef.current) clearTimeout(timerRef.current)
          throw err
        }
      }),
    [widget.name, retryKey],
  )

  if (hasTimedOut) {
    return (
      <WidgetErrorCard
        name={widget.name}
        error="Widget took too long to load"
        onRetry={handleRetry}
      />
    )
  }

  return (
    <ErrorBoundary
      fallback={
        <WidgetErrorCard
          name={widget.name}
          error="Widget crashed"
          onRetry={handleRetry}
        />
      }
    >
      <Suspense fallback={<WidgetSkeleton />}>
        <div key={retryKey}>
          <WidgetComponent />
        </div>
      </Suspense>
    </ErrorBoundary>
  )
}

export function WidgetLoader() {
  const { data } = useSuspenseQuery(dashboardWidgetsQuery)

  const widgets = data?.widgets ?? []

  if (widgets.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {widgets.map((widget) => (
        <WidgetContainer key={widget.name} widget={widget} />
      ))}
    </div>
  )
}
