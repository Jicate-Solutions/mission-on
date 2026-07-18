import type { Metadata } from 'next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireRolePage } from '@/lib/dal'

import { listAccessCodes } from './_lib/queries'
import { AccessCodeRoster } from '@/components/access-codes/access-code-roster'
import { GenerateCodeDialog } from '@/components/access-codes/generate-code-dialog'

export const metadata: Metadata = {
  title: 'Access codes — Super Admin — Mission ON',
}

// Per-user sensitive data (access-code roster): never cache.
export const dynamic = 'force-dynamic'

/**
 * Access-code lifecycle (doc/update.md §3-4). SUPER ADMIN EXCLUSIVE — the
 * route-group layout already requires super_admin; this page re-asserts it,
 * and every Server Action in _lib/actions.ts re-verifies role internally.
 *
 * This is the onboarding path for every non-super-admin role: generating a
 * code here both creates the account and issues its permanent sign-in code.
 * Role CHANGES for already-existing users remain a separate concern, handled
 * by the existing /admin/roles and /super-admin/roles pages.
 */
export default async function AccessCodesPage() {
  await requireRolePage(['super_admin'])

  const codes = await listAccessCodes()
  const activeCount = codes.filter((c) => c.status === 'active').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Access codes</h1>
          <p className="mt-1 text-ink-muted">
            Every admin, coordinator, mentor, and learner signs in with a
            personal access code instead of a password. Generate one when you
            create their account; revoke or regenerate it any time.
          </p>
        </div>
        <GenerateCodeDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issued codes</CardTitle>
          <CardDescription>
            {codes.length} code{codes.length === 1 ? '' : 's'} · {activeCount}{' '}
            active
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-ink-muted">
              No access codes yet. Generate one above to onboard your first
              coded user.
            </p>
          ) : (
            <AccessCodeRoster codes={codes} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
