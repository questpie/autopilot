import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
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
      <div className="bg-muted/40">
        <div className="bg-muted/30 px-4 py-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Two-Factor Authentication
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Authenticator App (TOTP)</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
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
            <div className="space-y-3 bg-muted/30 p-3">
              <p className="font-mono text-xs text-muted-foreground">
                Scan this URI with your authenticator app (or copy it manually):
              </p>
              <p className="break-all font-mono text-xs text-foreground">{totpUri}</p>
              <div className="space-y-1">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Verification Code</p>
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
                  <p className="font-mono text-xs text-destructive">
                    {totpError || verifyTotpMutation.error?.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Disable 2FA flow */}
          {twoFactorEnabled && (
            <div className="space-y-3 bg-muted/30 p-3">
              <p className="font-mono text-xs text-muted-foreground">
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
                <p className="font-mono text-xs text-destructive">
                  {disableError || disableTwoFactorMutation.error?.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Active sessions */}
      <div className="bg-muted/40">
        <div className="bg-muted/30 px-4 py-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Active Sessions
          </p>
        </div>
        <div>
          {sessionsQuery.isPending ? (
            <div className="flex items-center gap-2 px-4 py-4 text-muted-foreground">
              <Spinner size="sm" />
              <span className="font-mono text-xs">Loading sessions...</span>
            </div>
          ) : sessionsQuery.error ? (
            <p className="px-4 py-4 font-mono text-xs text-destructive">
              Failed to load sessions: {sessionsQuery.error.message}
            </p>
          ) : !sessionsQuery.data || sessionsQuery.data.length === 0 ? (
            <p className="px-4 py-4 font-mono text-xs text-muted-foreground">No active sessions.</p>
          ) : (
            sessionsQuery.data.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-foreground truncate">
                    {s.userAgent ?? 'Unknown client'}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {s.ipAddress ?? 'Unknown IP'} — expires{' '}
                    {new Date(s.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="destructive"
                  className="ml-4 shrink-0"
                  onClick={() => revokeSessionMutation.mutate(s.token)}
                  loading={
                    revokeSessionMutation.isPending &&
                    revokeSessionMutation.variables === s.token
                  }
                >
                  Revoke
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
