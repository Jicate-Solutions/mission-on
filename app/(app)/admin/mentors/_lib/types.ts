// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/mentors/_lib/types.ts — DTO shapes for the admin mentor
// management UI. These are admin-only views; they carry real-identity fields
// (real_name/phone/college/course) sourced from getMentorFull(), which is
// itself guarded by requireRole(['admin','super_admin']). NOTHING here is ever
// imported into a learner- or mentor-reachable path.
// =============================================================================

import type { MentorFull } from '@/types/database'

/** A school option for the allocation picker (admin-visible, non-sensitive). */
export interface SchoolOption {
  id: string
  name: string
}

/** One availability slot, normalised for display. */
export interface AvailabilitySlot {
  id: string
  availableDate: string
  startTime: string | null
  endTime: string | null
}

/** A school this mentor is currently allocated to. */
export interface MentorAllocation {
  /** mentor_school_allocations.id */
  id: string
  schoolId: string
  schoolName: string
  createdAt: string
}

/**
 * The full admin detail view of one mentor: real identity (MentorFull) plus
 * their availability calendar and current school allocations. Admin-only.
 */
export interface MentorAdminDetail {
  mentor: MentorFull
  availability: AvailabilitySlot[]
  allocations: MentorAllocation[]
}
