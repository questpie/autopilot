import {
  ChatCircleIcon,
  FolderOpenIcon,
  UsersIcon,
  ListChecksIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

export interface NavItem {
  icon: Icon
  labelKey: string
  to: string
  badge?: number
  external?: boolean
}

export const primaryItems: NavItem[] = [
  { icon: ChatCircleIcon, labelKey: "nav.chat", to: "/" },
  { icon: FolderOpenIcon, labelKey: "nav.files", to: "/files" },
  { icon: UsersIcon, labelKey: "nav.team", to: "/team" },
  { icon: ListChecksIcon, labelKey: "nav.tasks", to: "/tasks" },
]

// Bottom items are now handled directly in nav-content.tsx (bell + profile dropdown)
