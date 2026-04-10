import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  House,
  ChatCircle,
  CheckSquare,
  ArrowsClockwise,
  File,
  Buildings,
  FolderSimple,
  BookOpen,
  Link as LinkIcon,
  GearSix,
  Folder,
  Robot,
  Gear,
  Lightning,
} from '@phosphor-icons/react'
import { useAppStore } from '@/stores/app.store'
import { useSession } from '@/hooks/use-session'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ComponentType } from 'react'

interface NavItem {
  to: string
  labelKey: string
  icon: ComponentType<{ size?: number; weight?: 'regular' }>
  badge?: number
}

interface NavSection {
  labelKey?: string
  items: NavItem[]
  devOnly?: boolean
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: '/', labelKey: 'nav.home', icon: House },
      { to: '/chat', labelKey: 'nav.chat', icon: ChatCircle },
    ],
  },
  {
    items: [
      { to: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
      { to: '/automations', labelKey: 'nav.automations', icon: ArrowsClockwise },
      { to: '/results', labelKey: 'nav.results', icon: File },
    ],
  },
  {
    labelKey: 'nav.workspace',
    items: [
      { to: '/company', labelKey: 'nav.company', icon: Buildings },
      { to: '/resources', labelKey: 'nav.resources', icon: FolderSimple },
      { to: '/playbooks', labelKey: 'nav.playbooks', icon: BookOpen },
      { to: '/integrations', labelKey: 'nav.integrations', icon: LinkIcon },
    ],
  },
  {
    labelKey: 'nav.advanced',
    devOnly: true,
    items: [
      { to: '/files', labelKey: 'nav.files', icon: Folder },
      { to: '/agents', labelKey: 'nav.agents', icon: Robot },
      { to: '/workflows', labelKey: 'nav.workflows', icon: Gear },
      { to: '/runtime', labelKey: 'nav.runtime', icon: Lightning },
    ],
  },
]

function QuestPieSymbol() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M22 10V2H2V22H10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path d="M23 13H13V23H23V13Z" fill="#B700FF" />
    </svg>
  )
}

function NavItemLink({ item }: { item: NavItem }) {
  const matchRoute = useMatchRoute()
  const { t } = useTranslation()
  const isActive = item.to === '/'
    ? !!matchRoute({ to: '/', fuzzy: false })
    : !!matchRoute({ to: item.to, fuzzy: true })

  const Icon = item.icon

  return (
    <Link
      to={item.to}
      className={cn(
        'flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors duration-100',
        isActive
          ? 'bg-primary/12 text-white'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon size={18} weight="regular" />
      <span className="flex-1 truncate">{t(item.labelKey)}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center bg-primary px-1 font-heading text-[11px] font-medium text-primary-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

function UserSection() {
  const { user } = useSession()

  const name = user?.name || user?.email || 'User'
  const initials = name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  return (
    <div className="flex items-center gap-2.5 border-t border-border px-3 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-card font-heading text-[11px] font-medium text-muted-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">
          {user?.name || user?.email || 'User'}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">QUESTPIE</div>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const developerMode = useAppStore((s) => s.developerMode)
  const { t } = useTranslation()

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-background">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <QuestPieSymbol />
        <span className="font-heading text-[13px] font-semibold tracking-tight text-foreground">
          Autopilot
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1">
        {NAV_SECTIONS.map((section, sectionIndex) => {
          if (section.devOnly && !developerMode) return null

          return (
            <div key={section.labelKey ?? sectionIndex} className="mb-1">
              {section.labelKey && (
                <div className="px-3 pb-1 pt-3 font-heading text-[11px] uppercase tracking-[0.5px] text-muted-foreground">
                  {t(section.labelKey)}
                </div>
              )}
              {section.items.map((item) => (
                <NavItemLink key={item.to} item={item} />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="py-1">
        <NavItemLink
          item={{ to: '/settings', labelKey: 'nav.settings', icon: GearSix }}
        />
      </div>

      {/* User */}
      <UserSection />
    </aside>
  )
}
