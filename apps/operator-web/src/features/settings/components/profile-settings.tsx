import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSession } from '@/hooks/use-session'

export function ProfileSettings() {
  const { user, refetch } = useSession()
  const queryClient = useQueryClient()

  const [name, setName] = useState(user?.name ?? '')
  const [nameError, setNameError] = useState('')
  const [nameSaved, setNameSaved] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  const updateNameMutation = useMutation({
    mutationFn: async (displayName: string) => {
      const result = await authClient.updateUser({ name: displayName })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => {
      setNameSaved(true)
      setNameError('')
      void refetch()
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      setTimeout(() => setNameSaved(false), 2000)
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const result = await authClient.changePassword({
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
        revokeOtherSessions: false,
      })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => {
      setPasswordSaved(true)
      setPasswordError('')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSaved(false), 2000)
    },
  })

  function handleNameSave() {
    setNameError('')
    if (!name.trim()) {
      setNameError('Display name cannot be empty')
      return
    }
    updateNameMutation.mutate(name.trim())
  }

  function handlePasswordChange() {
    setPasswordError('')
    if (!currentPassword) {
      setPasswordError('Current password is required')
      return
    }
    if (!newPassword) {
      setPasswordError('New password is required')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    if (newPassword.length < 12) {
      setPasswordError('Password must be at least 12 characters')
      return
    }
    changePasswordMutation.mutate({ currentPassword, newPassword })
  }

  return (
    <div className="space-y-6">
      {/* Display name */}
      <div className="bg-muted/40">
        <div className="bg-muted/30 px-4 py-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Profile
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Email</p>
            <p className="font-mono text-xs text-muted-foreground">{user?.email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Display Name</p>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-xs"
                placeholder="Your name"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleNameSave}
                loading={updateNameMutation.isPending}
              >
                {nameSaved ? 'Saved' : 'Save'}
              </Button>
            </div>
            {nameError && (
              <p className="font-mono text-xs text-destructive">{nameError}</p>
            )}
            {updateNameMutation.error && (
              <p className="font-mono text-xs text-destructive">
                {updateNameMutation.error.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-muted/40">
        <div className="bg-muted/30 px-4 py-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Change Password
          </p>
        </div>
        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Current Password</p>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="max-w-xs"
              placeholder="Current password"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">New Password</p>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="max-w-xs"
              placeholder="Min 12 characters"
            />
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Confirm New Password</p>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="max-w-xs"
              placeholder="Repeat new password"
            />
          </div>
          {passwordError && (
            <p className="font-mono text-xs text-destructive">{passwordError}</p>
          )}
          {changePasswordMutation.error && (
            <p className="font-mono text-xs text-destructive">
              {changePasswordMutation.error.message}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handlePasswordChange}
            loading={changePasswordMutation.isPending}
          >
            {passwordSaved ? 'Password Changed' : 'Change Password'}
          </Button>
        </div>
      </div>
    </div>
  )
}
