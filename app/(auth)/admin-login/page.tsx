import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { verifySession } from '@/lib/dal'
import { roleHome } from '@/components/nav/nav-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminLoginForm } from './admin-login-form'

export const metadata: Metadata = {
  title: 'Super Admin sign in — Mission ON',
}

/**
 * Super Admin credential login (doc/update.md §2). Every other role signs in
 * with an access code at /login instead — signIn() itself rejects any
 * resolved role other than super_admin, so this route grants nothing beyond
 * what the DAL already enforces; it exists to give Super Admins a real
 * email+password form rather than an access-code field.
 *
 * searchParams is async in Next.js 16.
 */
export default async function AdminLoginPage({
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
        <CardTitle>Super Admin sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <AdminLoginForm next={safeNext} />
        <p className="mt-4 text-center text-sm text-ink-muted">
          <Link
            href="/forgot-password"
            className="font-medium text-primary hover:underline"
          >
            Forgot your password?
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-ink-muted">
          Not a Super Admin?{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in with an access code
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
