import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  getMentorAdminDetail,
  listSchoolOptions,
} from '../_lib/queries'
import { AllocationManager } from './allocation-manager'
import { MentorProfileEdit } from '@/components/mentors/mentor-profile-edit'

export const metadata: Metadata = { title: 'Mentor — Admin — Mission ON' }

// Real-identity admin data: never cache.
export const dynamic = 'force-dynamic'

function formatTime(t: string | null): string {
  if (!t) return ''
  // Postgres time comes back like "14:30:00"; trim to HH:MM.
  return t.slice(0, 5)
}

function slotRange(start: string | null, end: string | null): string {
  const s = formatTime(start)
  const e = formatTime(end)
  if (s && e) return `${s} – ${e}`
  if (s) return `from ${s}`
  return 'All day'
}

/**
 * Admin mentor detail: REAL identity + availability + school allocations.
 * Identity is loaded via getMentorFull() (admin-guarded inside the DAL). Page
 * is double-gated: admin route-group layout + each query re-verifies admin.
 */
export default async function AdminMentorDetailPage({
  params,
}: {
  params: Promise<{ mentorId: string }>
}) {
  const { mentorId } = await params

  const [detail, schools] = await Promise.all([
    getMentorAdminDetail(mentorId),
    listSchoolOptions(),
  ])

  if (!detail) notFound()

  const { mentor, availability, allocations } = detail
  const allocatedSchoolIds = new Set(allocations.map((a) => a.schoolId))
  const availableSchools = schools.filter(
    (s) => !allocatedSchoolIds.has(s.id)
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/mentors"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Back to mentors
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">{mentor.alias}</h1>
          {mentor.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="neutral">Inactive</Badge>
          )}
        </div>
        <p className="text-ink-muted">
          Real profile — visible to Admins and Super Admins only.
        </p>
      </div>

      <MentorProfileEdit
        mentorPublicId={mentor.id}
        alias={mentor.alias}
        realName={mentor.realName}
        phone={mentor.phone}
        college={mentor.college}
        course={mentor.course}
      />

      <AllocationManager
        mentorPublicId={mentor.id}
        allocations={allocations}
        availableSchools={availableSchools}
      />

      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>
            The mentor maintains this calendar themselves. It feeds session
            allocation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availability.length === 0 ? (
            <p className="text-ink-muted">
              This mentor has not set any availability yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availability.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell className="font-medium">
                      {slot.availableDate}
                    </TableCell>
                    <TableCell>
                      {slotRange(slot.startTime, slot.endTime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
