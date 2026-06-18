import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { verifySession } from '@/lib/dal'
import { roleHome } from '@/components/nav/nav-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Create account — Mission ON',
}

/**
 * Sign-up page. Server component:
 *   - If already authenticated with a role, redirect to the role home.
 *   - If authenticated but not yet allocated a role, send to /pending.
 *   - Otherwise render the client sign-up form.
 *
 * Self-signup creates an Auth account only; an admin allocates the role later
 * (see signUp in lib/auth/actions.ts and the /pending holding page). The proxy
 * already treats /signup as a public auth route.
 */
export default async function SignupPage() {
  const session = await verifySession()
  if (session?.role) {
    redirect(roleHome(session.role))
  }
  if (session) {
    redirect('/pending')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
      </CardHeader>
      <CardContent>
        <SignupForm />
        <p className="mt-4 text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
