import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ChatScreen } from '@/features/chat'

const searchSchema = z.object({
  sessionId: z.string().optional(),
  view: z.enum(['history']).optional(),
})

export const Route = createFileRoute('/_authed/chat')({
  component: ChatScreen,
  validateSearch: (search) => searchSchema.parse(search),
})
