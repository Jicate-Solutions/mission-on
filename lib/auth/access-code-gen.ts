import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/auth/access-code-gen.ts — synthetic email + plaintext access-code
// candidate generation. Mirrors the retry-on-collision shape of
// lib/dal/alias.ts's generateAlias: this module only produces CANDIDATES: the
// caller (app/(app)/super-admin/access-codes/_lib/actions.ts) retries with a
// fresh candidate on a unique violation (email or code_hash clash).
//
// The synthetic email is never resolvable mail and is never returned to any
// client — it exists purely as the Supabase Auth identifier backing an access
// code. The access code itself IS that account's Supabase Auth password, so it
// is generated from a large, readable alphabet with real entropy, not a short
// human PIN.
// =============================================================================

import { randomBytes, randomInt } from 'node:crypto'

import type { Role } from '@/types/database'

const SYNTHETIC_EMAIL_DOMAIN = 'codes.mission-on.internal'

/**
 * A system-generated Supabase Auth email for a code-provisioned account. Never
 * shown to any client. `attempt` adds extra entropy to escape a unique clash.
 */
export function generateSyntheticEmail(role: Role, attempt = 0): string {
  const extra = attempt > 0 ? randomBytes(2).toString('hex') : ''
  const id = randomBytes(6).toString('hex') + extra
  return `${role}-${id}@${SYNTHETIC_EMAIL_DOMAIN}`
}

// Unambiguous alphabet: excludes 0/O, 1/I/L so a printed/handwritten code is
// never misread. ~5 bits of entropy per character.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_GROUP_LENGTH = 4
const CODE_GROUPS = 3

/**
 * A readable access-code candidate, e.g. "XJ4M-7QRT-2FHV" (~59 bits of entropy
 * across 12 alphabet characters). Every call draws fresh cryptographic
 * randomness, so no retry/attempt counter is needed to avoid a collision. This
 * value literally becomes the account's Supabase Auth password, so it must
 * never be logged or stored in plaintext beyond the single moment it is
 * returned to the Super Admin.
 */
export function generateAccessCodeValue(): string {
  const groups: string[] = []
  for (let g = 0; g < CODE_GROUPS; g++) {
    let group = ''
    for (let i = 0; i < CODE_GROUP_LENGTH; i++) {
      group += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
    }
    groups.push(group)
  }
  return groups.join('-')
}
