import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { verifySession } from '@/lib/dal'
import { roleHome } from '@/components/nav/nav-config'
import { SignOutButton } from '@/components/nav/sign-out-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Account pending — Mission ON' }

/**
 * Holding page for an authenticated user who has no role yet (account created
 * but not allocated by an admin). Kept OUTSIDE the (app) group so it does not
 * trigger the layout's "no role -> /pending" redirect on itself. If a role has
 * since been granted, bounce to the role home.
 */
export default async function PendingPage() {
  const session = await verifySession()
  if (!session) redirect('/login')
  if (session.role) redirect(roleHome(session.role))

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Your account is being set up</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-ink-muted">
            You are signed in, but your program team has not assigned your role
            yet. Please check back shortly, or contact your coordinator.
          </p>
          <SignOutButton className="w-auto self-start" />
        </CardContent>
      </Card>
    </div>
  )
}
