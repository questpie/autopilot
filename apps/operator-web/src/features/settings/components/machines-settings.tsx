import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KvList } from '@/components/ui/kv-list'
import { Spinner } from '@/components/ui/spinner'
import { StatusPill } from '@/components/ui/status-pill'
import { SurfaceSection } from '@/components/ui/surface-section'
import { surfaceCardVariants } from '@/components/ui/surface-card'
import { useWorkers } from '@/hooks/use-workers'
import { useCreateJoinToken } from '@/hooks/use-enrollment'
import { cn } from '@/lib/utils'

interface MachinesSettingsProps {
  canManageMachines: boolean
}

function formatTimestamp(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function workerStatusPill(status: 'online' | 'busy' | 'offline') {
  if (status === 'busy') return { status: 'working' as const, label: 'busy' }
  if (status === 'online') return { status: 'done' as const, label: 'online' }
  return { status: 'pending' as const, label: 'offline' }
}

export function MachinesSettings({ canManageMachines }: MachinesSettingsProps) {
  const workersQuery = useWorkers()
  const createJoinToken = useCreateJoinToken()

  const [joinDescription, setJoinDescription] = useState('')
  const [latestToken, setLatestToken] = useState<{ secret: string; expiresAt: string; description: string } | null>(null)

  const workers = workersQuery.data ?? []
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const joinCommand = useMemo(() => {
    if (!latestToken || !origin) return ''
    const machineName = latestToken.description.trim()
    const nameArg = machineName ? ` --name ${JSON.stringify(machineName)}` : ''
    return `autopilot worker start --url ${origin} --token ${latestToken.secret}${nameArg}`
  }, [latestToken, origin])

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch (_error) {
      toast.error(`Failed to copy ${label.toLowerCase()}`)
    }
  }

  async function handleCreateToken() {
    try {
      const result = await createJoinToken.mutateAsync({
        description: joinDescription.trim() || undefined,
        ttlSeconds: 3600,
      })
      setLatestToken({
        secret: result.secret,
        expiresAt: result.expires_at,
        description: joinDescription.trim(),
      })
      toast.success('Join token created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create join token')
    }
  }

	return (
		<div className="space-y-6">
			<SurfaceSection title="Workers" contentClassName="p-0">

				{workersQuery.isLoading ? (
					<div className="flex items-center gap-2 px-4 py-4 text-muted-foreground">
						<Spinner size="sm" />
						<span className="text-sm">Loading workers…</span>
					</div>
				) : workersQuery.isError ? (
					<div className="px-4 py-4">
						<p className="text-sm text-destructive">Failed to load workers.</p>
					</div>
				) : workers.length === 0 ? (
					<div className="px-4 py-4">
						<p className="text-sm text-muted-foreground">No workers registered yet.</p>
					</div>
				) : (
					<div className="space-y-2 px-4 py-4">
            {workers.map((worker) => {
              const pill = workerStatusPill(worker.status)
              const capabilitySummary = worker.capabilities
                .map((cap) => {
                  const tags = cap.tags.length > 0 ? ` [${cap.tags.join(', ')}]` : ''
                  return `${cap.runtime}${tags}`
                })
                .join(', ')

							return (
								<div key={worker.id} className={cn(surfaceCardVariants({ size: 'sm' }), 'space-y-3')}>
									<div className="mb-3 flex items-center justify-between gap-3">
										<div className="min-w-0">
											<p className="truncate text-sm text-foreground">{worker.name ?? worker.id}</p>
											<p className="truncate text-xs text-muted-foreground">{worker.id}</p>
										</div>
										<StatusPill status={pill.status} label={pill.label} />
                  </div>

                  <KvList
                    items={[
											{
												label: 'Capabilities',
												value: <span className="text-sm text-muted-foreground">{capabilitySummary || '—'}</span>,
											},
											{
												label: 'Registered',
												value: <span className="text-sm text-muted-foreground tabular-nums">{formatTimestamp(worker.registered_at)}</span>,
											},
											{
												label: 'Heartbeat',
												value: <span className="text-sm text-muted-foreground tabular-nums">{formatTimestamp(worker.last_heartbeat)}</span>,
											},
										]}
									/>
								</div>
              )
            })}
          </div>
        )}
			</SurfaceSection>

			<SurfaceSection title="Join this computer" contentClassName="space-y-4">
					<p className="text-sm text-muted-foreground">
						Create a one-time join token and start a worker that connects this machine to the current orchestrator.
					</p>

					<div className="space-y-2">
						<label className="block text-xs font-medium text-muted-foreground">Machine label</label>
						<Input
              value={joinDescription}
              onChange={(event) => setJoinDescription(event.target.value)}
              placeholder="Andrej laptop"
              disabled={!canManageMachines || createJoinToken.isPending}
            />
          </div>

					{canManageMachines ? (
						<div className="flex items-center gap-2">
							<Button size="sm" onClick={() => void handleCreateToken()} loading={createJoinToken.isPending}>
								Create join token
							</Button>
							<span className="text-xs text-muted-foreground">expires in 1 hour</span>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							Owner or admin role is required to create join tokens.
						</p>
					)}

					{latestToken && (
						<div className={cn(surfaceCardVariants({ size: 'sm' }), 'space-y-3')}>
							<KvList
								items={[
									{
										label: 'Token',
										value: <span className="font-mono text-[12px] break-all">{latestToken.secret}</span>,
                  },
                  {
                    label: 'Expires',
                    value: <span className="font-mono text-[12px] text-muted-foreground">{formatTimestamp(latestToken.expiresAt)}</span>,
                  },
							]}
							/>

							<div className="space-y-2">
								<p className="text-xs font-medium text-muted-foreground">Command</p>
								<div className="rounded-lg border border-border/60 bg-muted/20 p-3 font-mono text-[12px] text-foreground break-all">
									{joinCommand}
								</div>
							</div>

              <div className="flex flex-wrap gap-2">
                <Button size="xs" variant="outline" onClick={() => void copyText(latestToken.secret, 'Token')}>
                  Copy token
                </Button>
                <Button size="xs" variant="outline" onClick={() => void copyText(joinCommand, 'Command')}>
                  Copy command
                </Button>
              </div>

							<p className="text-sm text-warning">
								The token secret is shown only once. Store it before closing this page.
							</p>
						</div>
					)}
			</SurfaceSection>
		</div>
	)
}
