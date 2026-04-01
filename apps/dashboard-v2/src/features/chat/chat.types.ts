import { api } from '@/lib/api'
import type { InferResponseType } from 'hono/client'

export type Message = InferResponseType<
	(typeof api.api)['chat-sessions'][':id']['messages']['$get'],
	200
>[number]
