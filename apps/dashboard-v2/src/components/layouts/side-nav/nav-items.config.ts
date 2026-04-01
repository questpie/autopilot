import {
  HouseIcon,
  ListChecksIcon,
  UsersIcon,
  FolderOpenIcon,
  PaintBrushIcon,
  ChatCircleIcon,
  ChartBarIcon,
  TrayIcon,
  Link as LinkIcon,
  GearIcon,
  BookOpenIcon,
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
  { icon: HouseIcon, labelKey: "nav.dashboard", to: "/" },
  { icon: ListChecksIcon, labelKey: "nav.tasks", to: "/tasks" },
  { icon: UsersIcon, labelKey: "nav.team", to: "/team" },
  { icon: FolderOpenIcon, labelKey: "nav.files", to: "/files" },
  { icon: PaintBrushIcon, labelKey: "nav.artifacts", to: "/artifacts" },
  { icon: ChatCircleIcon, labelKey: "nav.chat", to: "/channels" },
]

export const secondaryItems: NavItem[] = [
  { icon: TrayIcon, labelKey: "nav.inbox", to: "/inbox" },
  { icon: ChartBarIcon, labelKey: "nav.activity", to: "/activity" },
  { icon: LinkIcon, labelKey: "nav.integrations", to: "/integrations" },
]

export const bottomItems: NavItem[] = [
  { icon: GearIcon, labelKey: "nav.settings", to: "/settings" },
  {
    icon: BookOpenIcon,
    labelKey: "Docs",
    to: "https://autopilot.questpie.com/docs",
    external: true,
  },
]
