import type { ReactNode } from 'react'

import { BrandMark } from '@/components/nav/brand-mark'

/**
 * Layout for unauthenticated auth screens (login, signup, forgot-password).
 * A calm, centered single-column frame. No nav, no session lookup — the proxy
 * already bounces authenticated users away from these routes optimistically,
 * and each page does its own check where it matters.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandMark size="lg" glow />
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Mission ON
            </h1>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-600">
              Smart Choices
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
