import { useEffect, useRef, useState } from 'react'
import { Hammer, ArrowsClockwise, Lightning, Broom } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'

export interface SlashCommand {
  id: string
  name: string
  /** Argument hint shown after the command, e.g. "<description>" */
  argHint?: string
  description: string
  icon: React.ReactNode
  /** If true the command does not produce text to insert — caller handles it differently */
  isAction?: boolean
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'build',
    name: '/build',
    argHint: '<description>',
    description: 'Create a work order (task + workflow)',
    icon: <Hammer size={14} />,
  },
  {
    id: 'task',
    name: '/task',
    argHint: '<description>',
    description: 'Create a plain task',
    icon: <Lightning size={14} />,
  },
  {
    id: 'direct',
    name: '/direct',
    argHint: '<description>',
    description: 'One-shot work, no review loop',
    icon: <ArrowsClockwise size={14} />,
  },
  {
    id: 'new',
    name: '/new',
    description: 'Start a fresh session',
    icon: <Broom size={14} />,
    isAction: true,
  },
]

interface CommandPaletteProps {
  /** Current filter text (everything after the leading `/`) */
  filter: string
  onSelect: (command: SlashCommand) => void
  onClose: () => void
}

export function CommandPalette({ filter, onSelect, onClose }: CommandPaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      filter === '' ||
      cmd.id.startsWith(filter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(filter.toLowerCase()),
  )

  // Reset selection when filter changes
  useEffect(() => {
    setActiveIndex(0)
  }, [filter])

  // Keyboard navigation — listen on document so the textarea keeps focus
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (filtered.length === 0) return

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % filtered.length)
        return
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        const cmd = filtered[activeIndex]
        if (cmd) {
          e.preventDefault()
          onSelect(cmd)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [filtered, activeIndex, onSelect, onClose])

  // Close on click outside
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose])

  if (filtered.length === 0) {
    return null
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Slash commands"
      className="absolute bottom-full left-0 right-0 z-50 mb-1 bg-popover ring-1 ring-foreground/10"
    >
      {filtered.map((cmd, idx) => (
        <div
          key={cmd.id}
          role="option"
          aria-selected={idx === activeIndex}
          onPointerDown={(e) => {
            // Prevent blur on textarea
            e.preventDefault()
            onSelect(cmd)
          }}
          className={cn(
            'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm',
            'text-muted-foreground transition-colors',
            idx === activeIndex
              ? 'bg-muted text-foreground'
              : 'hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <span className="shrink-0 text-muted-foreground">{cmd.icon}</span>
          <span className="font-mono text-xs font-medium text-foreground">{cmd.name}</span>
          {cmd.argHint && (
            <span className="font-mono text-xs text-muted-foreground/60">{cmd.argHint}</span>
          )}
          <span className="ml-auto truncate text-xs text-muted-foreground">{cmd.description}</span>
          {idx === activeIndex && (
            <Kbd className="ml-2 shrink-0">↵</Kbd>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3 border-t border-border/50 px-3 py-1.5">
        <span className="font-mono text-[10px] text-muted-foreground/50">
          ↑↓ navigate · ↵ select · esc close
        </span>
      </div>
    </div>
  )
}
