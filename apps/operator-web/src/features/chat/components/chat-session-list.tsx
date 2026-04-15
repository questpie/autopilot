import { ArrowLeft, ClockCounterClockwise } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { EmptyState } from '@/components/ui/empty-state'
import { useNavigate } from '@tanstack/react-router'
import type { ConversationViewModel } from '@/api/conversations.api'

interface ChatSessionListProps {
  conversations: ConversationViewModel[]
  searchQuery: string
  onSearchChange: (q: string) => void
  onSelect: (id: string) => void
  onNew: () => void
}

export function ChatSessionList({
  conversations,
  searchQuery,
  onSearchChange,
  onSelect,
  onNew,
}: ChatSessionListProps) {
  const navigate = useNavigate()

  function goBack() {
    void navigate({ to: '/chat', search: {} })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex h-14 items-center gap-3 bg-muted/30 px-4 shrink-0">
        <Button size="icon-xs" variant="ghost" onClick={goBack} title="Back to Chat">
          <ArrowLeft size={14} weight="bold" />
        </Button>
        <h1 className="font-mono text-sm font-medium text-foreground flex-1">History</h1>
        <Button size="xs" variant="default" onClick={onNew}>
          New conversation
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-muted/20 shrink-0">
        <SearchInput
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search conversations..."
          onClear={searchQuery ? () => onSearchChange('') : undefined}
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <EmptyState
            icon={ClockCounterClockwise}
            title="No conversations yet"
            description="Start a new one from the Chat screen."
            height="h-full"
          />
        ) : (
          <div>
            {conversations.map((conv) => (
              <button
                key={conv.session.id}
                type="button"
                onClick={() => onSelect(conv.session.id)}
                className={cn(
                  'w-full text-left px-4 py-3 transition-colors',
                  'hover:bg-muted',
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-foreground truncate flex-1">
                    {conv.title || 'New conversation'}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                    {conv.time}
                  </span>
                </div>
                {conv.lastPreview && (
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
                    {conv.lastPreview}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
