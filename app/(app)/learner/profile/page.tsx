import type { Metadata } from 'next'

import { getLearnerProfile } from './_data'
import { ProfileForm } from './profile-form'
import { requireRolePage } from '@/lib/dal'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata: Metadata = { title: 'My profile — Mission ON' }

// Per-user data: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

/**
 * Learner self-profile (PRD §9.5). Shows the learner's own alias, real name,
 * school and contact number; lets them edit their alias + contact number (real
 * name + school are admin-set). Double-gated: learner route-group layout +
 * requireRolePage + the data/action calls re-verify internally.
 */
export default async function LearnerProfilePage() {
  await requireRolePage(['learner'])
  const profile = await getLearnerProfile()

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My profile</h1>
        <p className="mt-1 text-ink-muted">
          Your details. You can update your alias and contact number — your name
          and school are set by the program team.
        </p>
      </div>

      {!profile.hasProfile ? (
        <Card>
          <CardHeader>
            <CardTitle>Profile not ready yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-ink-muted">
              Your profile is still being set up by the program team. Check back
              soon.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Set by the program team</CardTitle>
              <CardDescription>
                These are managed for you and can&apos;t be edited here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-ink-muted">Name</dt>
                  <dd className="text-ink">{profile.realName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-ink-muted">School</dt>
                  <dd className="text-ink">{profile.schoolName ?? '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Editable</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm
                alias={profile.alias ?? ''}
                contactNumber={profile.contactNumber}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
