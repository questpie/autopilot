import { ChatCircle, CheckSquare, Folder, GearSix, MagnifyingGlass, SignOut } from '@phosphor-icons/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { useActiveView } from '@/hooks/use-active-view'
import { useSession } from '@/hooks/use-session'
import { authClient } from '@/lib/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'chat', to: '/chat', label: 'Chat', icon: ChatCircle },
  { id: 'files', to: '/files', label: 'Files', icon: Folder },
  { id: 'tasks', to: '/tasks', label: 'Tasks', icon: CheckSquare },
] as const

interface TopbarProps {
  onSearchOpen: () => void
}

export function Topbar({ onSearchOpen }: TopbarProps) {
  const activeView = useActiveView()
  const { user } = useSession()
  const { open: sidebarOpen } = useSidebar()
  const navigate = useNavigate()

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((s) => s[0])
        .join('')
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center border-b border-border bg-background px-3">
      {!sidebarOpen && <SidebarTrigger className="mr-2" />}
      <div className="flex-1" />

      {/* Center: CMS-style pill tabs */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <nav className="inline-flex h-8 items-center bg-muted p-[3px]">
          {TABS.map(({ id, to, label, icon: Icon }) => {
            const isActive = activeView === id
            return (
              <Link
                key={id}
                to={to}
                className={cn(
                  'inline-flex h-full items-center gap-1.5 px-2.5 font-mono text-xs font-medium transition-all',
                  isActive
                    ? 'bg-background text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground border border-transparent',
                )}
              >
                <Icon size={12} weight={isActive ? 'fill' : 'regular'} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex-1" />

      {/* Right: search + user menu */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSearchOpen}
          aria-label="Open command palette"
          aria-keyshortcuts="Meta+K"
          className="gap-2 font-mono text-xs text-muted-foreground"
        >
          <MagnifyingGlass size={14} />
          <span className="hidden md:inline">Search</span>
          <Kbd className="ml-1 hidden md:inline">⌘K</Kbd>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex size-7 items-center justify-center border border-border bg-muted font-mono text-[11px] font-medium text-foreground transition-colors hover:bg-accent">
                {initials}
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">{user?.name ?? ''}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{user?.email ?? ''}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void navigate({ to: '/settings' })}>
              <GearSix size={14} />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void authClient.signOut().then(() => navigate({ to: '/login' }))}>
              <SignOut size={14} />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
