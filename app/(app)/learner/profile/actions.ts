'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/profile/actions.ts — Server Action for a learner editing
// their OWN profile (PRD §9.5). A learner may change their ALIAS and CONTACT
// NUMBER only; real name + school are admin-set and read-only here.
//
// SECURITY: a Server Action is reachable by a DIRECT POST — re-verifies the
// learner role internally. Writes go through the RLS-scoped SSR client
// (learner_public_self_update / learner_profiles_self_update both pin to
// user_id = auth.uid()), so a learner can only ever edit their own rows.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'

export interface ProfileState {
  error: string | null
  success: string | null
}

const MAX_ALIAS = 40
const MAX_CONTACT = 20

export async function updateLearnerProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await requireRole(['learner'])

  const alias = String(formData.get('alias') ?? '').trim()
  const contact = String(formData.get('contactNumber') ?? '').trim()

  if (alias.length === 0) {
    return { error: 'Choose an alias.', success: null }
  }
  if (alias.length > MAX_ALIAS) {
    return { error: `Keep your alias under ${MAX_ALIAS} characters.`, success: null }
  }
  if (contact.length > MAX_CONTACT) {
    return { error: 'That contact number looks too long.', success: null }
  }

  const supabase = await createClient()

  // Resolve the learner's own profile id (RLS pins this to their row).
  const { data: prof, error: profErr } = await supabase
    .from('learner_profiles')
    .select('id')
    .eq('user_id', session.userId)
    .maybeSingle()
  if (profErr) throw profErr
  if (!prof) {
    return {
      error: 'Your learner profile is not ready yet. Ask your coordinator.',
      success: null,
    }
  }
  const profileId = (prof as { id: string }).id

  // Alias lives on learner_public (UNIQUE). A clash returns 23505 -> friendly msg.
  const { error: aliasErr } = await supabase
    .from('learner_public')
    .update({ alias })
    .eq('learner_profile_id', profileId)
  if (aliasErr) {
    if ((aliasErr as { code?: string }).code === '23505') {
      return { error: 'That alias is already taken — try another.', success: null }
    }
    return { error: 'Could not update your alias.', success: null }
  }

  // Contact number lives on learner_profiles (real-identity row).
  const { error: contactErr } = await supabase
    .from('learner_profiles')
    .update({ contact_number: contact.length > 0 ? contact : null })
    .eq('user_id', session.userId)
  if (contactErr) {
    return { error: 'Could not update your contact number.', success: null }
  }

  revalidatePath('/learner/profile')
  revalidatePath('/learner')
  return { error: null, success: 'Profile updated.' }
}
