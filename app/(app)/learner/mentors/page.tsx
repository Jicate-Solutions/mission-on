import type { Metadata } from 'next'

import { getMentorPublicList } from '@/lib/dal'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  getOwnChosenMentor,
  hasOpenChangeRequest,
} from '@/app/(app)/learner/_data/selection'
import { MentorPicker } from './mentor-picker'
import { ChangeRequestForm } from './change-request-form'

export const metadata: Metadata = { title: 'Choose a mentor — Mission ON' }

/**
 * Learner mentor browser. Lists ACTIVE mentors BY ALIAS (getMentorPublicList
 * returns zero real fields) and lets the learner choose one. If they already
 * have a mentor, they can ask to change (escalates to Admin).
 *
 * Auth: enforced by the learner-only group layout AND re-verified inside every
 * DAL/data call and Server Action this page reaches.
 */
export default async function LearnerMentorsPage() {
  // All three reads re-verify the learner session internally.
  const [mentors, chosen, openRequest] = await Promise.all([
    getMentorPublicList(),
    getOwnChosenMentor(),
    hasOpenChangeRequest(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Choose a mentor</h1>
        <p className="mt-1 text-ink-muted">
          Pick a mentor you feel comfortable with. You only ever see a mentor&apos;s
          chosen name here — never anyone&apos;s real details.
        </p>
      </div>

      {chosen ? (
        <Card>
          <CardHeader>
            <CardTitle>Your mentor</CardTitle>
            <CardDescription>
              You can keep your mentor, or ask an admin to help you change.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-ink">
                {chosen.mentor.alias}
              </p>
              <p className="text-sm text-ink-muted">
                What you share with your mentor stays private.
              </p>
            </div>
            <ChangeRequestForm
              currentMentorAlias={chosen.mentor.alias}
              hasOpenRequest={openRequest}
            />
          </CardContent>
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">
          {chosen ? 'All mentors' : 'Available mentors'}
        </h2>
        <MentorPicker
          mentors={mentors}
          chosenMentorId={chosen?.mentor.id ?? null}
          locked={openRequest}
        />
      </section>
    </div>
  )
}
