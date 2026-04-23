import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SurfaceSection } from '@/components/ui/surface-section'
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
			<SurfaceSection title="Profile" contentClassName="space-y-4">
					<div className="space-y-1">
						<p className="text-xs font-medium text-muted-foreground">Email</p>
						<p className="text-sm text-muted-foreground">{user?.email ?? '—'}</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs font-medium text-muted-foreground">Display name</p>
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
							<p className="text-sm text-destructive">{nameError}</p>
						)}
						{updateNameMutation.error && (
							<p className="text-sm text-destructive">
								{updateNameMutation.error.message}
							</p>
						)}
					</div>
			</SurfaceSection>

			{/* Change password */}
			<SurfaceSection title="Change password" contentClassName="space-y-3">
					<div className="space-y-1">
						<p className="text-xs font-medium text-muted-foreground">Current password</p>
						<Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="max-w-xs"
              placeholder="Current password"
            />
					</div>
					<div className="space-y-1">
						<p className="text-xs font-medium text-muted-foreground">New password</p>
						<Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="max-w-xs"
              placeholder="Min 12 characters"
            />
					</div>
					<div className="space-y-1">
						<p className="text-xs font-medium text-muted-foreground">Confirm new password</p>
						<Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="max-w-xs"
              placeholder="Repeat new password"
            />
          </div>
					{passwordError && (
						<p className="text-sm text-destructive">{passwordError}</p>
					)}
					{changePasswordMutation.error && (
						<p className="text-sm text-destructive">
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
			</SurfaceSection>
		</div>
	)
}
