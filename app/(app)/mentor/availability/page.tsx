import type { Metadata } from 'next'
import Link from 'next/link'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { getOwnAvailability } from '../profile/_lib/queries'
import { AvailabilityManager } from './availability-manager'

export const metadata: Metadata = { title: 'My availability — Mission ON' }

export const dynamic = 'force-dynamic'

/**
 * Mentor availability calendar (self-service). The mentor adds/removes the
 * dates and times they are available; this feeds Admin session allocation.
 * Gated by the mentor-only route group AND requireRole(['mentor']) in the query
 * and every action. A mentor only ever sees/edits their OWN slots.
 */
export default async function MentorAvailabilityPage() {
  const slots = await getOwnAvailability()

  if (slots === null) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-ink">My availability</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-ink-muted">
              We could not find a mentor profile for your account yet. An Admin
              creates your profile when you join the mentor team. Once that is
              done you can set your availability here. See your{' '}
              <Link
                href="/mentor/profile"
                className="text-primary underline-offset-4 hover:underline"
              >
                profile
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My availability</h1>
        <p className="mt-1 text-ink-muted">
          Add the dates and times you can deliver follow-through sessions.
          Admins use this calendar to schedule you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Availability calendar</CardTitle>
          <CardDescription>
            Leave both times blank for a full-day slot, or set a window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvailabilityManager slots={slots} />
        </CardContent>
      </Card>
    </div>
  )
}
