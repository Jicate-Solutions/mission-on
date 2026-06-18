'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/super-admin/safeguarding-contacts/actions.ts — Server Action for a
// super_admin to set the named safeguarding contacts (PRD §12 — designated
// safeguarding lead / named safeguarding contacts).
//
// SECURITY: a Server Action is reachable by a DIRECT POST — it re-verifies the
// super_admin role internally (the route-group layout gate is not enough). The
// write goes through the RLS-scoped SSR client; program_config_super_admin_write
// permits the write only for is_super_admin(). The change is audited (PRD §13).
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { requireRole, writeAudit, AuthorizationError } from '@/lib/dal'
import {
  MAX_CONTACTS,
  type SafeguardingContact,
} from '@/app/(app)/admin/safeguarding/_contacts'

export interface ContactsState {
  error: string | null
  success: string | null
}

const MAX_FIELD = 200

/**
 * Parse the contacts payload. The editor submits the whole array as JSON in a
 * single hidden field ("contacts"). We re-validate everything server-side:
 * non-empty name + phone per row, field lengths, and the list cap. A single
 * invalid row rejects the whole submission with a clear message.
 */
function parsePayload(
  raw: string
): { contacts: SafeguardingContact[] } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Could not read the contacts. Please try again.' }
  }
  if (!Array.isArray(parsed)) {
    return { error: 'Could not read the contacts. Please try again.' }
  }
  if (parsed.length > MAX_CONTACTS) {
    return { error: `You can list at most ${MAX_CONTACTS} contacts.` }
  }

  const contacts: SafeguardingContact[] = []
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i]
    if (typeof row !== 'object' || row === null) {
      return { error: `Contact ${i + 1} is invalid.` }
    }
    const r = row as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.trim() : ''
    const roleTitle = typeof r.roleTitle === 'string' ? r.roleTitle.trim() : ''
    const phone = typeof r.phone === 'string' ? r.phone.trim() : ''
    const email = typeof r.email === 'string' ? r.email.trim() : ''

    if (!name) return { error: `Contact ${i + 1} needs a name.` }
    if (!phone) return { error: `Contact ${i + 1} needs a phone number.` }
    if (
      name.length > MAX_FIELD ||
      roleTitle.length > MAX_FIELD ||
      phone.length > MAX_FIELD ||
      email.length > MAX_FIELD
    ) {
      return { error: `Contact ${i + 1} has a field that is too long.` }
    }

    contacts.push({
      name,
      roleTitle,
      phone,
      ...(email ? { email } : {}),
    })
  }

  return { contacts }
}

/**
 * Replace the named safeguarding contacts. super_admin only. Writes the full
 * validated array to program_config.safeguarding_contacts and audits the change.
 */
export async function saveSafeguardingContacts(
  _prev: ContactsState,
  formData: FormData
): Promise<ContactsState> {
  let session
  try {
    session = await requireRole(['super_admin'])
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return { error: 'Not authorized.', success: null }
    }
    throw e
  }

  const result = parsePayload(String(formData.get('contacts') ?? '[]'))
  if ('error' in result) return { error: result.error, success: null }

  const supabase = await createClient()
  const { error } = await supabase
    .from('program_config')
    .update({ safeguarding_contacts: result.contacts })
    .eq('id', 1)

  if (error) {
    return { error: 'Could not save the contacts. Please try again.', success: null }
  }

  await writeAudit({
    action: 'config.update',
    entityType: 'program_config',
    entityId: null,
    actorId: session.userId,
    metadata: {
      field: 'safeguarding_contacts',
      count: result.contacts.length,
      role: session.role,
    },
  })

  revalidatePath('/super-admin/safeguarding-contacts')
  revalidatePath('/admin/safeguarding')
  revalidatePath('/super-admin/safeguarding')
  return { error: null, success: 'Safeguarding contacts saved.' }
}
