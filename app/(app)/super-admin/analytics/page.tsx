import type { Metadata } from 'next'

import { getProgramAnalytics } from './_data'
import { requireRolePage } from '@/lib/dal'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata: Metadata = { title: 'Analytics — Mission ON' }

// Program-wide oversight surface — always reflect live aggregates.
export const dynamic = 'force-dynamic'

// -----------------------------------------------------------------------------
// Label helpers (snake_case enum -> human text).
// -----------------------------------------------------------------------------

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

type BadgeVariant = 'neutral' | 'info' | 'warning' | 'success' | 'brand' | 'danger'

function escalationVariant(status: string): BadgeVariant {
  if (status === 'open') return 'danger'
  if (status === 'acknowledged') return 'warning'
  return 'success'
}

function bugVariant(status: string): BadgeVariant {
  if (status === 'open') return 'danger'
  if (status === 'triaged' || status === 'assigned') return 'warning'
  if (status === 'resolved') return 'success'
  return 'neutral'
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string
  value: number | string | null
  suffix?: string
}) {
  const shown = value === null ? '—' : value
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="mt-1 text-3xl font-semibold text-ink">
          {shown}
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

/** A horizontal bar row (CSS width — no chart library). */
function BarRow({
  label,
  count,
  max,
  total,
}: {
  label: string
  count: number
  max: number
  total: number
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <li className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm font-medium text-ink">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(count / Math.max(1, max)) * 100}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm text-ink-muted">
        {count} ({pct}%)
      </span>
    </li>
  )
}

/**
 * Super Admin program-wide analytics (PRD §9.1 / §15 Phase 5). AGGREGATE /
 * ANONYMIZED ONLY (Ring 2, PRD §12) — counts, rates, distributions and averages.
 * No individual row, name or identity ever appears here; getProgramAnalytics()
 * returns numbers only and re-verifies the role. Authorization is enforced in
 * the DAL (requireRolePage(['super_admin'])) and by RLS, not the URL.
 */
export default async function AnalyticsPage() {
  await requireRolePage(['super_admin'])
  const a = await getProgramAnalytics()

  const stageMax = Math.max(1, ...a.stageCounts.map((s) => s.count))
  const moduleMax = Math.max(1, ...a.moduleCounts.map((m) => m.count))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Program analytics</h1>
        <p className="mt-1 text-ink-muted">
          A high-level, anonymized view of the program. Only aggregate data is
          shown here — no individual learner, mentor, school contact or identity
          ever appears, in line with the program&rsquo;s confidentiality model.
        </p>
      </div>

      {/* Headline stats ------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Schools in pipeline" value={a.totalSchools} />
        <StatCard
          label="Follow-up completion"
          value={a.followUp.completionRate}
          suffix="%"
        />
        <StatCard label="Feedback responses" value={a.feedback.total} />
        <StatCard
          label="Average overall rating"
          value={a.feedback.averageRating}
          suffix=" / 5"
        />
      </div>

      {/* Pipeline throughput ------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline throughput</CardTitle>
          <CardDescription>
            Schools by pipeline stage. Throughput moves left to right, from first
            approach to follow-up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {a.totalSchools === 0 ? (
            <p className="text-sm text-ink-muted">No schools yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {a.stageCounts.map((s) => (
                <BarRow
                  key={s.stage}
                  label={humanize(s.stage)}
                  count={s.count}
                  max={stageMax}
                  total={a.totalSchools}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Follow-up completion (success metric) ------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Follow-up completion rate</CardTitle>
          <CardDescription>
            A core success metric: of the schools that reached the follow-up
            stage, how many completed their follow-up.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-ink-muted">Reached follow-up</p>
            <p className="mt-1 text-2xl font-semibold text-ink">
              {a.followUp.reached}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-muted">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-ink">
              {a.followUp.completed}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-muted">Completion rate</p>
            <p className="mt-1 text-2xl font-semibold text-ink">
              {a.followUp.completionRate === null
                ? '—'
                : `${a.followUp.completionRate}%`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Module-code distribution ------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Module distribution</CardTitle>
          <CardDescription>
            Schools per intervention module (confirmed classification, falling
            back to the computed code where not yet confirmed). Counts only —{' '}
            {a.confirmedClassifications} confirmed, {a.computedFallbacks} computed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {a.moduleCounts.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No classified schools yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {a.moduleCounts.map((m) => (
                <BarRow
                  key={m.code}
                  label={m.code}
                  count={m.count}
                  max={moduleMax}
                  total={a.confirmedClassifications + a.computedFallbacks}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Engagement --------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement</CardTitle>
          <CardDescription>
            Program reach across mentors, learners and active pairings (alias
            counts only — never real identities).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-ink-muted">Mentors</p>
            <p className="mt-1 text-2xl font-semibold text-ink">
              {a.engagement.mentors}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-muted">Learners</p>
            <p className="mt-1 text-2xl font-semibold text-ink">
              {a.engagement.learners}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-muted">Active assignments</p>
            <p className="mt-1 text-2xl font-semibold text-ink">
              {a.engagement.activeAssignments}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Safeguarding + bugs ------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Safeguarding escalations</CardTitle>
            <CardDescription>Escalations by status (counts only).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.safeguarding.map((s) => (
                  <TableRow key={s.status}>
                    <TableCell>
                      <Badge variant={escalationVariant(s.status)}>
                        {humanize(s.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-ink">
                      {s.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bug reports</CardTitle>
            <CardDescription>Bug reports by status (counts only).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.bugs.map((b) => (
                  <TableRow key={b.status}>
                    <TableCell>
                      <Badge variant={bugVariant(b.status)}>
                        {humanize(b.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-ink">
                      {b.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
