import { useQuery } from "@tanstack/react-query"
import { reactionsQuery } from "./chat.queries"
import { useAddReaction, useRemoveReaction } from "./chat.mutations"
import { useSession } from "@/hooks/use-session"
import { EmojiPicker } from "./emoji-picker"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { memo, useCallback, useEffect, useMemo, useRef } from "react"

interface ReactionGroup {
  emoji: string
  count: number
  users: string[]
  hasReacted: boolean
}

interface ReactionsRowProps {
  channelId: string
  messageId: string
}

export const ReactionsRow = memo(function ReactionsRow({ channelId, messageId }: ReactionsRowProps) {
  const { user } = useSession()
  const currentUserId = user?.id ?? "human"

  const { data: reactions } = useQuery(reactionsQuery(channelId, messageId))
  const addReaction = useAddReaction(channelId, messageId)
  const removeReaction = useRemoveReaction(channelId, messageId)

  const groups = useMemo(() => {
    if (!reactions || reactions.length === 0) return []

    const map = new Map<string, ReactionGroup>()
    for (const r of reactions) {
      const existing = map.get(r.emoji)
      if (existing) {
        existing.count++
        existing.users.push(r.user_id)
        if (r.user_id === currentUserId) existing.hasReacted = true
      } else {
        map.set(r.emoji, {
          emoji: r.emoji,
          count: 1,
          users: [r.user_id],
          hasReacted: r.user_id === currentUserId,
        })
      }
    }
    return Array.from(map.values())
  }, [reactions, currentUserId])

  // Debounce rapid reaction clicks (300ms per emoji)
  const reactionDebounceRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Cleanup pending timeouts on unmount
  useEffect(() => {
    const map = reactionDebounceRef.current
    return () => {
      for (const timer of map.values()) clearTimeout(timer)
      map.clear()
    }
  }, [])

  const handleToggle = useCallback((emoji: string, hasReacted: boolean) => {
    const debounceMap = reactionDebounceRef.current
    if (debounceMap.has(emoji)) return // Already pending, ignore rapid click
    debounceMap.set(emoji, setTimeout(() => debounceMap.delete(emoji), 300))

    if (hasReacted) {
      removeReaction.mutate(emoji)
    } else {
      addReaction.mutate(emoji)
    }
  }, [addReaction, removeReaction])

  const handleAddNew = useCallback((emoji: string) => {
    addReaction.mutate(emoji)
  }, [addReaction])

  if (groups.length === 0) return null

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {groups.map((group) => (
        <Tooltip key={group.emoji}>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => handleToggle(group.emoji, group.hasReacted)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                  group.hasReacted
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                <span className="text-sm leading-none">{group.emoji}</span>
                <span className="font-heading text-[11px]">{group.count}</span>
              </button>
            }
          />
          <TooltipContent side="top">
            {group.users.join(", ")}
          </TooltipContent>
        </Tooltip>
      ))}
      <EmojiPicker onSelect={handleAddNew} />
    </div>
  )
})
