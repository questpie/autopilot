import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { SurfaceSection } from '@/components/ui/surface-section'
import { surfaceCardVariants } from '@/components/ui/surface-card'
import { cn } from '@/lib/utils'

/** Roles accepted by the custom invite API (/api/invites) */
type UserRole = 'owner' | 'admin' | 'member' | 'viewer'

/** Roles accepted by better-auth authClient.admin.setRole() */
type AuthRole = 'admin' | 'user'

const ROLE_OPTIONS: UserRole[] = ['owner', 'admin', 'member', 'viewer']
const AUTH_ROLE_OPTIONS: AuthRole[] = ['admin', 'user']

interface InvitePayload {
  email: string
  role: UserRole
}

async function postInvite(payload: InvitePayload): Promise<void> {
  const res = await fetch('/api/invites', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
}

export function UsersSettings() {
  const queryClient = useQueryClient()

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const result = await authClient.admin.listUsers({ query: { limit: 200 } })
      if (result.error) throw new Error(result.error.message)
      return result.data?.users ?? []
    },
  })

  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AuthRole }) => {
      const result = await authClient.admin.setRole({ userId, role })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const banMutation = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      if (ban) {
        const result = await authClient.admin.banUser({ userId })
        if (result.error) throw new Error(result.error.message)
      } else {
        const result = await authClient.admin.unbanUser({ userId })
        if (result.error) throw new Error(result.error.message)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const inviteMutation = useMutation({
    mutationFn: postInvite,
  })

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('member')
  const [inviteError, setInviteError] = useState('')

  async function handleInviteSubmit() {
    setInviteError('')
    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }
    try {
      await inviteMutation.mutateAsync({ email: inviteEmail.trim(), role: inviteRole })
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('member')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage team members and their access roles.</p>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger render={<Button size="sm" variant="outline" />}>
            Invite User
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Email</p>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Role</p>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/20"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {inviteError && (
                <p className="text-sm text-destructive">{inviteError}</p>
              )}
            </div>
            <DialogFooter showCloseButton>
              <Button
                size="sm"
                onClick={handleInviteSubmit}
                loading={inviteMutation.isPending}
              >
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {usersQuery.isPending ? (
        <div className="flex items-center gap-2 py-4 text-muted-foreground">
          <Spinner size="sm" />
          <span className="text-sm">Loading users...</span>
        </div>
      ) : usersQuery.error ? (
        <p className="text-sm text-destructive">Failed to load users: {usersQuery.error.message}</p>
      ) : (
        <SurfaceSection title="Users">
          {usersQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <div className="space-y-2">
              {usersQuery.data.map((u) => (
                <div key={u.id} className={cn(surfaceCardVariants({ size: 'sm' }), 'flex items-center justify-between gap-4')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={u.role ?? 'user'}
                      onChange={(e) => {
                        const role = AUTH_ROLE_OPTIONS.find((r) => r === e.target.value)
                        if (role) setRoleMutation.mutate({ userId: u.id, role })
                      }}
                      className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:opacity-50"
                      disabled={setRoleMutation.isPending}
                    >
                      {AUTH_ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <Button
                      size="xs"
                      variant={u.banned ? 'outline' : 'destructive'}
                      onClick={() => banMutation.mutate({ userId: u.id, ban: !u.banned })}
                      loading={banMutation.isPending && banMutation.variables?.userId === u.id}
                    >
                      {u.banned ? 'Unban' : 'Ban'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SurfaceSection>
      )}
    </div>
  )
}
