import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { checkAuth } from '@/lib/auth-check'
import { getApiBaseUrl } from '@/lib/env'
import { TerminalWindowIcon, ArrowClockwiseIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/_auth/setup')({
  component: SetupPage,
  beforeLoad: async () => {
    const result = await checkAuth()

    if (result.needs2FA) {
      throw redirect({ to: '/login/2fa' })
    }

    if (result.isAuthenticated && result.setupCompleted) {
      throw redirect({ to: '/' })
    }

    if (!result.noUsersExist && !result.isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
})

function SetupPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  // Poll /api/status every 5s — auto-navigate when a user is created
  const statusQuery = useQuery({
    queryKey: ['setup-status-poll'],
    queryFn: async () => {
      const base = getApiBaseUrl()
      const res = await fetch(`${base}/api/status`, { credentials: 'include' })
      if (!res.ok) return { userCount: 0 }
      return res.json() as Promise<{ userCount: number }>
    },
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (statusQuery.data && statusQuery.data.userCount > 0) {
      void router.navigate({ to: '/login' })
    }
  }, [statusQuery.data, router])

  const handleCheckAgain = async () => {
    setChecking(true)
    try {
      const result = await checkAuth()
      if (!result.noUsersExist) {
        await router.navigate({ to: '/login' })
        return
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex size-16 items-center justify-center bg-primary/[0.08]">
        <TerminalWindowIcon className="size-8 text-primary" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold">Create Your First Account</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          No users exist yet. Run the setup command in your terminal to create the owner account.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="bg-muted/40 p-4 text-left">
          <code className="text-sm font-mono text-foreground">autopilot auth setup</code>
        </div>
        <p className="text-xs text-muted-foreground text-left">
          For a remote orchestrator, add{' '}
          <code className="text-foreground">--url https://your-server.com</code>
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={handleCheckAgain}
          disabled={checking}
        >
          {checking ? (
            <>
              <Spinner size="sm" />
              Checking...
            </>
          ) : (
            <>
              <ArrowClockwiseIcon className="size-4" />
              Check again
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          This page auto-refreshes when a user is created.
        </p>
      </div>
    </div>
  )
}
