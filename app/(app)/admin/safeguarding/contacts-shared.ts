// =============================================================================
// Mission ON — Smart Choices
// Named safeguarding contacts — boundary-neutral shared definitions.
//
// This module is intentionally FREE of `server-only` and of any server import
// (no Supabase client, no DAL). It holds only the contact SHAPE and a plain
// numeric cap, so it is safe to import from BOTH the server data layer
// (`_contacts.ts`) and the client editor (`contacts-editor.tsx`).
//
// Why this exists: a Client Component importing a runtime *value* (MAX_CONTACTS)
// from the `server-only` data layer drags the whole server module — and the
// service-role Supabase client — into the browser bundle. Types erase at compile
// time, but values do not. Keeping the value here severs that leak.
// =============================================================================

/** One named safeguarding contact (PRD §12). */
export interface SafeguardingContact {
  name: string
  roleTitle: string
  phone: string
  email?: string
}

/** Maximum number of contacts the editor / store will accept. */
export const MAX_CONTACTS = 20
