import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * DANGER: This client has elevated privileges. It must ONLY be used from
 * trusted server code for explicitly privileged operations:
 *   - the audit-log RPC path (audit_logs are written via a SECURITY DEFINER
 *     RPC; clients can never forge entries),
 *   - other vetted privileged server operations.
 *
 * NEVER import this module into a Client Component or anything that ships to
 * the browser. The `import 'server-only'` above makes such an import a build
 * error. Do not use this to casually read user data — that belongs in the DAL
 * under RLS via lib/supabase/server.ts.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase service-role configuration (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
