// =============================================================================
// Mission ON — Smart Choices
// app/(app)/anonymous-chat/crisis-resources.ts
//
// In-app crisis / wellbeing resources surfaced in the anonymous chat space
// (PRD §12: "Wellbeing/crisis resources should be reachable in-app").
//
// This is PLAIN DATA — no 'use server', no 'server-only', no secrets — so it can
// be imported by both the server page and the client chat composer. It contains
// NO "how-to" harmful content; it only points a learner to a human helpline or
// the in-app safeguarding path. Sensitive escalations route to humans, never an
// auto-resolution by the system.
// =============================================================================

export interface CrisisResource {
  /** Stable key for React lists. */
  key: string
  /** Short label shown on the chip/row. */
  label: string
  /** One-line description of who this reaches. */
  description: string
  /** Dial / link target (tel:, https:, or an internal app path). */
  href: string
  /** Whether the href opens an external destination (telephone or website). */
  external: boolean
}

/**
 * Curated, India-context youth wellbeing helplines plus the in-app safeguarding
 * path. Phone numbers are public national helplines. If a learner is in
 * immediate danger they are pointed to a human, not the system.
 */
export const CRISIS_RESOURCES: readonly CrisisResource[] = [
  {
    key: 'childline',
    label: 'Childline 1098',
    description:
      'Free 24x7 phone helpline for children and young people in distress.',
    href: 'tel:1098',
    external: true,
  },
  {
    key: 'tele-manas',
    label: 'Tele-MANAS 14416',
    description:
      'National mental-health support, 24x7. You can talk to a trained counsellor.',
    href: 'tel:14416',
    external: true,
  },
  {
    key: 'kiran',
    label: 'KIRAN 1800-599-0019',
    description:
      'National mental-health rehabilitation helpline, toll-free, 24x7.',
    href: 'tel:18005990019',
    external: true,
  },
] as const

/**
 * The safeguarding override message shown in chat. Sensitive disclosures are
 * routed to humans (a mentor / the safeguarding lead), never auto-handled. We do
 * NOT link a learner directly into staff safeguarding tooling; we tell them to
 * reach a trusted adult or their mentor, and surface the helplines above.
 */
export const CRISIS_INTRO =
  'If you are in danger or thinking about hurting yourself, please reach a trusted adult or your mentor now. You can also call one of these free, confidential helplines:'
