import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import {
	CreateJoinTokenRequestSchema,
	WorkerEnrollRequestSchema,
} from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { EnrollmentError } from '../../services/enrollment'

const enrollment = new Hono<AppEnv>()
	// POST /enrollment/tokens — create a join token (owner/admin only)
	.post(
		'/tokens',
		zValidator('json', CreateJoinTokenRequestSchema),
		async (c) => {
			const { enrollmentService } = c.get('services')
			const actor = c.get('actor')

			if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
				return c.json({ error: 'Only owner or admin can create join tokens' }, 403)
			}

			const body = c.req.valid('json')

			const result = await enrollmentService.createToken({
				created_by: actor.id,
				description: body.description,
				ttl_seconds: body.ttl_seconds,
			})

			return c.json(result, 201)
		},
	)
	// POST /enrollment/enroll — worker enrollment (public, consumes join token)
	.post(
		'/enroll',
		zValidator('json', WorkerEnrollRequestSchema),
		async (c) => {
			const { enrollmentService } = c.get('services')
			const body = c.req.valid('json')

			try {
				const result = await enrollmentService.enroll({
					token: body.token,
					name: body.name,
					device_id: body.device_id,
					capabilities: JSON.stringify(body.capabilities),
				})
				return c.json(result, 201)
			} catch (err) {
				if (err instanceof EnrollmentError) {
					return c.json({ error: err.message }, 401)
				}
				throw err
			}
		},
	)

export { enrollment }
