import * as React from 'react'

import type { NavIconKey } from '@/components/nav/nav-config'

// Inline SVG icon set (lucide-derived paths) so navigation needs no icon
// dependency in the client bundle. Each entry is the inner markup of a
// 24x24 stroke icon.
const PATHS: Record<NavIconKey, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  school: (
    <>
      <path d="m4 6 8-3 8 3-8 3-8-3Z" />
      <path d="M4 6v6c0 2 3.6 4 8 4s8-2 8-4V6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
      <path d="M16 6a3 3 0 0 1 0 6M21 20c0-2-1.5-3.5-3.5-4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21c0-4 3-6 7-6s7 2 7 6" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2 6-6 2 2-6 6-2Z" />
    </>
  ),
  message: (
    <path d="M21 12a8 8 0 0 1-8 8H6l-3 2v-4.5A8 8 0 1 1 21 12Z" />
  ),
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 3 2 3H5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </>
  ),
  shield: <path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" />,
  bug: (
    <>
      <rect x="8" y="7" width="8" height="11" rx="4" />
      <path d="M9 7a3 3 0 0 1 6 0M5 11h3M16 11h3M5 16h3M16 16h3M12 4v3" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z" />
  ),
  swap: (
    <>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </>
  ),
}

export interface NavIconProps {
  name: NavIconKey
  className?: string
}

/** Render a navigation glyph as an inline stroke SVG. */
export function NavIcon({ name, className }: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
