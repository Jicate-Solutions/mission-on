import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireRolePage } from '@/lib/dal'
import { listCoordinatorOptions } from '@/app/api/schools/_lib/pipeline'
import { CreateSchoolForm } from '@/app/(app)/admin/schools/_components/create-school-form'

export const metadata: Metadata = { title: 'New school — Mission ON' }

/**
 * Super Admin: create a school record and (optionally) assign a coordinator —
 * the super_admin mirror of the admin create flow. Reuses the admin
 * CreateSchoolForm; its create Server Action re-verifies the role.
 */
export default async function SuperAdminNewSchoolPage() {
  await requireRolePage(['super_admin'])
  const coordinators = await listCoordinatorOptions()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/super-admin/schools"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Schools
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">New school</h1>
        <p className="mt-1 text-ink-muted">
          Onboard a school and assign its coordinator. The school never sees its
          own classification.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>School details</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateSchoolForm
            coordinators={coordinators.map((c) => ({
              userId: c.userId,
              label: c.label,
            }))}
            basePath="/super-admin/schools"
          />
        </CardContent>
      </Card>
    </div>
  )
}
