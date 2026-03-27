/**
 * Danger zone routes — export, reset, and delete company data.
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

const danger = new Hono<AppEnv>()
	// ── POST /export — export company data as ZIP ────────────────────
	.post(
		'/export',
		describeRoute({
			tags: ['danger'],
			description: 'Export company data as a ZIP archive',
			responses: {
				200: { description: 'ZIP archive stream' },
				501: { description: 'Export not available' },
			},
		}),
		async (c) => {
			// TODO: implement actual ZIP export
			return c.json({ error: 'export not yet implemented' }, 501)
		},
	)
	// ── POST /reset — reset company to defaults ─────────────────────
	.post(
		'/reset',
		describeRoute({
			tags: ['danger'],
			description: 'Reset company configuration to defaults',
			responses: {
				200: {
					description: 'Reset complete',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				501: { description: 'Reset not available' },
			},
		}),
		async (c) => {
			// TODO: implement actual reset
			return c.json({ error: 'reset not yet implemented' }, 501)
		},
	)
	// ── POST /delete-company — permanently delete company data ───────
	.post(
		'/delete-company',
		describeRoute({
			tags: ['danger'],
			description: 'Permanently delete all company data',
			responses: {
				200: {
					description: 'Company deleted',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				501: { description: 'Delete not available' },
			},
		}),
		async (c) => {
			// TODO: implement actual deletion
			return c.json({ error: 'delete not yet implemented' }, 501)
		},
	)

export { danger }
