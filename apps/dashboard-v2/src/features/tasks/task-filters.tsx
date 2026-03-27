import { useState } from "react"
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  SortAscendingIcon,
  CaretDownIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/lib/i18n"

const STATUS_OPTIONS = [
  "all",
  "draft",
  "backlog",
  "assigned",
  "in_progress",
  "review",
  "blocked",
  "done",
  "cancelled",
] as const

const PRIORITY_OPTIONS = ["all", "critical", "high", "medium", "low"] as const

const SORT_OPTIONS = ["created_at", "updated_at", "priority"] as const

const GROUP_OPTIONS = [
  "status",
  "assignee",
  "workflow",
  "priority",
  "project",
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]
export type GroupOption = (typeof GROUP_OPTIONS)[number]

interface TaskFiltersProps {
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  priorityFilter: string
  onPriorityFilterChange: (priority: string) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  sortBy: SortOption
  onSortByChange: (sort: SortOption) => void
  groupBy: GroupOption
  onGroupByChange: (group: GroupOption) => void
}

export function TaskFilters({
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  searchQuery,
  onSearchQueryChange,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange,
}: TaskFiltersProps) {
  const { t } = useTranslation()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      {searchOpen ? (
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t("tasks.search_placeholder")}
            className="h-7 pl-8 font-heading text-xs"
            autoFocus
            onBlur={() => {
              if (!searchQuery) setSearchOpen(false)
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onSearchQueryChange("")
                setSearchOpen(false)
              }
            }}
          />
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={() => setSearchOpen(true)}
        >
          <MagnifyingGlassIcon size={14} />
        </Button>
      )}

      {/* Status filter */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
            <FunnelIcon size={14} />
            {t("tasks.filter_status")}
            {statusFilter !== "all" && (
              <span className="text-primary">
                : {t(`tasks.status_${statusFilter}`)}
              </span>
            )}
            <CaretDownIcon size={10} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STATUS_OPTIONS.map((status) => (
            <DropdownMenuItem
              key={status}
              onClick={() => onStatusFilterChange(status)}
              className={statusFilter === status ? "bg-accent" : ""}
            >
              {status === "all"
                ? t("tasks.filter_all")
                : t(`tasks.status_${status}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority filter */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
            {t("tasks.filter_priority")}
            {priorityFilter !== "all" && (
              <span className="text-primary">
                : {t(`tasks.priority_${priorityFilter}`)}
              </span>
            )}
            <CaretDownIcon size={10} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PRIORITY_OPTIONS.map((priority) => (
            <DropdownMenuItem
              key={priority}
              onClick={() => onPriorityFilterChange(priority)}
              className={priorityFilter === priority ? "bg-accent" : ""}
            >
              {priority === "all"
                ? t("tasks.filter_all")
                : t(`tasks.priority_${priority}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
            <SortAscendingIcon size={14} />
            {t(`tasks.sort_${sortBy === "created_at" ? "created" : sortBy === "updated_at" ? "updated" : "priority"}`)}
            <CaretDownIcon size={10} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SORT_OPTIONS.map((sort) => (
            <DropdownMenuItem
              key={sort}
              onClick={() => onSortByChange(sort)}
              className={sortBy === sort ? "bg-accent" : ""}
            >
              {t(`tasks.sort_${sort === "created_at" ? "created" : sort === "updated_at" ? "updated" : "priority"}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group by */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
            {t(`tasks.group_by_${groupBy}`)}
            <CaretDownIcon size={10} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {GROUP_OPTIONS.map((group) => (
            <DropdownMenuItem
              key={group}
              onClick={() => onGroupByChange(group)}
              className={groupBy === group ? "bg-accent" : ""}
            >
              {t(`tasks.group_by_${group}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
