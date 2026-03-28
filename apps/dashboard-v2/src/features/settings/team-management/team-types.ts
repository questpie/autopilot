import { z } from "zod"

export const ROLES = ["owner", "admin", "member", "viewer"] as const
export type Role = (typeof ROLES)[number]

export const ROLE_OPTIONS = ROLES.map((r) => ({
  value: r,
  label: r.charAt(0).toUpperCase() + r.slice(1),
}))

export interface InviteEntry {
  email: string
  role: Role
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  banned: boolean
  twoFactorEnabled: boolean
}

export const inviteSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(ROLES),
})

export type InviteFormValues = z.infer<typeof inviteSchema>

export function parseInvitesYaml(content: string): InviteEntry[] {
  const invites: InviteEntry[] = []
  const lines = content.split("\n")
  let currentEmail = ""

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("- email:")) {
      currentEmail = trimmed.slice(8).trim().replace(/['"]/g, "")
    } else if (trimmed.startsWith("role:") && currentEmail) {
      const role = trimmed.slice(5).trim().replace(/['"]/g, "") as Role
      invites.push({ email: currentEmail, role })
      currentEmail = ""
    }
  }

  return invites
}

export function serializeInvitesYaml(invites: InviteEntry[]): string {
  if (invites.length === 0) return "invites: []\n"
  const lines = ["invites:"]
  for (const inv of invites) {
    lines.push(`  - email: ${inv.email}`)
    lines.push(`    role: ${inv.role}`)
  }
  return lines.join("\n") + "\n"
}
