import { cn } from "@/lib/utils"

export function ChannelListSkeleton() {
  return (
    <div className="flex flex-col gap-1 py-2">
      {/* Group label skeleton */}
      <div className="px-3 py-2">
        <div className="h-2.5 w-20 animate-pulse bg-muted" />
      </div>
      {/* Channel items */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`ch-${i}`} className="flex items-center gap-2.5 px-3 py-2">
          <div className="size-4 animate-pulse bg-muted" />
          <div className="h-3 flex-1 animate-pulse bg-muted" />
          <div className="h-2 w-8 animate-pulse bg-muted" />
        </div>
      ))}
      {/* DM label skeleton */}
      <div className="px-3 py-2">
        <div className="h-2.5 w-28 animate-pulse bg-muted" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`dm-${i}`} className="flex items-center gap-2.5 px-3 py-2">
          <div className="size-4 animate-pulse bg-muted" />
          <div className="h-3 flex-1 animate-pulse bg-muted" />
          <div className="h-2 w-8 animate-pulse bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function ConversationSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-1 flex-col gap-4 p-4", compact && "p-3 gap-3")}>
      {/* Day divider skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-muted" />
        <div className="h-2.5 w-16 animate-pulse bg-muted" />
        <div className="h-px flex-1 bg-muted" />
      </div>

      {/* Message group 1 */}
      <div className="flex gap-2.5">
        <div className={cn("animate-pulse bg-muted", compact ? "size-6" : "size-8")} />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-16 animate-pulse bg-muted" />
            <div className="h-2 w-10 animate-pulse bg-muted" />
          </div>
          <div className="h-3 w-3/4 animate-pulse bg-muted" />
          <div className="h-3 w-1/2 animate-pulse bg-muted" />
        </div>
      </div>

      {/* Grouped message (no avatar) */}
      <div className="flex gap-2.5">
        <div className={cn(compact ? "w-6" : "w-8")} />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="h-3 w-2/3 animate-pulse bg-muted" />
        </div>
      </div>

      {/* Message group 2 */}
      <div className="flex gap-2.5">
        <div className={cn("animate-pulse bg-muted", compact ? "size-6" : "size-8")} />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-12 animate-pulse bg-muted" />
            <div className="h-2 w-10 animate-pulse bg-muted" />
          </div>
          <div className="h-3 w-4/5 animate-pulse bg-muted" />
          <div className="h-3 w-1/3 animate-pulse bg-muted" />
          {/* Reference chip skeleton */}
          <div className="mt-1 flex gap-1">
            <div className="h-5 w-24 animate-pulse bg-muted" />
            <div className="h-5 w-16 animate-pulse bg-muted" />
          </div>
        </div>
      </div>

      {/* Message group 3 */}
      <div className="flex gap-2.5">
        <div className={cn("animate-pulse bg-muted", compact ? "size-6" : "size-8")} />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-10 animate-pulse bg-muted" />
            <div className="h-2 w-10 animate-pulse bg-muted" />
          </div>
          <div className="h-3 w-full animate-pulse bg-muted" />
          <div className="h-3 w-2/5 animate-pulse bg-muted" />
        </div>
      </div>
    </div>
  )
}
