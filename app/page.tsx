import { redirect } from 'next/navigation'

import { verifySession } from '@/lib/dal'
import { roleHome } from '@/components/nav/nav-config'

/**
 * Root landing. Unauthenticated -> /login. Authenticated with a role -> role
 * home. Authenticated without a role -> /pending. Kept as a pure redirector so
 * there is no public marketing surface for a minor-facing, no-index app.
 */
export default async function RootPage() {
  const session = await verifySession()
  if (!session) redirect('/login')
  if (!session.role) redirect('/pending')
  redirect(roleHome(session.role))
}
