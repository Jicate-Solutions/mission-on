import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata: Metadata = { title: 'Reset password — Mission ON' }

/**
 * Public forgot-password page. Sends a recovery email (non-enumerating). The
 * link routes via /auth/callback to /reset-password where the new password is set.
 */
export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-ink-muted">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
        <ForgotPasswordForm />
        <p className="mt-4 text-center text-sm text-ink-muted">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
