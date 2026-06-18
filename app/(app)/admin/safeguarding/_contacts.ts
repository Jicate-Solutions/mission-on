import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// Named safeguarding contacts (PRD §12 — designated safeguarding lead / named
// safeguarding contacts) — server-only data layer.
//
// Contacts live in program_config.safeguarding_contacts (jsonb). RLS lets ANY
// authenticated user SELECT program_config, but we gate the read to admins /
// super_admins here because these contacts surface on the admin safeguarding
// queue. The super_admin editor (under /super-admin/safeguarding-contacts) is
// the only writer; the program_config write policy already enforces that.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import { MAX_CONTACTS, type SafeguardingContact } from './contacts-shared'

// Re-export the boundary-neutral definitions so existing server importers of
// this module (page.tsx, actions.ts, queue-view.tsx) keep working unchanged.
// Client code must import these from './contacts-shared' directly instead.
export { MAX_CONTACTS, type SafeguardingContact }

/**
 * Coerce one untyped jsonb element into a SafeguardingContact, or null if it is
 * not a usable record (missing name or phone). Defensive: the column is free-
 * form jsonb, so we never trust its shape.
 */
function parseContact(raw: unknown): SafeguardingContact | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  const roleTitle = typeof r.roleTitle === 'string' ? r.roleTitle.trim() : ''
  const phone = typeof r.phone === 'string' ? r.phone.trim() : ''
  const email = typeof r.email === 'string' ? r.email.trim() : ''
  if (!name || !phone) return null
  return {
    name,
    roleTitle,
    phone,
    ...(email ? { email } : {}),
  }
}

/**
 * Read the named safeguarding contacts for the admin surface. Admin /
 * super_admin only. Returns a parsed, validated array (skips malformed
 * entries, caps at MAX_CONTACTS).
 */
export async function getSafeguardingContacts(): Promise<SafeguardingContact[]> {
  await requireRole(['admin', 'super_admin'])
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('program_config')
    .select('safeguarding_contacts')
    .eq('id', 1)
    .maybeSingle<{ safeguarding_contacts: unknown }>()

  if (error) throw error

  const raw = data?.safeguarding_contacts
  if (!Array.isArray(raw)) return []

  return raw
    .map(parseContact)
    .filter((c): c is SafeguardingContact => c !== null)
    .slice(0, MAX_CONTACTS)
}
