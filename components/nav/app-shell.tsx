'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SidebarNav } from '@/components/nav/sidebar-nav'
import { SignOutButton } from '@/components/nav/sign-out-button'
import { BrandMark } from '@/components/nav/brand-mark'
import type { NavSection } from '@/components/nav/nav-config'
import { findActiveNavLabel } from '@/components/nav/nav-config'
import { cn } from '@/lib/utils'

export interface AppShellProps {
  /** Pre-filtered nav sections for the signed-in role. */
  sections: NavSection[]
  /** Display name shown in the header — ALIAS only, never a real name. */
  displayName: string
  /** Human-readable role label for the badge. */
  roleLabel: string
  /** Role home href for the brand link. */
  homeHref: string
  children: React.ReactNode
}

/**
 * The authenticated app shell: fixed sidebar on desktop, slide-in drawer on
 * mobile, plus a header carrying the alias + role badge.
 *
 * This is a CLIENT component (it owns the mobile drawer open/close state) but it
 * holds NO sensitive data — `displayName` is an alias and everything else is
 * presentational. The server layout fetches identity via the DAL and passes
 * only the alias down. Never pass real_name / phone / email here.
 */
export function AppShell({
  sections,
  displayName,
  roleLabel,
  homeHref,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const currentLabel = findActiveNavLabel(sections, pathname)

  // Compact mark — used in the mobile header and the drawer.
  const brand = (
    <Link
      href={homeHref}
      className="flex items-center gap-2.5 rounded-md px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <BrandMark size="sm" />
      <span className="font-[family-name:var(--font-display)] text-sm font-semibold leading-tight tracking-tight text-ink">
        Mission ON
      </span>
    </Link>
  )

  // Stacked mark with tagline — used in the desktop sidebar's brand cell.
  const brandStacked = (
    <Link
      href={homeHref}
      className="flex items-center gap-2.5 rounded-md px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <BrandMark size="sm" />
      <span className="flex flex-col leading-tight">
        <span className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight text-ink">
          Mission ON
        </span>
        <span className="text-[11px] text-ink-muted">Smart Choices</span>
      </span>
    </Link>
  )

  const identity = (
    <div className="flex items-center gap-3">
      <div className="hidden flex-col items-end leading-tight sm:flex">
        <span className="max-w-[12rem] truncate text-sm font-semibold text-ink">
          {displayName}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {roleLabel}
        </span>
      </div>
      <span
        className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 ring-1 ring-brand-200"
        aria-hidden="true"
      >
        {displayName.slice(0, 1).toUpperCase()}
      </span>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — full height, brand anchored at top-left */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
          {brandStacked}
        </div>
        <div className="flex flex-1 flex-col justify-between overflow-y-auto p-4">
          <SidebarNav sections={sections} />
          <div className="pt-4">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Content column: content-scoped header + main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/70 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 inline-flex size-10 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="size-6"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile: brand. Desktop: the current page title gives real context. */}
          <div className="lg:hidden">{brand}</div>
          <div className="hidden min-w-0 lg:block">
            <span className="block truncate font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-ink">
              {currentLabel ?? 'Welcome back'}
            </span>
          </div>

          <div className="ml-auto">{identity}</div>
        </header>

        {/* Main content */}
        <main className="min-w-0 flex-1 bg-background">
          <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-ink/40"
            />
            <div
              className={cn(
                'absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-xl'
              )}
            >
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                {brand}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="inline-flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className="size-5"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-1 flex-col justify-between overflow-y-auto p-4">
                <SidebarNav
                  sections={sections}
                  onNavigate={() => setDrawerOpen(false)}
                />
                <div className="pt-4">
                  <SignOutButton />
                </div>
              </div>
            </div>
          </div>
        ) : null}
    </div>
  )
}
