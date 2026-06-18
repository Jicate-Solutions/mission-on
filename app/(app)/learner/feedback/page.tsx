import type { Metadata } from 'next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requireRolePage } from '@/lib/dal'
import { listOwnFeedback } from './feedback-dal'
import { FeedbackForm } from './feedback-form'

export const metadata: Metadata = { title: 'Give feedback — Mission ON' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Learner feedback / assessment. The learner submits via the existing
 * submitFeedbackAction Server Action (which re-verifies learner role and
 * resolves their mentor target server-side) and sees their own past
 * submissions. STRICTLY learner-only (group layout + this page-level gate). No
 * real identity — the learner's own or anyone else's — is reachable here.
 */
export default async function LearnerFeedbackPage() {
  // Belt-and-braces: the learner group layout already gates this.
  await requireRolePage(['learner'])

  // Re-verifies learner role internally.
  const submitted = await listOwnFeedback()

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Give feedback</h1>
        <p className="mt-1 text-ink-muted">
          Tell us how your sessions are going. You can send as many as you like —
          it helps us make Mission ON better for you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Share your feedback</CardTitle>
          <CardDescription>
            All ratings are optional except the overall one. You can choose to
            send it anonymously.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeedbackForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your past feedback</CardTitle>
          <CardDescription>
            Only you can see this list. Mentors only see feedback you send to
            them, and never your name if you send it anonymously.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted.length === 0 ? (
            <p className="text-sm text-ink-muted">
              You haven&apos;t sent any feedback yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {submitted.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-border bg-surface-muted/40 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="brand">
                      Overall {item.answers.rating}/5
                    </Badge>
                    {item.answers.mentorHelpfulness ? (
                      <Badge variant="neutral">
                        Mentor {item.answers.mentorHelpfulness}/5
                      </Badge>
                    ) : null}
                    {item.answers.sessionImpact ? (
                      <Badge variant="neutral">
                        Impact {item.answers.sessionImpact}/5
                      </Badge>
                    ) : null}
                    {item.isAnonymous ? (
                      <Badge variant="info">Sent anonymously</Badge>
                    ) : null}
                    <span className="ml-auto whitespace-nowrap text-xs text-ink-muted">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  {item.answers.comment ? (
                    <p className="mt-2 text-sm text-ink">
                      {item.answers.comment}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
