import { z } from 'zod'

/** Permission string: "resource.action" or "resource.*" or "*" */
const PermissionString = z.string().regex(
	/^(\*|[a-z_]+\.(\*|[a-z_]+))$/,
	'Must be "*", "resource.*", or "resource.action"',
)

export const RoleDefinitionSchema = z.object({
	description: z.string(),
	permissions: z.union([
		z.literal('*').transform(() => ['*']),
		z.array(PermissionString),
	]),
})

export const RolesFileSchema = z.object({
	roles: z.record(z.string(), RoleDefinitionSchema),
})

export type RolesFile = z.infer<typeof RolesFileSchema>
