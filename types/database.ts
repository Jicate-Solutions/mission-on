// =============================================================================
// Mission ON — Smart Choices
// types/database.ts — Hand-written TypeScript types mirroring the SQL schema
// (supabase/migrations/0001_init.sql) plus the DTO types the DAL exposes.
//
// SAFEGUARDING NOTE (read before editing):
//   This file encodes the TWO-TABLE identity split structurally in the type
//   system. `MentorPublic` and `LearnerPublic` carry alias-only data; the
//   "...Full" DTOs carry real identity and are returned ONLY by guarded DAL
//   functions. Keeping these as DISTINCT, non-assignable TypeScript types is a
//   deliberate compile-time guard: a feature module that only ever receives a
//   `MentorPublic` cannot accidentally read `real_name` because the field does
//   not exist on the type.
//
// This file is OWNED by the DAL/types module. Other modules import from it and
// MUST NOT edit it. Treat the exported surface as a stable contract.
// =============================================================================

// -----------------------------------------------------------------------------
// ENUMS — mirror the Postgres enums in 0001_init.sql exactly (same string
// literals; these values cross the wire as-is).
// -----------------------------------------------------------------------------

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'coordinator'
  | 'mentor'
  | 'learner'

/** Stable alias used across the app for the role union. */
export type Role = UserRole

export type UserSubRole = 'jkkn_counsellor'

export type SchoolType = 'private' | 'government'

export type FeeBracket = 'fee_above_1l' | 'fee_below_1l' | 'govt'

export type CategoryACode = 'A1' | 'A2' | 'A3'

export type CategoryBCode = 'B1' | 'B2' | 'B3'

export type ModuleCode =
  | 'A1-B1'
  | 'A1-B2'
  | 'A1-B3'
  | 'A2-B1'
  | 'A2-B2'
  | 'A2-B3'
  | 'A3-B1'
  | 'A3-B2'
  | 'A3-B3'

export type QuestionCategory = 'A_demographic' | 'A_behaviour' | 'B'

export type PipelineStage =
  | 'approach'
  | 'questionnaire'
  | 'session_fixing'
  | 'delivery'
  | 'follow_up'

export type SchoolStatus =
  // Approach
  | 'not_started'
  | 'contacted'
  | 'awaiting_response'
  | 'declined'
  | 'approved_to_proceed'
  // Questionnaire
  | 'issued'
  | 'partially_filled'
  | 'completed'
  | 'overdue'
  // Session fixing
  | 'proposed'
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  // Delivery
  | 'scheduled'
  | 'delivered'
  | 'postponed'
  // Follow-up
  | 'in_progress'
  | 'completed_follow_up'

export type QuestionnaireStatus =
  | 'draft'
  | 'issued'
  | 'partially_filled'
  | 'completed'
  | 'confirmed'

export type SessionStatus =
  | 'proposed'
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  | 'scheduled'
  | 'delivered'
  | 'postponed'

export type MentorChangeStatus = 'open' | 'approved' | 'rejected'

export type LearnerAssignmentStatus =
  | 'active'
  | 'pending_change'
  | 'reassigned'
  | 'ended'

export type EscalationStatus = 'open' | 'acknowledged' | 'resolved'

export type BugStatus = 'open' | 'triaged' | 'assigned' | 'resolved' | 'closed'

export type NotificationStatus = 'unread' | 'read'

// -----------------------------------------------------------------------------
// JSON helpers.
// -----------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Shape of one option inside a questionnaire question (see 0004_seed.sql).
 * `weight` contributes to the tally; `code` (when present) is the A/B code the
 * option nudges toward.
 */
export interface QuestionOption {
  value: string
  label: string
  weight: number
  code?: CategoryACode | CategoryBCode
}

/** Shape of one question inside questionnaire_templates.questions (jsonb array). */
export interface TemplateQuestion {
  id: string
  category: QuestionCategory
  text: string
  options: QuestionOption[]
}

/**
 * A school's submitted answers. Map of question id -> chosen option `value`.
 * (e.g. { a_dem_school_type: 'private', b_usage_prevalence: 'mild', ... })
 */
export type QuestionnaireAnswers = Record<string, string>

// -----------------------------------------------------------------------------
// TABLE ROW / INSERT / UPDATE TYPES
//
// Convention:
//   <Table>Row    — a row as SELECTed (all columns present; nullable -> | null).
//   <Table>Insert — payload for INSERT (defaulted/generated cols optional).
//   <Table>Update — payload for UPDATE (all updatable cols optional).
//
// These mirror columns 1:1 with the schema. Generated columns (id, created_at,
// updated_at) are present on Row, optional on Insert, and omitted from Update
// where the DB manages them.
// -----------------------------------------------------------------------------

// ---- user_roles -------------------------------------------------------------
export interface UserRoleRow {
  user_id: string
  role: UserRole
  school_id: string | null
  sub_role: UserSubRole | null
  created_at: string
  updated_at: string
}
export interface UserRoleInsert {
  user_id: string
  role: UserRole
  school_id?: string | null
  sub_role?: UserSubRole | null
  created_at?: string
  updated_at?: string
}
export interface UserRoleUpdate {
  role?: UserRole
  school_id?: string | null
  sub_role?: UserSubRole | null
  updated_at?: string
}

// ---- schools ----------------------------------------------------------------
export interface SchoolRow {
  id: string
  name: string
  type: SchoolType
  fee_bracket: FeeBracket
  coordinator_id: string | null
  pipeline_stage: PipelineStage
  status: SchoolStatus
  created_by: string | null
  created_at: string
  updated_at: string
}
export interface SchoolInsert {
  id?: string
  name: string
  type: SchoolType
  fee_bracket: FeeBracket
  coordinator_id?: string | null
  pipeline_stage?: PipelineStage
  status?: SchoolStatus
  created_by?: string | null
  created_at?: string
  updated_at?: string
}
export interface SchoolUpdate {
  name?: string
  type?: SchoolType
  fee_bracket?: FeeBracket
  coordinator_id?: string | null
  pipeline_stage?: PipelineStage
  status?: SchoolStatus
  updated_at?: string
}

// ---- questionnaire_templates ------------------------------------------------
export interface QuestionnaireTemplateRow {
  id: string
  version: number
  title: string
  questions: TemplateQuestion[]
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}
export interface QuestionnaireTemplateInsert {
  id?: string
  version: number
  title: string
  questions: TemplateQuestion[]
  is_active?: boolean
  created_by?: string | null
  created_at?: string
  updated_at?: string
}
export interface QuestionnaireTemplateUpdate {
  version?: number
  title?: string
  questions?: TemplateQuestion[]
  is_active?: boolean
  updated_at?: string
}

// ---- questionnaire_responses ------------------------------------------------
// The parent is now CLASSIFICATION-FREE (lifecycle only). Classification outputs
// live in the admin-only child table `questionnaire_classification` (keyed by
// response_id). Coordinators read this parent directly via the RLS-scoped
// coordinator SELECT policy; the DAL still projects only the safe columns.
export interface QuestionnaireResponseRow {
  id: string
  school_id: string
  template_id: string
  answers: QuestionnaireAnswers
  status: QuestionnaireStatus
  issued_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}
export interface QuestionnaireResponseInsert {
  id?: string
  school_id: string
  template_id: string
  answers?: QuestionnaireAnswers
  status?: QuestionnaireStatus
  issued_at?: string | null
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}
export interface QuestionnaireResponseUpdate {
  answers?: QuestionnaireAnswers
  status?: QuestionnaireStatus
  issued_at?: string | null
  completed_at?: string | null
  updated_at?: string
}

// ---- questionnaire_classification (ADMIN/SUPER_ADMIN ONLY) ------------------
// Admin-only child of questionnaire_responses (0006_classification_split.sql).
// Holds the computed/confirmed module classification. RLS restricts ALL access
// to is_admin_role(); the auto-classify path writes it via the service-role
// client. NEVER reachable on a coordinator/learner/mentor path.
export interface QuestionnaireClassificationRow {
  id: string
  response_id: string
  computed_a_code: CategoryACode | null
  computed_b_code: CategoryBCode | null
  computed_module_code: ModuleCode | null
  confirmed_module_code: ModuleCode | null
  divergence_flag: boolean
  confidence: number | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}
export interface QuestionnaireClassificationInsert {
  id?: string
  response_id: string
  computed_a_code?: CategoryACode | null
  computed_b_code?: CategoryBCode | null
  computed_module_code?: ModuleCode | null
  confirmed_module_code?: ModuleCode | null
  divergence_flag?: boolean
  confidence?: number | null
  confirmed_by?: string | null
  confirmed_at?: string | null
  created_at?: string
  updated_at?: string
}
export interface QuestionnaireClassificationUpdate {
  computed_a_code?: CategoryACode | null
  computed_b_code?: CategoryBCode | null
  computed_module_code?: ModuleCode | null
  confirmed_module_code?: ModuleCode | null
  divergence_flag?: boolean
  confidence?: number | null
  confirmed_by?: string | null
  confirmed_at?: string | null
  updated_at?: string
}

// ---- sessions ---------------------------------------------------------------
// The parent is now MODULE-FREE (logistics only). The admin-designed planning
// module anchor lives in the admin-only child table `session_design` (keyed by
// session_id). Coordinators read this parent directly via the RLS-scoped
// coordinator SELECT policy.
export interface SessionRow {
  id: string
  school_id: string
  grade: string
  session_date: string | null
  day_of_week: string | null
  start_time: string | null
  expected_strength: number | null
  status: SessionStatus
  created_by: string | null
  created_at: string
  updated_at: string
}
export interface SessionInsert {
  id?: string
  school_id: string
  grade: string
  session_date?: string | null
  day_of_week?: string | null
  start_time?: string | null
  expected_strength?: number | null
  status?: SessionStatus
  created_by?: string | null
  created_at?: string
  updated_at?: string
}
export interface SessionUpdate {
  grade?: string
  session_date?: string | null
  day_of_week?: string | null
  start_time?: string | null
  expected_strength?: number | null
  status?: SessionStatus
  updated_at?: string
}

// ---- session_design (ADMIN/SUPER_ADMIN ONLY) --------------------------------
// Admin-only child of sessions (0006_classification_split.sql). Holds the
// admin-designed planning module anchor. RLS restricts ALL access to
// is_admin_role(); never reachable on a coordinator path.
export interface SessionDesignRow {
  id: string
  session_id: string
  module_code: ModuleCode | null
  created_at: string
  updated_at: string
}
export interface SessionDesignInsert {
  id?: string
  session_id: string
  module_code?: ModuleCode | null
  created_at?: string
  updated_at?: string
}
export interface SessionDesignUpdate {
  module_code?: ModuleCode | null
  updated_at?: string
}

// ---- mentor_profiles (REAL identity — admin/super_admin + self only) --------
export interface MentorProfileRow {
  id: string
  user_id: string
  real_name: string
  phone: string | null
  college: string | null
  course: string | null
  created_at: string
  updated_at: string
}
export interface MentorProfileInsert {
  id?: string
  user_id: string
  real_name: string
  phone?: string | null
  college?: string | null
  course?: string | null
  created_at?: string
  updated_at?: string
}
export interface MentorProfileUpdate {
  real_name?: string
  phone?: string | null
  college?: string | null
  course?: string | null
  updated_at?: string
}

// ---- mentor_public (ALIAS — all authenticated) ------------------------------
export interface MentorPublicRow {
  id: string
  mentor_profile_id: string
  alias: string
  is_active: boolean
  created_at: string
  updated_at: string
}
export interface MentorPublicInsert {
  id?: string
  mentor_profile_id: string
  alias: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
}
export interface MentorPublicUpdate {
  alias?: string
  is_active?: boolean
  updated_at?: string
}

// ---- mentor_availability ----------------------------------------------------
export interface MentorAvailabilityRow {
  id: string
  mentor_profile_id: string
  available_date: string
  start_time: string | null
  end_time: string | null
  created_at: string
}
export interface MentorAvailabilityInsert {
  id?: string
  mentor_profile_id: string
  available_date: string
  start_time?: string | null
  end_time?: string | null
  created_at?: string
}
export interface MentorAvailabilityUpdate {
  available_date?: string
  start_time?: string | null
  end_time?: string | null
}

// ---- mentor_school_allocations ----------------------------------------------
export interface MentorSchoolAllocationRow {
  id: string
  mentor_profile_id: string
  school_id: string
  allocated_by: string | null
  created_at: string
}
export interface MentorSchoolAllocationInsert {
  id?: string
  mentor_profile_id: string
  school_id: string
  allocated_by?: string | null
  created_at?: string
}
export interface MentorSchoolAllocationUpdate {
  allocated_by?: string | null
}

// ---- learner_profiles (REAL identity — highest sensitivity) -----------------
export interface LearnerProfileRow {
  id: string
  user_id: string
  real_name: string
  contact_number: string | null
  school_id: string | null
  created_at: string
  updated_at: string
}
export interface LearnerProfileInsert {
  id?: string
  user_id: string
  real_name: string
  contact_number?: string | null
  school_id?: string | null
  created_at?: string
  updated_at?: string
}
export interface LearnerProfileUpdate {
  real_name?: string
  contact_number?: string | null
  school_id?: string | null
  updated_at?: string
}

// ---- learner_public (ALIAS) -------------------------------------------------
export interface LearnerPublicRow {
  id: string
  learner_profile_id: string
  alias: string
  created_at: string
  updated_at: string
}
export interface LearnerPublicInsert {
  id?: string
  learner_profile_id: string
  alias: string
  created_at?: string
  updated_at?: string
}
export interface LearnerPublicUpdate {
  alias?: string
  updated_at?: string
}

// ---- learner_mentor_assignments ---------------------------------------------
export interface LearnerMentorAssignmentRow {
  id: string
  learner_public_id: string
  mentor_public_id: string
  status: LearnerAssignmentStatus
  created_at: string
  updated_at: string
}
export interface LearnerMentorAssignmentInsert {
  id?: string
  learner_public_id: string
  mentor_public_id: string
  status?: LearnerAssignmentStatus
  created_at?: string
  updated_at?: string
}
export interface LearnerMentorAssignmentUpdate {
  mentor_public_id?: string
  status?: LearnerAssignmentStatus
  updated_at?: string
}

// ---- mentor_change_requests -------------------------------------------------
export interface MentorChangeRequestRow {
  id: string
  learner_public_id: string
  current_mentor_public_id: string | null
  reason: string | null
  status: MentorChangeStatus
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}
export interface MentorChangeRequestInsert {
  id?: string
  learner_public_id: string
  current_mentor_public_id?: string | null
  reason?: string | null
  status?: MentorChangeStatus
  resolved_by?: string | null
  resolved_at?: string | null
  created_at?: string
  updated_at?: string
}
export interface MentorChangeRequestUpdate {
  reason?: string | null
  status?: MentorChangeStatus
  resolved_by?: string | null
  resolved_at?: string | null
  updated_at?: string
}

// ---- follow_through_logs (Ring-1 confidential) ------------------------------
export interface FollowThroughLogRow {
  id: string
  learner_id: string
  mentor_id: string
  notes: string | null
  flags: string[]
  safeguarding_escalated: boolean
  created_at: string
  updated_at: string
}
export interface FollowThroughLogInsert {
  id?: string
  learner_id: string
  mentor_id: string
  notes?: string | null
  flags?: string[]
  safeguarding_escalated?: boolean
  created_at?: string
  updated_at?: string
}
export interface FollowThroughLogUpdate {
  notes?: string | null
  flags?: string[]
  safeguarding_escalated?: boolean
  updated_at?: string
}

// ---- safeguarding_escalations -----------------------------------------------
export interface SafeguardingEscalationRow {
  id: string
  follow_through_log_id: string
  escalated_by: string
  escalated_to: string | null
  reason: string
  status: EscalationStatus
  audit_notes: string | null
  acknowledged_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}
export interface SafeguardingEscalationInsert {
  id?: string
  follow_through_log_id: string
  escalated_by: string
  escalated_to?: string | null
  reason: string
  status?: EscalationStatus
  audit_notes?: string | null
  acknowledged_at?: string | null
  resolved_at?: string | null
  created_at?: string
  updated_at?: string
}
export interface SafeguardingEscalationUpdate {
  escalated_to?: string | null
  reason?: string
  status?: EscalationStatus
  audit_notes?: string | null
  acknowledged_at?: string | null
  resolved_at?: string | null
  updated_at?: string
}

// ---- feedback_responses -----------------------------------------------------
export interface FeedbackResponseRow {
  id: string
  learner_public_id: string
  session_id: string | null
  mentor_public_id: string | null
  responses: Json
  is_anonymous: boolean
  created_at: string
}
export interface FeedbackResponseInsert {
  id?: string
  learner_public_id: string
  session_id?: string | null
  mentor_public_id?: string | null
  responses?: Json
  is_anonymous?: boolean
  created_at?: string
}
export interface FeedbackResponseUpdate {
  responses?: Json
  is_anonymous?: boolean
}

// ---- anonymous_posts (NO user_id, ever) -------------------------------------
export interface AnonymousPostRow {
  id: string
  body: string
  session_token_hash: string | null
  is_hidden: boolean
  hidden_by: string | null
  hidden_at: string | null
  created_at: string
}
export interface AnonymousPostInsert {
  id?: string
  body: string
  session_token_hash?: string | null
  is_hidden?: boolean
  hidden_by?: string | null
  hidden_at?: string | null
  created_at?: string
}
export interface AnonymousPostUpdate {
  // Moderation only: hide/unhide.
  is_hidden?: boolean
  hidden_by?: string | null
  hidden_at?: string | null
}

// ---- bug_reports ------------------------------------------------------------
/** Bug Agent severity scale (null until an admin triages). */
export type BugSeverity = 'P0' | 'P1' | 'P2' | 'P3'

export interface BugReportRow {
  id: string
  /** Human display id, e.g. BUG-000042 (auto-assigned by trigger). */
  display_id: string | null
  reporter_id: string
  reporter_role: UserRole
  description: string
  status: BugStatus
  assignee_id: string | null
  resolution: string | null
  /** Bug Agent metadata. */
  module: string | null
  sub_module: string | null
  severity: BugSeverity | null
  console_logs: string | null
  screenshot_url: string | null
  similar_count: number
  resolved_at: string | null
  created_at: string
  updated_at: string
}
export interface BugReportInsert {
  id?: string
  reporter_id: string
  reporter_role: UserRole
  description: string
  status?: BugStatus
  assignee_id?: string | null
  resolution?: string | null
  module?: string | null
  sub_module?: string | null
  severity?: BugSeverity | null
  console_logs?: string | null
  screenshot_url?: string | null
  similar_count?: number
  created_at?: string
  updated_at?: string
}
export interface BugReportUpdate {
  description?: string
  status?: BugStatus
  assignee_id?: string | null
  resolution?: string | null
  module?: string | null
  sub_module?: string | null
  severity?: BugSeverity | null
  resolved_at?: string | null
  updated_at?: string
}

// ---- bug_report_messages (resolution/discussion thread) ---------------------
export interface BugReportMessageRow {
  id: string
  bug_report_id: string
  sender_user_id: string | null
  message_text: string
  created_at: string
}
export interface BugReportMessageInsert {
  id?: string
  bug_report_id: string
  sender_user_id?: string | null
  message_text: string
  created_at?: string
}

// ---- audit_logs (append-only; written via write_audit_log() RPC only) -------
export interface AuditLogRow {
  id: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Json
  created_at: string
}

// ---- notifications ----------------------------------------------------------
export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  status: NotificationStatus
  created_at: string
}
export interface NotificationInsert {
  id?: string
  user_id: string
  type: string
  title: string
  body?: string | null
  entity_type?: string | null
  entity_id?: string | null
  status?: NotificationStatus
  created_at?: string
}
export interface NotificationUpdate {
  status?: NotificationStatus
}

// ---- program_config (singleton id=1) ----------------------------------------
export interface ProgramConfigRow {
  id: number
  program_name: string
  active_template_version: number | null
  fee_threshold_inr: number
  follow_up_window_days: number
  data_retention_days: number | null
  safeguarding_contacts: Json
  settings: Json
  updated_at: string
}
export interface ProgramConfigUpdate {
  program_name?: string
  active_template_version?: number | null
  fee_threshold_inr?: number
  follow_up_window_days?: number
  data_retention_days?: number | null
  safeguarding_contacts?: Json
  settings?: Json
  updated_at?: string
}

// =============================================================================
// DTO TYPES — what the DAL returns to feature code.
//
// CRITICAL: the "Public" DTOs and the "Full" DTOs are DELIBERATELY different,
// non-overlapping TypeScript types. Code that receives a MentorPublic /
// LearnerPublic CANNOT read real-identity fields because they are not present
// on the type. This is the compile-time half of the two-table identity split;
// RLS is the runtime backstop.
// =============================================================================

/**
 * Mentor as a Learner / any authenticated user may see them: ALIAS ONLY.
 * Sourced exclusively from mentor_public. NEVER carries real_name/phone/etc.
 * `id` is the mentor_public.id — the value a learner's chosen-mentor FK points
 * at (learner_mentor_assignments.mentor_public_id).
 */
export interface MentorPublic {
  /** mentor_public.id (the alias-table id; safe to expose to learners). */
  id: string
  alias: string
  is_active: boolean
}

/**
 * Mentor with REAL identity. Returned ONLY by getMentorFull(), which is guarded
 * by requireRole(['admin','super_admin']). Joins mentor_profiles + mentor_public.
 */
export interface MentorFull {
  /** mentor_public.id (kept stable with MentorPublic.id for cross-reference). */
  id: string
  /** mentor_profiles.id (the real-identity row id). */
  profileId: string
  userId: string
  alias: string
  isActive: boolean
  realName: string
  phone: string | null
  college: string | null
  course: string | null
}

/**
 * Learner as seen by a Learner audience / mentor by default: ALIAS ONLY.
 * Sourced exclusively from learner_public. `id` is the learner_public.id.
 */
export interface LearnerPublic {
  /** learner_public.id (the alias-table id). */
  id: string
  alias: string
}

/**
 * Learner with REAL identity (minor data — highest sensitivity). Returned ONLY
 * by getLearnerFull(), guarded for admin/super_admin OR a mentor with an active
 * safeguarding reveal (can_access_learner_identity()).
 */
export interface LearnerFull {
  /** learner_profiles.id (the real-identity row id). */
  id: string
  userId: string
  realName: string
  contactNumber: string | null
  schoolId: string | null
}

// =============================================================================
// CLASSIFICATION ENGINE TYPES (consumed by lib/classification.ts and the DAL).
// =============================================================================

/** Result of the 3x3 classification engine (admin/super_admin visible only). */
export interface ClassificationResult {
  /** Authoritative Category A from fee bracket + school type. */
  computed_a_code: CategoryACode
  /** Resolved Category B from the behavioural tally. */
  computed_b_code: CategoryBCode
  /** The module code = `${computed_a_code}-${computed_b_code}`. */
  computed_module_code: ModuleCode
  /** Scoring confidence in [0, 1]. */
  confidence: number
  /** Set true when demographic vs behavioural Category A diverge > 1 step. */
  divergence_flag: boolean
  /** Human-readable flag strings (e.g. 'A_DIVERGENCE — Admin confirm'). */
  flags: string[]
}
