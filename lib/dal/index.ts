import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/dal/index.ts — Stable public surface of the Data Access Layer.
//
// Feature modules import from '@/lib/dal'. Everything re-exported here is
// 'server-only' and re-verifies auth internally. Do NOT import any DAL module
// (or this index) into a Client Component — the 'server-only' guard turns that
// into a build error, which is intentional.
//
// This module is OWNED by the DAL. Other modules import from it and MUST NOT
// edit it. Keep this surface stable.
// =============================================================================

// ---- session / authorization ----
export {
  verifySession,
  requireSession,
  requireRole,
  requireRolePage,
  getCurrentUserRole,
  isAdminRole,
  isSuperAdmin,
  AuthorizationError,
} from '@/lib/dal/session'
export type { SessionContext } from '@/lib/dal/session'

// ---- mentors (identity split) ----
export {
  getMentorPublicList,
  getMentorPublic,
  getMentorFull,
  getOwnMentorFull,
} from '@/lib/dal/mentors'

// ---- learners (identity split + reveal gate) ----
export {
  getLearnerPublic,
  getLearnerPublicList,
  getLearnerFull,
  getOwnLearnerFull,
} from '@/lib/dal/learners'

// ---- audit ----
export { writeAudit } from '@/lib/dal/audit'
export type { AuditAction, WriteAuditInput } from '@/lib/dal/audit'

// ---- DTO + enum types re-exported for convenience ----
export type {
  Role,
  UserRole,
  MentorPublic,
  MentorFull,
  LearnerPublic,
  LearnerFull,
} from '@/types/database'
