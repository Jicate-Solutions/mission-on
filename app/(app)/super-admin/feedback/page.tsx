import type { Metadata } from 'next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireRolePage } from '@/lib/dal'
import { getFeedbackAggregate } from '@/app/(app)/learner/feedback/feedback-dal'

export const metadata: Metadata = { title: 'Feedback — Mission ON' }

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string
  value: number | null
  suffix?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="mt-1 text-3xl font-semibold text-ink">
          {value === null ? '—' : value}
          {value !== null && suffix ? (
            <span className="text-base font-normal text-ink-muted">
              {suffix}
            </span>
          ) : null}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Super Admin feedback overview — the super_admin mirror of the admin view.
 * AGGREGATE / ANONYMIZED ONLY (Ring 2, PRD §12): counts, averages, and a rating
 * distribution. No per-learner row, comment, or identity crosses here —
 * getFeedbackAggregate() returns only numbers and re-verifies the role
 * (is_admin_role covers super_admin).
 */
export default async function SuperAdminFeedbackPage() {
  await requireRolePage(['super_admin'])

  // Re-verifies admin/super_admin internally; returns numbers only.
  const agg = await getFeedbackAggregate()

  const maxBar = Math.max(1, ...agg.ratingDistribution)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Feedback</h1>
        <p className="mt-1 text-ink-muted">
          A high-level, anonymized view of learner feedback. Individual responses
          and identities are never shown here — only counts and averages.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total responses" value={agg.total} />
        <StatCard
          label="Average overall"
          value={agg.averageRating}
          suffix=" / 5"
        />
        <StatCard
          label="Avg. mentor helpfulness"
          value={agg.averageMentorHelpfulness}
          suffix=" / 5"
        />
        <StatCard
          label="Avg. session impact"
          value={agg.averageSessionImpact}
          suffix=" / 5"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall rating distribution</CardTitle>
          <CardDescription>
            How many learners gave each overall rating (1–5).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agg.total === 0 ? (
            <p className="text-sm text-ink-muted">No feedback yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {agg.ratingDistribution.map((count, index) => {
                const rating = index + 1
                const pct = Math.round((count / agg.total) * 100)
                return (
                  <li key={rating} className="flex items-center gap-3">
                    <span className="w-8 shrink-0 text-sm font-medium text-ink">
                      {rating}★
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(count / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-sm text-ink-muted">
                      {count} ({pct}%)
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
