import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { verifySession, getOwnMentorFull } from '@/lib/dal'
import { AppShell } from '@/components/nav/app-shell'
import { NAV_CONFIG, ROLE_LABEL, roleHome } from '@/components/nav/nav-config'
import { BugReporterWrapper } from '@/components/bug-reporter/bug-reporter-wrapper'

/**
 * Authenticated app shell layout (route group app/(app)/*).
 *
 * SECURITY (layer 2 — the DAL): this server component re-verifies the session
 * via verifySession() (validates the JWT + reads the role under RLS). The proxy
 * already did an optimistic cookie check, but THIS is the real gate for the
 * group. Wrong-role-into-another-group is additionally blocked by each role
 * layout's requireRolePage().
 *
 * Identity in the header is ALIAS-FIRST: for a mentor we surface their alias
 * (never real_name/phone); for every other role we show a neutral label. We do
 * NOT pull learner real (minor) data into the shell.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await verifySession()
  if (!session) redirect('/login')
  if (!session.role) redirect('/pending')

  const role = session.role
  const sections = NAV_CONFIG[role]
  const roleLabel = ROLE_LABEL[role]
  const homeHref = roleHome(role)

  // Alias-only display name. Mentors have a public alias; for other roles we
  // intentionally avoid surfacing any restricted identity in the chrome.
  let displayName = 'You'
  if (role === 'mentor') {
    const mentor = await getOwnMentorFull()
    if (mentor?.alias) displayName = mentor.alias
  }

  return (
    <AppShell
      sections={sections}
      displayName={displayName}
      roleLabel={roleLabel}
      homeHref={homeHref}
    >
      {/* Centralized reporting: the JKKN Bug Reporter SDK widget routes reports
          to the external Bug Boundary platform. Auth-only (this group), and
          dormant until NEXT_PUBLIC_BUG_REPORTER_* land in .env.local. The SDK
          provider renders its OWN floating button + toaster when configured. */}
      <BugReporterWrapper>{children}</BugReporterWrapper>
    </AppShell>
  )
}
