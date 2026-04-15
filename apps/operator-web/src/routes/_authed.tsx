import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { checkAuth } from '@/lib/auth-check'
import { QUESTPIESpinner } from '@/components/brand'
import { ShellLayout } from '@/features/shell'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const auth = await checkAuth()
    if (auth.noUsersExist || !auth.setupCompleted) throw redirect({ to: '/setup' })
    if (auth.needs2FA) throw redirect({ to: '/login/2fa' })
    if (!auth.isAuthenticated) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user: auth.user }
  },
  pendingComponent: () => (
    <div className="flex h-screen items-center justify-center bg-background">
      <QUESTPIESpinner size={48} />
    </div>
  ),
  component: () => (
    <ShellLayout>
      <Outlet />
    </ShellLayout>
  ),
})
