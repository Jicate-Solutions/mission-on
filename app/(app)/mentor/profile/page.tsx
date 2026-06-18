import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { getMentorSelfProfile } from './_lib/queries'
import { ProfileForm } from './profile-form'

export const metadata: Metadata = { title: 'My profile — Mission ON' }

export const dynamic = 'force-dynamic'

/**
 * Mentor self-service profile. Shows the mentor their own real profile (which
 * only Admins/Super Admins see in directories) and lets them edit contact
 * fields. Gated by the mentor-only route group AND requireRole(['mentor'])
 * inside the query.
 */
export default async function MentorProfilePage() {
  const data = await getMentorSelfProfile()

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-ink">My profile</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-ink-muted">
              We could not find a mentor profile for your account yet. An Admin
              creates your profile when you join the mentor team. Please check
              back later or report this via{' '}
              <Link
                href="/bug-reports"
                className="text-primary underline-offset-4 hover:underline"
              >
                bug reports
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { mentor } = data

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My profile</h1>
        <p className="mt-1 text-ink-muted">
          Learners only ever see your alias. Your real name, phone, college and
          course are visible to Admins and Super Admins.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {mentor.alias}
            {mentor.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="neutral">Inactive</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Your public alias and status are managed by Admins. Update your
            contact details below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-ink-muted">Real name</dt>
              <dd className="text-ink">{mentor.realName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-muted">Alias</dt>
              <dd className="text-ink">{mentor.alias}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <CardDescription>
            Keep these current so Admins can reach you for scheduling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            phone={mentor.phone}
            college={mentor.college}
            course={mentor.course}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>
            Manage the dates you are available — this feeds session scheduling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/mentor/availability"
            className="text-primary underline-offset-4 hover:underline"
          >
            Open my availability calendar →
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
