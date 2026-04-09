import { QUESTPIESpinner } from '@/components/brand'
import { Toaster } from '@/components/ui/sonner'
import { checkAuth } from '@/lib/auth-check'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const result = await checkAuth()

    if (result.noUsersExist) {
      throw redirect({ to: '/setup' })
    }

    if (result.needs2FA) {
      throw redirect({ to: '/login/2fa' })
    }

    if (!result.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }

    if (!result.setupCompleted) {
      throw redirect({ to: '/setup' })
    }

    return { user: result.user }
  },
  pendingComponent: AuthPending,
  component: AppLayout,
})

function AuthPending() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <QUESTPIESpinner size={32} />
    </div>
  )
}

function AppLayout() {
  return (
    <>
      <Outlet />
      <Toaster
        position="bottom-right"
        dir="ltr"
        gap={8}
        visibleToasts={5}
        toastOptions={{ duration: 4000 }}
      />
    </>
  )
}
