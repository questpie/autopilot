export interface Message {
  id: string
  from: string
  at: string
  content: string
  mentions: string[]
  references: string[]
  thread: string | null
  thread_id?: string | null
  external: boolean
  edited_at?: string | null
}
