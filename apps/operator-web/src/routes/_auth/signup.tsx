import { ShieldWarningIcon } from '@phosphor-icons/react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { z } from 'zod'

const signupSearchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/_auth/signup')({
  validateSearch: signupSearchSchema,
  component: SignupPage,
})

interface InviteValidation {
  email: string
  role: string
}

async function validateInviteToken(token: string): Promise<InviteValidation> {
  const res = await fetch(`/api/invites/validate?token=${encodeURIComponent(token)}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Invalid invite' })) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<InviteValidation>
}

async function acceptInvite(payload: {
  token: string
  name: string
  email: string
  password: string
}): Promise<void> {
  const res = await fetch('/api/invites/accept', {
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

function SignupStubPage() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <ShieldWarningIcon className="size-10 text-muted-foreground" />
      <div>
        <h2 className="font-heading text-xl font-semibold">Sign Up</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Signup is not available in this version. Contact your administrator
          for access.
        </p>
      </div>
      <Link to="/login" className="text-xs text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  )
}

function SignupWithTokenPage({ token }: { token: string }) {
  const router = useRouter()

  const validationQuery = useQuery({
    queryKey: ['invite-validate', token],
    queryFn: () => validateInviteToken(token),
    retry: false,
  })

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(false)

  const acceptMutation = useMutation({
    mutationFn: acceptInvite,
    onSuccess: () => {
      setSuccess(true)
      setTimeout(() => {
        void router.navigate({ to: '/login' })
      }, 2000)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!name.trim()) {
      setFormError('Name is required')
      return
    }
    if (!password) {
      setFormError('Password is required')
      return
    }
    if (password.length < 12) {
      setFormError('Password must be at least 12 characters')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match')
      return
    }

    if (!validationQuery.data) return

    acceptMutation.mutate({
      token,
      name: name.trim(),
      email: validationQuery.data.email,
      password,
    })
  }

  if (validationQuery.isPending) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Spinner />
        <p className="font-mono text-xs text-muted-foreground">Validating invite...</p>
      </div>
    )
  }

  if (validationQuery.error) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <ShieldWarningIcon className="size-10 text-muted-foreground" />
        <div>
          <h2 className="font-heading text-xl font-semibold">Invalid Invite</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {validationQuery.error.message}
          </p>
        </div>
        <Link to="/login" className="text-xs text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-heading text-base font-semibold text-foreground">Account created!</p>
        <p className="font-mono text-xs text-muted-foreground">Redirecting to sign in...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Create Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You were invited as <span className="font-mono text-foreground">{validationQuery.data.email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Email</p>
          <p className="font-mono text-xs text-foreground">{validationQuery.data.email}</p>
        </div>

        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Name</p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
          />
        </div>

        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Password</p>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 12 characters"
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Confirm Password</p>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        </div>

        {(formError || acceptMutation.error) && (
          <p className="font-mono text-xs text-destructive">
            {formError || acceptMutation.error?.message}
          </p>
        )}

        <Button
          type="submit"
          loading={acceptMutation.isPending}
          className="mt-1"
        >
          Create Account
        </Button>
      </form>

      <Link to="/login" className="text-center text-xs text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  )
}

function SignupPage() {
  const { token } = Route.useSearch()

  if (token) {
    return <SignupWithTokenPage token={token} />
  }

  return <SignupStubPage />
}
