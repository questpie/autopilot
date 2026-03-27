import { useQuery } from "@tanstack/react-query"
import { UserIcon, RobotIcon, XIcon, PlusIcon } from "@phosphor-icons/react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/lib/i18n"
import { channelMembersQuery } from "./chat.queries"
import { useManageMembers } from "./chat.mutations"
import { agentsQuery } from "@/features/team/team.queries"
import { useState } from "react"

interface ChannelMembersProps {
  channelId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Member {
  channel_id: string
  actor_id: string
  actor_type: "human" | "agent"
  role: "owner" | "member" | "readonly"
  joined_at: string
}

export function ChannelMembers({
  channelId,
  open,
  onOpenChange,
}: ChannelMembersProps) {
  const { t } = useTranslation()
  const { data: members } = useQuery(channelMembersQuery(channelId))
  const { data: agents } = useQuery(agentsQuery)
  const manageMembers = useManageMembers(channelId)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const memberList = (members ?? []) as Member[]
  const agentList = (agents ?? []) as Array<{ id: string; name: string }>

  // Agents not already members
  const availableAgents = agentList.filter(
    (a) => !memberList.some((m) => m.actor_id === a.id),
  )

  const handleRemoveMember = (actorId: string) => {
    manageMembers.mutate({ remove: [actorId] })
  }

  const handleAddMember = (agentId: string) => {
    manageMembers.mutate({
      add: [{ actor_id: agentId, actor_type: "agent" }],
    })
    setShowAddMenu(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[400px]">
        <div className="flex flex-col gap-4 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold">
              {t("chat.members")}
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              {t("chat.member_count", { count: memberList.length })}
            </Badge>
          </div>

          {/* Member list */}
          <div className="flex flex-col gap-1">
            {memberList.map((member) => (
              <div
                key={member.actor_id}
                className="flex items-center gap-2.5 py-1.5 text-sm"
              >
                {member.actor_type === "agent" ? (
                  <RobotIcon size={16} className="shrink-0 text-muted-foreground" />
                ) : (
                  <UserIcon size={16} className="shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 font-heading text-xs">
                  {member.actor_id}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] uppercase"
                >
                  {member.role}
                </Badge>
                {member.role !== "owner" && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.actor_id)}
                    className="p-0.5 text-muted-foreground hover:text-destructive"
                    title={t("chat.remove_member")}
                  >
                    <XIcon size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add member */}
          <div className="border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <PlusIcon size={12} />
              {t("chat.add_member")}
            </Button>

            {showAddMenu && availableAgents.length > 0 && (
              <div className="mt-2 flex flex-col gap-0.5 border border-border bg-card p-1">
                {availableAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleAddMember(agent.id)}
                    className="flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/50"
                  >
                    <RobotIcon size={14} className="text-muted-foreground" />
                    <span className="font-heading">{agent.name}</span>
                    <span className="text-muted-foreground/60">{agent.id}</span>
                  </button>
                ))}
              </div>
            )}

            {showAddMenu && availableAgents.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("common.no_results")}
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
