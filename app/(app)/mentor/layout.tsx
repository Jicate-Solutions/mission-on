import type { ReactNode } from 'react'

import { requireRolePage } from '@/lib/dal'

/**
 * mentor route group gate. STRICTLY mentor-only.
 *
 * Ring 1 confidentiality (PRD §12): one-on-one Learner content is confidential
 * to the Mentor (and the JKKN counsellor). Admins/super_admins do NOT enter the
 * mentor UI — they access permitted data through their own admin pages via the
 * DAL, never by inhabiting a mentor's session view. So no oversight roles here.
 */
export default async function MentorLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireRolePage(['mentor'])
  return <>{children}</>
}
