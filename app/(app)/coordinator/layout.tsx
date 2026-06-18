import type { ReactNode } from 'react'

import { requireRolePage } from '@/lib/dal'

/**
 * coordinator route group gate. coordinator owns it; admin and super_admin are
 * allowed in for oversight of the school pipeline (they can run/update stages
 * for all schools per the RBAC matrix). mentor / learner are redirected away.
 */
export default async function CoordinatorLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireRolePage(['coordinator', 'admin', 'super_admin'])
  return <>{children}</>
}
