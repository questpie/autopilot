import { Skeleton } from "@/components/feedback/skeleton"

/** 3 card skeletons for the alerts section. */
export function AlertsSkeleton() {
  return (
    <section className="flex flex-col">
      <Skeleton className="mb-3 h-3 w-40" />
      <div className="flex flex-col border border-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 border-b border-border p-3 last:border-b-0"
          >
            <Skeleton className="h-[18px] w-[18px] shrink-0" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-7 w-14" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** 6 card skeletons for the agents section. */
export function AgentsSkeleton() {
  return (
    <section className="flex flex-col">
      <Skeleton className="mb-3 h-3 w-24" />
      <div className="hidden flex-col gap-0 md:flex">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border border-border p-3"
          >
            <Skeleton className="h-[10px] w-[10px] shrink-0" />
            <div className="flex flex-1 flex-col gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 overflow-hidden md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-[160px] shrink-0 border border-border p-3">
            <Skeleton className="mb-1 h-4 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </section>
  )
}

/** 4 card skeletons for the pins section. */
export function PinsSkeleton() {
  return (
    <section className="flex flex-col">
      <Skeleton className="mb-3 h-3 w-20" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 border border-border p-3">
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 shrink-0" />
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            <Skeleton className="h-2 w-24" />
          </div>
        ))}
      </div>
    </section>
  )
}

/** 5 row skeletons for the activity section. */
export function ActivitySkeleton() {
  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between pb-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="border border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
          >
            <Skeleton className="h-3 w-10 shrink-0" />
            <Skeleton className="h-3 w-12 shrink-0" />
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </section>
  )
}

/** Full dashboard page skeleton. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <AlertsSkeleton />
      <AgentsSkeleton />
      <PinsSkeleton />
      <ActivitySkeleton />
    </div>
  )
}
