import { z } from 'zod'
import { SecretRefSchema } from './secret-ref'

/** An execution environment (e.g. local, staging, prod). */
export const EnvironmentSchema = z.object({
	id: z.string().regex(/^[a-z0-9-]+$/),
	name: z.string(),
	description: z.string().default(''),
	/** Worker tags required to execute in this environment. */
	required_tags: z.array(z.string()).default([]),
	/** Secret references available in this environment. */
	secret_refs: z.array(SecretRefSchema).default([]),
})
