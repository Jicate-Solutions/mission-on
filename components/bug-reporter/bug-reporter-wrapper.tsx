'use client'

// =============================================================================
// Mission ON — Smart Choices
// components/bug-reporter/bug-reporter-wrapper.tsx
//
// Centralized reporting: mounts the JKKN Bug Reporter SDK
// (@boobalan_jkkn/bug-reporter-sdk). Its widget captures screenshot + console +
// network and POSTs DIRECTLY to the external Bug Boundary platform
// (NEXT_PUBLIC_BUG_REPORTER_API_URL) — reports do NOT touch this app's DB.
//
// Mounted in the AUTHENTICATED group layout (app/(app)/layout.tsx) only, so the
// widget never appears on /login, /signup, /auth/* (Pattern C — auth-only).
//
// INERT UNTIL CONFIGURED: when the API key/URL are absent it renders children
// untouched (no widget, no network) — safe to ship before the credentials land
// in .env.local.
//
// PRIVACY: this app hides real identity for safeguarding, so we send only the
// auth user id + login email (never mentor/learner real_name) as user context.
// =============================================================================

import { BugReporterProvider } from '@boobalan_jkkn/bug-reporter-sdk'
import { useEffect, useState, type ReactNode } from 'react'

import { createClientSupabaseClient } from '@/lib/supabase/client'

const API_KEY = process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY
const API_URL = process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL

interface MinimalUser {
  id: string
  email?: string
}

export function BugReporterWrapper({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MinimalUser | null>(null)

  useEffect(() => {
    if (!API_KEY || !API_URL) return
    const supabase = createClientSupabaseClient()

    supabase.auth.getUser().then(({ data }) => {
      setUser(
        data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null
      )
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      setUser(u ? { id: u.id, email: u.email ?? undefined } : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Not configured yet → render children only (the widget stays dormant).
  if (!API_KEY || !API_URL) return <>{children}</>

  return (
    <BugReporterProvider
      apiKey={API_KEY}
      apiUrl={API_URL}
      enabled
      debug={process.env.NODE_ENV === 'development'}
      userContext={
        user ? { userId: user.id, name: user.email, email: user.email } : undefined
      }
    >
      {children}
    </BugReporterProvider>
  )
}
