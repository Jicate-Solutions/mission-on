import type { ReactNode } from 'react'

import { requireRolePage } from '@/lib/dal'

/**
 * learner route group gate. STRICTLY learner-only.
 *
 * The learner space is a minor's private area (their mentor choice, sessions,
 * feedback). No other role inhabits it — staff use their own role pages. This
 * keeps the learner experience and any self-view data isolated to the learner.
 */
export default async function LearnerLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireRolePage(['learner'])
  return <>{children}</>
}
