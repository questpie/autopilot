import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { SurfaceSection } from '@/components/ui/surface-section'
import { surfaceCardVariants } from '@/components/ui/surface-card'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/use-session'

export function SecuritySettings() {
  const { user, refetch: refetchSession } = useSession()
  const queryClient = useQueryClient()

  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpError, setTotpError] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [disableError, setDisableError] = useState('')

  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const result = await authClient.listSessions()
      if (result.error) throw new Error(result.error.message)
      return result.data ?? []
    },
  })

  const enableTwoFactorMutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.twoFactor.enable({ password: '' })
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: async () => {
      const uriResult = await authClient.twoFactor.getTotpUri({ password: '' })
      if (uriResult.error) throw new Error(uriResult.error.message)
      setTotpUri(uriResult.data?.totpURI ?? null)
    },
  })

  const verifyTotpMutation = useMutation({
    mutationFn: async (code: string) => {
      const result = await authClient.twoFactor.verifyTotp({ code })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => {
      setTotpUri(null)
      setTotpCode('')
      setTotpError('')
      void refetchSession()
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })

  const disableTwoFactorMutation = useMutation({
    mutationFn: async (password: string) => {
      const result = await authClient.twoFactor.disable({ password })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => {
      setDisablePassword('')
      setDisableError('')
      void refetchSession()
      void queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })

  const revokeSessionMutation = useMutation({
    mutationFn: async (token: string) => {
      const result = await authClient.revokeSession({ token })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  })

  function handleStartEnable() {
    setTotpError('')
    enableTwoFactorMutation.mutate()
  }

  function handleVerifyTotp() {
    setTotpError('')
    if (!totpCode.trim()) {
      setTotpError('Enter the 6-digit code from your authenticator app')
      return
    }
    verifyTotpMutation.mutate(totpCode.trim())
  }

  function handleDisable() {
    setDisableError('')
    if (!disablePassword) {
      setDisableError('Password is required to disable 2FA')
      return
    }
    disableTwoFactorMutation.mutate(disablePassword)
  }

  const twoFactorEnabled = user?.twoFactorEnabled ?? false

	return (
		<div className="space-y-6">
			{/* 2FA */}
			<SurfaceSection title="Two-factor authentication" contentClassName="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-foreground">Authenticator App (TOTP)</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{twoFactorEnabled ? 'Enabled — your account is protected with 2FA.' : 'Disabled — enable for extra security.'}
							</p>
            </div>
            {!twoFactorEnabled && !totpUri && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartEnable}
                loading={enableTwoFactorMutation.isPending}
              >
                Enable 2FA
              </Button>
            )}
            {twoFactorEnabled && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {}}
              >
                Disable 2FA
              </Button>
            )}
          </div>

					{/* QR / TOTP URI setup flow */}
					{totpUri && (
						<div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
							<p className="text-sm text-muted-foreground">
								Scan this URI with your authenticator app (or copy it manually):
							</p>
							<p className="break-all font-mono text-[12px] text-foreground">{totpUri}</p>
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">Verification code</p>
                <div className="flex gap-2">
                  <Input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="000000"
                    className="max-w-[140px]"
                    maxLength={6}
                  />
                  <Button
                    size="sm"
                    onClick={handleVerifyTotp}
                    loading={verifyTotpMutation.isPending}
                  >
                    Verify
                  </Button>
                </div>
								{(totpError || verifyTotpMutation.error) && (
									<p className="text-sm text-destructive">
										{totpError || verifyTotpMutation.error?.message}
									</p>
								)}
              </div>
            </div>
          )}

					{/* Disable 2FA flow */}
					{twoFactorEnabled && (
						<div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
							<p className="text-sm text-muted-foreground">
								Enter your password to disable two-factor authentication.
							</p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Your password"
                  className="max-w-xs"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDisable}
                  loading={disableTwoFactorMutation.isPending}
                >
                  Disable
                </Button>
              </div>
							{(disableError || disableTwoFactorMutation.error) && (
								<p className="text-sm text-destructive">
									{disableError || disableTwoFactorMutation.error?.message}
								</p>
							)}
						</div>
					)}
			</SurfaceSection>

			{/* Active sessions */}
			<SurfaceSection title="Active sessions" contentClassName="p-0">
					{sessionsQuery.isPending ? (
						<div className="flex items-center gap-2 px-4 py-4 text-muted-foreground">
							<Spinner size="sm" />
							<span className="text-sm">Loading sessions...</span>
						</div>
					) : sessionsQuery.error ? (
						<p className="px-4 py-4 text-sm text-destructive">
							Failed to load sessions: {sessionsQuery.error.message}
						</p>
					) : !sessionsQuery.data || sessionsQuery.data.length === 0 ? (
						<p className="px-4 py-4 text-sm text-muted-foreground">No active sessions.</p>
					) : (
						<div className="space-y-2 px-4 py-4">
							{sessionsQuery.data.map((s) => (
								<div key={s.id} className={cn(surfaceCardVariants({ size: 'sm' }), 'flex items-center justify-between gap-4')}>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-foreground">
											{s.userAgent ?? 'Unknown client'}
										</p>
										<p className="mt-1 text-xs text-muted-foreground tabular-nums">
											{s.ipAddress ?? 'Unknown IP'} — expires {new Date(s.expiresAt).toLocaleDateString()}
										</p>
									</div>
									<Button
										size="xs"
										variant="destructive"
										onClick={() => revokeSessionMutation.mutate(s.token)}
										loading={
											revokeSessionMutation.isPending &&
											revokeSessionMutation.variables === s.token
										}
									>
										Revoke
									</Button>
								</div>
							))}
						</div>
					)}
			</SurfaceSection>
		</div>
	)
}
