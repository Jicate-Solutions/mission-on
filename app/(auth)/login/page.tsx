import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { verifySession } from '@/lib/dal'
import { roleHome } from '@/components/nav/nav-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in — Mission ON',
}

/**
 * Login page. Server component:
 *   - If already authenticated with a role, redirect straight to the role home
 *     (defence in depth alongside the proxy's optimistic check).
 *   - Otherwise render the client login form, threading a sanitised ?next.
 *
 * searchParams is async in Next.js 16.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await verifySession()
  if (session?.role) {
    redirect(roleHome(session.role))
  }

  const { next } = await searchParams
  // Only pass through a safe internal relative path.
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
      </CardHeader>
      <CardContent>
        <LoginForm next={safeNext} />
        <p className="mt-4 text-center text-sm text-ink-muted">
          <Link
            href="/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            Forgot your password?
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-ink-muted">
          New here?{' '}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
