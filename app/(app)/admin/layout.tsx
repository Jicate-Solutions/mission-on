import type { ReactNode } from 'react'

import { requireRolePage } from '@/lib/dal'

/**
 * admin route group gate. admin owns it; super_admin is allowed in for
 * administrative oversight (per the RBAC matrix, super_admin can do everything
 * an admin can). Coordinator / mentor / learner are redirected away.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireRolePage(['admin', 'super_admin'])
  return <>{children}</>
}
