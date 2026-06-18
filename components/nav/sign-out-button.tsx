'use client'

import { useTransition } from 'react'

import { signOut } from '@/lib/auth/actions'
import { cn } from '@/lib/utils'

export interface SignOutButtonProps {
  className?: string
}

/**
 * Sign-out trigger. Calls the signOut Server Action (which clears the Supabase
 * session cookie and redirects to /login). The browser never touches Supabase
 * directly — the action does all the work server-side.
 */
export function SignOutButton({ className }: SignOutButtonProps) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void signOut())}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
        'text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden="true"
      >
        <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
        <path d="M10 17l-5-5 5-5M5 12h11" />
      </svg>
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
