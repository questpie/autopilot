import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChatCircle, CheckSquare, Folder, GearSix, House, CircleNotch } from '@phosphor-icons/react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useActiveView } from '@/hooks/use-active-view'
import { useSearch } from '@/hooks/use-search'
import type { SearchScope, SearchResult } from '@/api/search.api'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NAV_ITEMS = [
  { label: 'Home', to: '/', icon: House },
  { label: 'Chat', to: '/chat', icon: ChatCircle },
  { label: 'Tasks', to: '/tasks', icon: CheckSquare },
  { label: 'Files', to: '/files', icon: Folder },
  { label: 'Settings', to: '/settings', icon: GearSix },
] as const

function viewToScope(view: ReturnType<typeof useActiveView>): SearchScope | undefined {
  if (view === 'tasks') return 'tasks'
  if (view === 'files') return 'context'
  return undefined
}

function resultNavigateTo(result: SearchResult): string | null {
  if (result.entityType === 'task') return `/tasks?taskId=${encodeURIComponent(result.entityId)}`
  // Runs don't carry task_id in search results — no meaningful deep link yet
  return null
}

function SearchResultItem({
  result,
  onSelect,
}: {
  result: SearchResult
  onSelect: () => void
}) {
  const label = result.title ?? result.entityId
  const snippet = result.snippet.replace(/<\/?b>/g, '')
  return (
    <CommandItem
      key={result.entityId}
      value={`${result.entityType}-${result.entityId}`}
      onSelect={onSelect}
      className="flex-col items-start gap-0.5"
    >
      <span className="font-mono text-xs font-medium">{label}</span>
      <span className="font-mono text-xs text-muted-foreground line-clamp-1">{snippet}</span>
    </CommandItem>
  )
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const activeView = useActiveView()
  const [inputValue, setInputValue] = useState('')

  const scope = viewToScope(activeView)
  const { data: searchResults, isLoading } = useSearch(inputValue, scope)

  // Reset input when palette closes
  useEffect(() => {
    if (!open) setInputValue('')
  }, [open])

  function runCommand(fn: () => void) {
    onOpenChange(false)
    fn()
  }

  const hasQuery = inputValue.length >= 2
  const hasResults = searchResults && searchResults.length > 0

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command shouldFilter={!hasQuery}>
        <CommandInput
          placeholder="Go to page or search..."
          value={inputValue}
          onValueChange={setInputValue}
        />
        <CommandList>
          {!hasQuery && <CommandEmpty>No results found.</CommandEmpty>}

          {hasQuery && isLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground font-mono">
              <CircleNotch size={14} className="animate-spin" />
              Searching...
            </div>
          )}

          {hasQuery && !isLoading && !hasResults && (
            <div className="py-6 text-center text-sm text-muted-foreground font-mono">
              No results.
            </div>
          )}

          {hasQuery && !isLoading && hasResults && (
            <>
              <CommandGroup heading="Search Results">
                {searchResults.map((result) => (
                  <SearchResultItem
                    key={`${result.entityType}-${result.entityId}`}
                    result={result}
                    onSelect={() => {
                      const to = resultNavigateTo(result)
                      if (to) {
                        runCommand(() => void navigate({ to }))
                      } else {
                        onOpenChange(false)
                      }
                    }}
                  />
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Navigation">
            {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
              <CommandItem
                key={to}
                onSelect={() => runCommand(() => void navigate({ to }))}
              >
                <Icon size={16} />
                <span>{label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

/**
 * Hook to register the Cmd+K / Ctrl+K global keyboard shortcut.
 * Call once at a top-level component (ShellLayout).
 */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpen])
}
