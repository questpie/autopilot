/**
 * Centralized TanStack Query key factory.
 * Every query key in the app MUST use this factory — no raw strings.
 *
 * Pattern: queryKeys.<entity>.root / .list(filters) / .detail(id)
 */

function createKeys<T extends string>(entity: T) {
  return {
    root: [entity] as const,
    list: (filters?: Record<string, unknown>) =>
      filters
        ? ([entity, "list", filters] as const)
        : ([entity, "list"] as const),
    detail: (id: string) => [entity, "detail", id] as const,
  }
}

export const queryKeys = {
  status: createKeys("status"),
  tasks: createKeys("tasks"),
  agents: createKeys("agents"),
  channels: createKeys("channels"),
  messages: createKeys("messages"),
  activity: createKeys("activity"),
  pins: createKeys("pins"),
  inbox: createKeys("inbox"),
  artifacts: createKeys("artifacts"),
  skills: createKeys("skills"),
  sessions: createKeys("sessions"),
  search: createKeys("search"),
  files: createKeys("files"),
  dashboard: createKeys("dashboard"),
  secrets: createKeys("secrets"),
  team: createKeys("team"),
  workflows: createKeys("workflows"),
  providers: createKeys("providers"),
  company: createKeys("company"),
  userSessions: createKeys("userSessions"),
} as const
