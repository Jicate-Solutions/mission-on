// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/modules/_lib/types.ts — DTO shapes for the admin/super_admin
// Module Design Workspace (PRD §7.4).
//
// Admin-only views. They carry the admin-restricted planning anchor
// (session_design.module_code) and the admin-restricted confirmed module code
// (questionnaire_classification.confirmed_module_code). NOTHING here is ever
// imported into a learner- or mentor-reachable path. School identity surfaced
// here is name-only (non-sensitive) — never minor PII.
// =============================================================================

import type { ModuleCode, SessionStatus } from '@/types/database'

/** A school with its admin-confirmed (or computed) module code. */
export interface SchoolModuleSummary {
  schoolId: string
  schoolName: string
  /** Confirmed module code from questionnaire_classification, if confirmed. */
  confirmedModuleCode: ModuleCode | null
  /** Auto-computed module code (fallback when not yet confirmed). */
  computedModuleCode: ModuleCode | null
}

/** One session in the workspace, with its designed planning module (if any). */
export interface WorkspaceSession {
  /** sessions.id */
  id: string
  schoolId: string
  schoolName: string
  grade: string
  sessionDate: string | null
  startTime: string | null
  status: SessionStatus
  /** The school's confirmed module code (recommendation for the design). */
  confirmedModuleCode: ModuleCode | null
  computedModuleCode: ModuleCode | null
  /** The module code the admin has attached to THIS session (session_design). */
  designedModuleCode: ModuleCode | null
}

/** A mentor allocated to the session's school (alias-only, public id). */
export interface AssignedMentor {
  /** mentor_public.id */
  mentorPublicId: string
  alias: string
  isActive: boolean
}

/**
 * A school option for the allocation picker (admin-visible, non-sensitive).
 */
export interface SchoolOption {
  id: string
  name: string
}

/** A mentor option for the assignment picker (alias-only). */
export interface MentorOption {
  /** mentor_public.id */
  mentorPublicId: string
  alias: string
}

/**
 * The delivery plan an admin assembles for a session (PRD §7.4). All free text;
 * the module CODE is NOT part of this (it lives on session.designedModuleCode and
 * is classification — admin-only). These brief fields are the ones a mentor may
 * later view via session_brief_v.
 */
export interface DeliveryPlan {
  mediaFilm: string | null
  demonstration: string | null
  conversationFramework: string | null
  escalationPathway: string | null
  learningFacilitator: string | null
  notes: string | null
}

/**
 * Full admin detail for one session's module design: the session + its school's
 * confirmed/computed module code + the designed module code + the mentor team
 * currently allocated to the school. Admin-only.
 */
export interface SessionDesignDetail {
  session: WorkspaceSession
  /** The delivery plan (brief) attached to this session. */
  plan: DeliveryPlan
  /** Mentors currently on THIS session's team (session_mentors). */
  assignedMentors: AssignedMentor[]
  /** Active mentors NOT yet on the team (available to add). */
  availableMentors: MentorOption[]
}
