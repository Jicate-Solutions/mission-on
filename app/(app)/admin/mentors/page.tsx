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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { listMentorsForAdmin } from './_lib/queries'
import { MentorActiveToggle } from './mentor-active-toggle'

export const metadata: Metadata = { title: 'Mentors — Admin — Mission ON' }

// Per-user sensitive admin data: never cache.
export const dynamic = 'force-dynamic'

/**
 * Admin mentor directory. Lists every mentor by alias + active state. Real
 * identity (name/phone/college/course) is loaded only on the detail page, which
 * calls the admin-guarded getMentorFull(). The page itself is gated by the
 * admin route-group layout AND each query re-verifies admin internally.
 */
export default async function AdminMentorsPage() {
  const mentors = await listMentorsForAdmin()
  const activeCount = mentors.filter((m) => m.is_active).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Mentors</h1>
        <p className="mt-1 text-ink-muted">
          Full mentor directory. Real names, phone, college and course are
          visible to Admins and Super Admins only — open a mentor to view their
          profile, availability and school allocations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>
            {mentors.length} mentor{mentors.length === 1 ? '' : 's'} ·{' '}
            {activeCount} active
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mentors.length === 0 ? (
            <p className="text-ink-muted">
              No mentors yet. Mentors appear here once their profile is created.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mentors.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.alias}</TableCell>
                    <TableCell>
                      {m.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <MentorActiveToggle
                          mentorPublicId={m.id}
                          isActive={m.is_active}
                        />
                        <Link
                          href={`/admin/mentors/${m.id}`}
                          className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          View
                        </Link>
                      </div>
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
