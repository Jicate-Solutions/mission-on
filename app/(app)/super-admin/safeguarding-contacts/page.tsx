import type { Metadata } from 'next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireRolePage } from '@/lib/dal'
import { getSafeguardingContacts } from '@/app/(app)/admin/safeguarding/_contacts'

import { ContactsEditor } from './contacts-editor'

export const metadata: Metadata = {
  title: 'Safeguarding contacts — Super Admin — Mission ON',
}

// Single-row config edited live: never serve a stale cached copy.
export const dynamic = 'force-dynamic'

/**
 * Super Admin editor for the named safeguarding contacts (PRD §12 — designated
 * safeguarding lead / named safeguarding contacts). These appear read-only to
 * all admins on the safeguarding queue. Only super_admin may edit (the program_
 * config write policy enforces this at the database too).
 */
export default async function SafeguardingContactsPage() {
  await requireRolePage(['super_admin'])
  const contacts = await getSafeguardingContacts()

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          Safeguarding contacts
        </h1>
        <p className="mt-1 text-ink-muted">
          The designated safeguarding lead and other named contacts. These are
          shown to every admin on the safeguarding queue so they know who to
          reach. Every change is recorded in the audit log.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Named contacts</CardTitle>
          <CardDescription>
            Each contact needs a name and a phone number. Role / title and email
            are optional but recommended.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactsEditor contacts={contacts} />
        </CardContent>
      </Card>
    </div>
  )
}
