import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/mentor/profile/_lib/queries.ts — Mentor self-service reads.
//
// SECURITY: a mentor may always read their OWN real profile (RLS allows
// mentor_profiles.user_id = auth.uid()). We use the DAL's getOwnMentorFull()
// for identity, and read the mentor's OWN availability here, scoped by their
// own mentor_profiles.id. requireRole(['mentor']) re-verifies the caller is a
// mentor before any read. No other mentor's data is ever reachable from here.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { getOwnMentorFull, requireRole } from '@/lib/dal'
import type { MentorFull } from '@/types/database'

export interface MentorOwnAvailabilitySlot {
  id: string
  availableDate: string
  startTime: string | null
  endTime: string | null
}

export interface MentorSelfProfile {
  mentor: MentorFull
  availability: MentorOwnAvailabilitySlot[]
}

/**
 * The calling mentor's own full profile + availability calendar. Returns null
 * if the caller has no mentor profile yet. requireRole(['mentor']) gates this;
 * getOwnMentorFull resolves identity for THIS user only (RLS-scoped).
 */
export async function getMentorSelfProfile(): Promise<MentorSelfProfile | null> {
  await requireRole(['mentor'])

  const mentor = await getOwnMentorFull()
  if (!mentor) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_availability')
    .select('id, available_date, start_time, end_time')
    .eq('mentor_profile_id', mentor.profileId)
    .order('available_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })

  if (error) throw error

  return {
    mentor,
    availability: (data ?? []).map((r) => ({
      id: r.id,
      availableDate: r.available_date,
      startTime: r.start_time,
      endTime: r.end_time,
    })),
  }
}

/**
 * The calling mentor's own availability only (lighter read for the availability
 * page). Returns null if the caller has no mentor profile.
 */
export async function getOwnAvailability(): Promise<
  MentorOwnAvailabilitySlot[] | null
> {
  await requireRole(['mentor'])

  const mentor = await getOwnMentorFull()
  if (!mentor) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_availability')
    .select('id, available_date, start_time, end_time')
    .eq('mentor_profile_id', mentor.profileId)
    .order('available_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    availableDate: r.available_date,
    startTime: r.start_time,
    endTime: r.end_time,
  }))
}
