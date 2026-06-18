import type { ReactNode } from 'react'

import { requireRolePage } from '@/lib/dal'

/**
 * super_admin route group gate. Only super_admin may enter; any other role is
 * redirected away by requireRolePage(). This is defence-in-depth: even a direct
 * URL to /super-admin/* cannot render for a lesser role.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireRolePage(['super_admin'])
  return <>{children}</>
}
