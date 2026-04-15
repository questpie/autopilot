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
        <p className="font-mono text-xs text-muted-foreground">Manage team members and their access roles.</p>
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
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Email</p>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Role</p>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="h-8 w-full rounded-none border border-input bg-transparent px-2.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {inviteError && (
                <p className="font-mono text-xs text-destructive">{inviteError}</p>
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
          <span className="font-mono text-xs">Loading users...</span>
        </div>
      ) : usersQuery.error ? (
        <p className="font-mono text-xs text-destructive">Failed to load users: {usersQuery.error.message}</p>
      ) : (
        <div className="bg-muted/40">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1fr_120px_100px] gap-2 bg-muted/30 px-4 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Name</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Email</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Role</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
          </div>

          {usersQuery.data.length === 0 ? (
            <p className="px-4 py-4 font-mono text-xs text-muted-foreground">No users found.</p>
          ) : (
            usersQuery.data.map((u) => (
              <div
                key={u.id}
                className="grid grid-cols-[1fr_1fr_120px_100px] items-center gap-2 px-4 py-2"
              >
                <p className="font-mono text-xs text-foreground truncate">{u.name}</p>
                <p className="font-mono text-xs text-muted-foreground truncate">{u.email}</p>
                <select
                  value={u.role ?? 'user'}
                  onChange={(e) => {
                    const role = AUTH_ROLE_OPTIONS.find((r) => r === e.target.value)
                    if (role) setRoleMutation.mutate({ userId: u.id, role })
                  }}
                  className="h-7 rounded-none border border-input bg-transparent px-1.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50"
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
            ))
          )}
        </div>
      )}
    </div>
  )
}
