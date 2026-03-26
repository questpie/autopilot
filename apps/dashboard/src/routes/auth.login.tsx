import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/auth/login')({
	component: LoginPage,
})

/**
 * Login page component.
 *
 * CSRF protection is handled server-side by Better Auth which validates the
 * Origin header on all mutation requests. Session cookies use SameSite=Strict
 * to prevent cross-site request forgery. No additional client-side CSRF token
 * is needed.
 */
function LoginPage() {
	const navigate = useNavigate()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError(null)
		setLoading(true)

		try {
			const res = await fetch('/api/auth/sign-in/email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
				credentials: 'include',
			})

			if (!res.ok) {
				const body = (await res.json().catch(() => ({ error: 'Login failed' }))) as {
					error: string
				}
				setError(body.error)
				return
			}

			const data = (await res.json()) as { token?: string }
			if (data.token) {
				localStorage.setItem('autopilot-token', data.token)
			}

			navigate({ to: '/', search: { pin: '', view: 'kanban' } })
		} catch {
			setError('Could not connect to orchestrator')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="w-full max-w-sm space-y-6 p-8">
				<div className="text-center">
					<h1 className="text-2xl font-bold tracking-tight text-foreground">
						QUESTPIE Autopilot
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">Sign in to your dashboard</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<div className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400 border border-red-500/20">
							{error}
						</div>
					)}

					<div className="space-y-1">
						<label htmlFor="email" className="text-sm text-muted-foreground">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							placeholder="you@company.com"
						/>
					</div>

					<div className="space-y-1">
						<label htmlFor="password" className="text-sm text-muted-foreground">
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							placeholder="••••••••"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{loading ? 'Signing in...' : 'Sign in'}
					</button>
				</form>
			</div>
		</div>
	)
}
