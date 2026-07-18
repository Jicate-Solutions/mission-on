// =============================================================================
// Mission ON — Smart Choices
// components/nav/nav-config.ts — single source of truth for navigation + role
// homes. This file is the CONTRACT parallel feature agents rely on: each role's
// route-group folder, href namespace, and the exact feature link hrefs.
//
// This module is plain data (no 'use client', no 'server-only') so it can be
// imported by both the server shell layout and the client sidebar/mobile nav.
// It must NOT import the DAL or anything server-only.
//
// HREF DISCIPLINE (read before adding pages):
//   - Every authenticated role lives under a route group app/(app)/<role>/.
//   - The url namespace for a role equals "/<role>" (e.g. /admin, /mentor).
//     super_admin -> /super-admin, the rest map 1:1 to the role name.
//   - Cross-role features (anonymous chat, bug reports) live at SHARED top-level
//     paths under (app): /anonymous-chat and /bug-reports. Every role links to
//     the same href; the page authorizes via the DAL, not the URL.
// =============================================================================

import type { Role } from '@/types/database'

/**
 * Map a role to its URL namespace segment. super_admin uses a kebab-case
 * segment; all others equal the role name. This is the ONLY place the
 * role->segment mapping is defined — import roleSegment / roleHome elsewhere.
 */
export function roleSegment(role: Role): string {
  return role === 'super_admin' ? 'super-admin' : role
}

/** The landing/home path for a role after sign-in. */
export function roleHome(role: Role): string {
  return `/${roleSegment(role)}`
}

/**
 * A single navigation entry. `icon` is a lucide-style key resolved by the nav
 * components to an inline SVG (we avoid importing an icon lib into the bundle).
 */
export interface NavItem {
  label: string
  href: string
  icon: NavIconKey
  /**
   * When true, the link is rendered but visually de-emphasised as a sensitive
   * area (e.g. classification, safeguarding). Purely presentational; access is
   * still enforced server-side.
   */
  sensitive?: boolean
}

export interface NavSection {
  /** Optional section heading; omit for the primary/un-grouped section. */
  heading?: string
  items: NavItem[]
}

export type NavIconKey =
  | 'home'
  | 'school'
  | 'clipboard'
  | 'users'
  | 'user'
  | 'compass'
  | 'message'
  | 'flag'
  | 'chart'
  | 'shield'
  | 'bug'
  | 'heart'
  | 'swap'
  | 'key'

// Shared cross-role links. Same href for everyone; the page gates access.
const ANONYMOUS_CHAT: NavItem = {
  label: 'Anonymous chat',
  href: '/anonymous-chat',
  icon: 'message',
}
const BUG_REPORTS: NavItem = {
  label: 'Bug reports',
  href: '/bug-reports',
  icon: 'bug',
}

/**
 * NAV_CONFIG — every feature link, per role. Feature agents MUST create their
 * pages at exactly these hrefs (or a subpath of them) so links resolve.
 *
 * Reserved route-group folders (one per role) and href namespaces:
 *   super_admin -> app/(app)/super-admin/  ->  /super-admin/*
 *   admin       -> app/(app)/admin/        ->  /admin/*
 *   coordinator -> app/(app)/coordinator/  ->  /coordinator/*
 *   mentor      -> app/(app)/mentor/       ->  /mentor/*
 *   learner     -> app/(app)/learner/      ->  /learner/*
 *   shared      -> app/(app)/anonymous-chat/ , app/(app)/bug-reports/
 */
export const NAV_CONFIG: Record<Role, NavSection[]> = {
  super_admin: [
    {
      items: [
        { label: 'Dashboard', href: '/super-admin', icon: 'home' },
        { label: 'Schools', href: '/super-admin/schools', icon: 'school' },
        {
          label: 'Questionnaires',
          href: '/super-admin/questionnaires',
          icon: 'clipboard',
        },
        {
          label: 'Questionnaire builder',
          href: '/super-admin/questionnaires/builder',
          icon: 'clipboard',
        },
        {
          label: 'Classification',
          href: '/super-admin/classification',
          icon: 'chart',
          sensitive: true,
        },
        { label: 'Modules', href: '/super-admin/modules', icon: 'compass' },
        { label: 'Mentors', href: '/super-admin/mentors', icon: 'users' },
        { label: 'Learners', href: '/super-admin/learners', icon: 'user' },
        { label: 'Analytics', href: '/super-admin/analytics', icon: 'chart' },
      ],
    },
    {
      heading: 'Oversight',
      items: [
        { label: 'Feedback', href: '/super-admin/feedback', icon: 'heart' },
        {
          label: 'Mentor-change requests',
          href: '/super-admin/mentor-changes',
          icon: 'swap',
        },
        {
          label: 'Safeguarding',
          href: '/super-admin/safeguarding',
          icon: 'shield',
          sensitive: true,
        },
      ],
    },
    {
      heading: 'Administration',
      items: [
        {
          label: 'Role management',
          href: '/super-admin/roles',
          icon: 'shield',
        },
        {
          label: 'Access codes',
          href: '/super-admin/access-codes',
          icon: 'key',
        },
        { label: 'Audit log', href: '/super-admin/audit', icon: 'clipboard' },
        {
          label: 'Safeguarding contacts',
          href: '/super-admin/safeguarding-contacts',
          icon: 'shield',
        },
        ANONYMOUS_CHAT,
        BUG_REPORTS,
      ],
    },
  ],

  admin: [
    {
      items: [
        { label: 'Dashboard', href: '/admin', icon: 'home' },
        { label: 'Schools', href: '/admin/schools', icon: 'school' },
        {
          label: 'Questionnaires',
          href: '/admin/questionnaires',
          icon: 'clipboard',
        },
        {
          label: 'Questionnaire builder',
          href: '/admin/questionnaires/builder',
          icon: 'clipboard',
        },
        {
          label: 'Classification',
          href: '/admin/classification',
          icon: 'chart',
          sensitive: true,
        },
        { label: 'Modules', href: '/admin/modules', icon: 'compass' },
        { label: 'Mentors', href: '/admin/mentors', icon: 'users' },
        { label: 'Learners', href: '/admin/learners', icon: 'user' },
      ],
    },
    {
      heading: 'Oversight',
      items: [
        { label: 'Feedback', href: '/admin/feedback', icon: 'heart' },
        {
          label: 'Mentor-change requests',
          href: '/admin/mentor-changes',
          icon: 'swap',
        },
        {
          label: 'Safeguarding',
          href: '/admin/safeguarding',
          icon: 'shield',
          sensitive: true,
        },
      ],
    },
    {
      heading: 'Administration',
      items: [
        { label: 'Role allocation', href: '/admin/roles', icon: 'shield' },
        ANONYMOUS_CHAT,
        BUG_REPORTS,
      ],
    },
  ],

  coordinator: [
    {
      items: [
        { label: 'Dashboard', href: '/coordinator', icon: 'home' },
        { label: 'My schools', href: '/coordinator/schools', icon: 'school' },
        {
          label: 'Questionnaires',
          href: '/coordinator/questionnaires',
          icon: 'clipboard',
        },
        {
          label: 'Pipeline',
          href: '/coordinator/pipeline',
          icon: 'compass',
        },
      ],
    },
    {
      heading: 'More',
      items: [ANONYMOUS_CHAT, BUG_REPORTS],
    },
  ],

  mentor: [
    {
      items: [
        { label: 'Dashboard', href: '/mentor', icon: 'home' },
        { label: 'My learners', href: '/mentor/learners', icon: 'user' },
        {
          label: 'Follow-through',
          href: '/mentor/follow-through',
          icon: 'flag',
        },
        { label: 'Modules', href: '/mentor/modules', icon: 'compass' },
        { label: 'Feedback', href: '/mentor/feedback', icon: 'heart' },
        { label: 'My profile', href: '/mentor/profile', icon: 'shield' },
      ],
    },
    {
      heading: 'More',
      items: [ANONYMOUS_CHAT, BUG_REPORTS],
    },
  ],

  learner: [
    {
      items: [
        { label: 'Home', href: '/learner', icon: 'home' },
        { label: 'My profile', href: '/learner/profile', icon: 'user' },
        { label: 'My mentor', href: '/learner/mentors', icon: 'users' },
        {
          label: 'My sessions',
          href: '/learner/sessions',
          icon: 'compass',
        },
        { label: 'Give feedback', href: '/learner/feedback', icon: 'heart' },
      ],
    },
    {
      heading: 'More',
      items: [ANONYMOUS_CHAT, BUG_REPORTS],
    },
  ],
}

/**
 * Active-route matching, shared by the sidebar (highlighting) and the header
 * (current-page title) so both agree on "where am I". Exact match for role-home
 * roots (e.g. /admin); prefix match for deeper pages so /admin/schools/123 still
 * resolves to "Schools".
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  const segments = href.split('/').filter(Boolean)
  if (segments.length <= 1) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The label of the nav item matching the current path, or null if none. */
export function findActiveNavLabel(
  sections: NavSection[],
  pathname: string
): string | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (isNavItemActive(item.href, pathname)) return item.label
    }
  }
  return null
}

/** Human-readable label for a role, for the header badge. */
export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  coordinator: 'Coordinator',
  mentor: 'Mentor',
  learner: 'Learner',
}
