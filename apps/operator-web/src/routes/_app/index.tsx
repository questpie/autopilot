import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth'
import { useSession } from '@/hooks/use-session'
import { createFileRoute, useRouter } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({
  component: HomePage,
})

function HomePage() {
  const { user } = useSession()
  const router = useRouter()

  const handleLogout = async () => {
    await authClient.signOut()
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">QUESTPIE Autopilot</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user?.email}</span>
        </p>
      </div>
      <Button variant="outline" onClick={handleLogout}>
        Sign out
      </Button>
    </div>
  )
}
