import type { Integration } from '../types'

export const mockIntegrations: Integration[] = [
  {
    id: 'int_01JR8VQM3K0000000000000001',
    provider: 'telegram',
    name: 'Telegram',
    icon: '\u{1F4AC}',
    status: 'connected',
    last_sync_at: '2026-04-10T08:00:00.000Z',
    config: { bot_username: '@kaviarenbot' },
    created_at: '2026-02-10T12:00:00.000Z',
  },
  {
    id: 'int_01JR8VQM3K0000000000000002',
    provider: 'instagram',
    name: 'Instagram',
    icon: '\u{1F4F7}',
    status: 'disconnected',
    last_sync_at: null,
    config: {},
    created_at: '2026-03-01T09:00:00.000Z',
  },
  {
    id: 'int_01JR8VQM3K0000000000000003',
    provider: 'email',
    name: 'Email',
    icon: '\u{2709}\u{FE0F}',
    status: 'connected',
    last_sync_at: '2026-04-10T07:30:00.000Z',
    config: { smtp_host: 'smtp.kaviarensrdcom.sk' },
    created_at: '2026-01-20T14:00:00.000Z',
  },
  {
    id: 'int_01JR8VQM3K0000000000000004',
    provider: 'eshop',
    name: 'E-shop',
    icon: '\u{1F6D2}',
    status: 'disconnected',
    last_sync_at: null,
    config: {},
    created_at: '2026-03-15T10:00:00.000Z',
  },
]
