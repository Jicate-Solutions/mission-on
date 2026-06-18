import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/dal/alias.ts — friendly, NON-identifying alias generation (PRD §5.1).
//
// Aliases are the ONLY name a learner ever sees for a mentor, so they must never
// encode a real identity. We generate them from a fixed pool of neutral nouns in
// the form "Mentor-Falcon" / "Learner-Robin" (matching the seed convention).
//
// Uniqueness is guaranteed by the alias UNIQUE constraint at the DB; this module
// only produces CANDIDATES. The caller retries with a fresh candidate on a unique
// violation. `attempt > 0` appends a short random number to escape a clash.
// =============================================================================

/** Neutral, non-gendered, friendly nouns — safe for a minors' context. */
const WORD_POOL: readonly string[] = [
  'Falcon', 'Robin', 'Otter', 'Maple', 'Cedar', 'Willow', 'Comet', 'Harbor',
  'Sparrow', 'Heron', 'Lotus', 'Cobalt', 'Ember', 'Quartz', 'Bramble', 'Finch',
  'Juniper', 'Pebble', 'Marlin', 'Aspen', 'Coral', 'Dune', 'Fern', 'Garnet',
  'Hazel', 'Indigo', 'Kestrel', 'Lark', 'Meadow', 'Nimbus', 'Onyx', 'Pelican',
  'Reef', 'Sable', 'Tamarind', 'Vireo', 'Wren', 'Zephyr', 'Birch', 'Clover',
]

export type AliasKind = 'mentor' | 'learner'

/**
 * Produce a candidate alias like "Mentor-Falcon". On retries (attempt > 0) a
 * 3-digit suffix is added ("Mentor-Falcon-417") to escape a unique clash.
 */
export function generateAlias(kind: AliasKind, attempt = 0): string {
  const prefix = kind === 'mentor' ? 'Mentor' : 'Learner'
  const word = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)]
  const suffix = attempt > 0 ? `-${100 + Math.floor(Math.random() * 900)}` : ''
  return `${prefix}-${word}${suffix}`
}
