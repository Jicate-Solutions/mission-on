import type { Metadata } from 'next'
import Link from 'next/link'

import { verifySession } from '@/lib/dal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResetPasswordForm } from './reset-password-form'

export const metadata: Metadata = { title: 'Set new password — Mission ON' }

// The recovery session is established at request time via /auth/callback.
export const dynamic = 'force-dynamic'

/**
 * Set-new-password page. Reached from the recovery email link (after
 * /auth/callback establishes the session) or by any signed-in user. If there is
 * no session (e.g. an expired link followed directly), guide the user to request
 * a fresh link rather than showing a form that can't submit.
 */
export default async function ResetPasswordPage() {
  const session = await verifySession()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
      </CardHeader>
      <CardContent>
        {session ? (
          <ResetPasswordForm />
        ) : (
          <p className="text-sm text-ink-muted">
            This password-reset link is invalid or has expired.{' '}
            <Link
              href="/forgot-password"
              className="font-medium text-primary hover:underline"
            >
              Request a new link
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  )
}
