import { redirect } from 'next/navigation'

import { verifySession } from '@/lib/dal'
import { roleHome } from '@/components/nav/nav-config'

/**
 * /dashboard — a role router, not a page. The proxy sends authenticated users
 * here from auth pages, and requireRolePage() sends wrong-role users here. We
 * resolve the verified role and bounce to the correct role home so there is a
 * single, stable post-login target that does not need to know the role.
 *
 * No session  -> /login.  Session without a role -> /pending.
 */
export default async function DashboardRouter() {
  const session = await verifySession()
  if (!session) redirect('/login')
  if (!session.role) redirect('/pending')
  redirect(roleHome(session.role))
}
