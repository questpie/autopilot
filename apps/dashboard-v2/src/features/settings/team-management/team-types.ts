import { z } from 'zod'

export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_OPTIONS = ROLES.map((r) => ({
	value: r,
	label: r.charAt(0).toUpperCase() + r.slice(1),
}))

export interface InviteEntry {
	id: string
	email: string
	role: Role
	token: string
	inviteUrl: string
	createdAt: string
	expiresAt: string | null
	acceptedAt: string | null
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
	email: z.string().email('Valid email required'),
	role: z.enum(ROLES),
})

export type InviteFormValues = z.infer<typeof inviteSchema>
