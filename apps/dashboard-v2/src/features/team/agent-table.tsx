import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  CircleIcon,
  MagnifyingGlassIcon,
  CaretUpIcon,
  CaretDownIcon,
  UserPlusIcon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { agentsQuery } from "./team.queries"
import { getAvatarColor } from "./agent-card"

type SortKey = "name" | "role" | "status" | "tasks"
type SortDir = "asc" | "desc"

interface TeamMember {
  id: string
  name: string
  role: string
  description: string
  type: "agent" | "human"
  isWorking: boolean
  taskCount: number
}

function AgentTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-64 animate-pulse bg-muted" />
        <div className="h-8 w-32 animate-pulse bg-muted" />
        <div className="h-8 w-32 animate-pulse bg-muted" />
      </div>
      <div className="border border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-3">
            <div className="h-8 w-8 animate-pulse bg-muted" />
            <div className="h-3 w-24 animate-pulse bg-muted" />
            <div className="h-3 w-16 animate-pulse bg-muted" />
            <div className="h-3 w-12 animate-pulse bg-muted" />
            <div className="h-3 w-8 animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDir }) {
  if (!active) {
    return (
      <span className="ml-1 inline-flex flex-col text-muted-foreground/40">
        <CaretUpIcon size={8} />
        <CaretDownIcon size={8} className="-mt-0.5" />
      </span>
    )
  }
  return direction === "asc" ? (
    <CaretUpIcon size={10} className="ml-1 text-foreground" />
  ) : (
    <CaretDownIcon size={10} className="ml-1 text-foreground" />
  )
}

export function AgentTable() {
  const { t } = useTranslation()
  const { data: agents, isLoading } = useQuery(agentsQuery)

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const members = useMemo<TeamMember[]>(() => {
    const agentList = agents ?? []
    const mapped: TeamMember[] = agentList.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      type: "agent" as const,
      isWorking: false,
      taskCount: 0,
    }))

    mapped.push({
      id: "__owner__",
      name: "Owner",
      role: "Owner",
      description: "Company owner",
      type: "human",
      isWorking: false,
      taskCount: 0,
    })

    return mapped
  }, [agents])

  const roles = useMemo(() => {
    const set = new Set(members.map((m) => m.role))
    return Array.from(set).sort()
  }, [members])

  const filtered = useMemo(() => {
    let list = members

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q),
      )
    }

    if (roleFilter !== "all") {
      list = list.filter((m) => m.role === roleFilter)
    }

    if (statusFilter !== "all") {
      if (statusFilter === "working") {
        list = list.filter((m) => m.isWorking)
      } else {
        list = list.filter((m) => !m.isWorking)
      }
    }

    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "role":
          cmp = a.role.localeCompare(b.role)
          break
        case "status":
          cmp = Number(a.isWorking) - Number(b.isWorking)
          break
        case "tasks":
          cmp = a.taskCount - b.taskCount
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return list
  }, [members, search, roleFilter, statusFilter, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  if (isLoading) {
    return <AgentTableSkeleton />
  }

  if (members.length <= 1 && !agents?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <UserPlusIcon size={32} className="text-muted-foreground" />
        <p className="font-heading text-sm text-muted-foreground">
          {t("team.no_agents")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("team.no_agents_description")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <MagnifyingGlassIcon
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="pl-8"
          />
        </div>

        <Select value={roleFilter} onValueChange={(v) => { if (v !== null) setRoleFilter(v) }}>
          <SelectTrigger size="sm">
            <SelectValue placeholder={t("team.filter_role")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("team.filter_all_roles")}</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { if (v !== null) setStatusFilter(v) }}>
          <SelectTrigger size="sm">
            <SelectValue placeholder={t("team.filter_status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("team.filter_all_statuses")}</SelectItem>
            <SelectItem value="working">{t("team.status_working")}</SelectItem>
            <SelectItem value="idle">{t("team.status_idle")}</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="text-[10px]">
          {filtered.length} / {members.length}
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>
              <button
                type="button"
                className="flex items-center font-medium"
                onClick={() => handleSort("name")}
              >
                {t("common.name")}
                <SortIcon active={sortKey === "name"} direction={sortDir} />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                className="flex items-center font-medium"
                onClick={() => handleSort("role")}
              >
                {t("team.column_role")}
                <SortIcon active={sortKey === "role"} direction={sortDir} />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                className="flex items-center font-medium"
                onClick={() => handleSort("status")}
              >
                {t("team.column_status")}
                <SortIcon active={sortKey === "status"} direction={sortDir} />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                className="flex items-center font-medium"
                onClick={() => handleSort("tasks")}
              >
                {t("team.column_tasks")}
                <SortIcon active={sortKey === "tasks"} direction={sortDir} />
              </button>
            </TableHead>
            <TableHead className="w-20">
              {t("team.column_type")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((member) => (
            <TeamMemberRow key={member.id} member={member} />
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {t("common.no_results")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TeamMemberRow({ member }: { member: TeamMember }) {
  const { t } = useTranslation()
  const bgColor = getAvatarColor(member.id)
  const initial = member.name.charAt(0).toUpperCase()

  const isAgent = member.type === "agent"

  const row = (
    <TableRow
      className={cn(
        isAgent && "cursor-pointer",
      )}
    >
      <TableCell>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center text-xs font-bold text-white",
            isAgent ? bgColor : "bg-muted text-muted-foreground",
          )}
        >
          {initial}
        </div>
      </TableCell>
      <TableCell className="font-heading font-medium text-foreground">
        {member.name}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-[10px]">
          {member.role}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <CircleIcon
            size={8}
            weight={member.isWorking ? "fill" : "regular"}
            className={cn(
              member.isWorking ? "text-green-500" : "text-muted-foreground",
              member.isWorking && "animate-status-pulse motion-reduce:animate-none",
            )}
          />
          <span className="text-[10px] text-muted-foreground">
            {member.isWorking ? t("team.status_working") : t("team.status_idle")}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-heading text-muted-foreground">
        {member.taskCount}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            isAgent ? "border-blue-500/30 text-blue-500" : "border-amber-500/30 text-amber-500",
          )}
        >
          {isAgent ? t("team.agents") : t("team.humans")}
        </Badge>
      </TableCell>
    </TableRow>
  )

  if (isAgent) {
    return (
      <Link to="/team/$id" params={{ id: member.id }} className="contents">
        {row}
      </Link>
    )
  }

  return row
}
