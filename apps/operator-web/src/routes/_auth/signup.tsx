import { ShieldWarningIcon } from '@phosphor-icons/react'
import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/signup')({
  component: SignupStubPage,
})

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
