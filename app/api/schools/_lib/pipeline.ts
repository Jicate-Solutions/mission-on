import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/api/schools/_lib/pipeline.ts
//
// School-pipeline module: shared server-only data layer + domain rules. This is
// OWNED by the school-pipeline feature (lives under app/api/schools, one of the
// three paths this module owns). It re-verifies auth + role on EVERY query and
// returns classification-free DTOs only.
//
// SAFEGUARDING / CONFIDENTIALITY RULES ENCODED HERE:
//   * A COORDINATOR may NEVER see classification or module-code data. Coordinator
//     reads go through the classification-free shapes (SchoolPipelineRow /
//     SessionLogisticsRow), and the underlying tables are read with an explicit
//     allow-list of columns — NEVER computed_*/confirmed_*/module_code.
//   * A COORDINATOR sees ONLY their own schools (coordinator_id = self). This is
//     enforced both by an explicit filter here AND by RLS as the backstop.
//   * ADMIN / SUPER_ADMIN see the pipeline board across all schools.
//
// All Supabase access uses the RLS-scoped SSR client (lib/supabase/server). The
// service-role client is used ONLY to resolve coordinator display labels (email)
// for admin assignment UIs — never to bypass the classification split.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuthorizationError, requireRole } from '@/lib/dal'
import { notifyAdmins } from '@/lib/dal/notify-admins'
import type { SessionContext } from '@/lib/dal'
import type {
  FeeBracket,
  PipelineStage,
  SchoolStatus,
  SchoolType,
  SessionStatus,
} from '@/types/database'
import {
  PIPELINE_STAGES,
  SESSION_STATUSES,
  STATUSES_BY_STAGE,
  STAGE_LABELS,
  STATUS_LABELS,
} from './pipeline.constants'

// Re-export the pure domain constants so server callers can import everything
// from one place. The single source of truth lives in pipeline.constants.ts
// (which is also safe to import from Client Components).
export * from './pipeline.constants'

// Validity helpers (used by Server Actions to reject forged direct-POST input).
const PIPELINE_STAGE_SET = new Set<string>(PIPELINE_STAGES)
const SCHOOL_TYPE_SET = new Set<string>(['private', 'government'])
const FEE_BRACKET_SET = new Set<string>(['fee_above_1l', 'fee_below_1l', 'govt'])
const SESSION_STATUS_SET = new Set<string>(SESSION_STATUSES)

export function isPipelineStage(v: unknown): v is PipelineStage {
  return typeof v === 'string' && PIPELINE_STAGE_SET.has(v)
}
export function isSchoolType(v: unknown): v is SchoolType {
  return typeof v === 'string' && SCHOOL_TYPE_SET.has(v)
}
export function isFeeBracket(v: unknown): v is FeeBracket {
  return typeof v === 'string' && FEE_BRACKET_SET.has(v)
}
export function isSessionStatus(v: unknown): v is SessionStatus {
  return typeof v === 'string' && SESSION_STATUS_SET.has(v)
}
export function isStatusValidForStage(
  stage: PipelineStage,
  status: unknown
): status is SchoolStatus {
  return (
    typeof status === 'string' &&
    (STATUSES_BY_STAGE[stage] as readonly string[]).includes(status)
  )
}

// -----------------------------------------------------------------------------
// DTOs — classification-FREE shapes. Note the deliberate absence of any
// computed_*/confirmed_*/module_code fields. Both admin and coordinator reads
// return these shapes; the pipeline board never carries a module code.
// -----------------------------------------------------------------------------

/** A school as the pipeline board / coordinator list shows it. No classification. */
export interface SchoolPipelineRow {
  id: string
  name: string
  type: SchoolType
  feeBracket: FeeBracket
  coordinatorId: string | null
  pipelineStage: PipelineStage
  status: SchoolStatus
  createdAt: string
  updatedAt: string
}

/** Session logistics as coordinators capture them. NO module_code, by design. */
export interface SessionLogisticsRow {
  id: string
  schoolId: string
  grade: string
  sessionDate: string | null
  dayOfWeek: string | null
  startTime: string | null
  expectedStrength: number | null
  status: SessionStatus
  createdAt: string
  updatedAt: string
}

/** A coordinator option for the admin assignment UI (email is a display label). */
export interface CoordinatorOption {
  userId: string
  /** Display label (email) resolved via service role; falls back to a short id. */
  label: string
  schoolId: string | null
}

// -----------------------------------------------------------------------------
// Row mappers (snake_case row -> camelCase DTO). Each mapper accepts ONLY the
// allow-listed safe columns, so a classification column cannot leak through.
// -----------------------------------------------------------------------------

interface SafeSchoolRow {
  id: string
  name: string
  type: SchoolType
  fee_bracket: FeeBracket
  coordinator_id: string | null
  pipeline_stage: PipelineStage
  status: SchoolStatus
  created_at: string
  updated_at: string
}

function toSchoolPipelineRow(r: SafeSchoolRow): SchoolPipelineRow {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    feeBracket: r.fee_bracket,
    coordinatorId: r.coordinator_id,
    pipelineStage: r.pipeline_stage,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

interface SafeSessionRow {
  id: string
  school_id: string
  grade: string
  session_date: string | null
  day_of_week: string | null
  start_time: string | null
  expected_strength: number | null
  status: SessionStatus
  created_at: string
  updated_at: string
}

function toSessionLogisticsRow(r: SafeSessionRow): SessionLogisticsRow {
  return {
    id: r.id,
    schoolId: r.school_id,
    grade: r.grade,
    sessionDate: r.session_date,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    expectedStrength: r.expected_strength,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// Allow-listed column projection for schools — NEVER add classification here.
// schools holds no classification columns, but we keep an explicit list as a
// defensive habit consistent with the rest of the codebase.
const SCHOOL_COLUMNS =
  'id, name, type, fee_bracket, coordinator_id, pipeline_stage, status, created_at, updated_at'

// -----------------------------------------------------------------------------
// READS
// -----------------------------------------------------------------------------

/**
 * Admin/super_admin pipeline board: all schools, classification-free. Ordered
 * by stage then name so the board groups naturally.
 */
export async function listAllSchoolsForBoard(): Promise<SchoolPipelineRow[]> {
  await requireRole(['admin', 'super_admin'])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .order('name', { ascending: true })

  if (error) throw error
  return ((data ?? []) as SafeSchoolRow[]).map(toSchoolPipelineRow)
}

/**
 * Coordinator's own schools (coordinator_id = self). Explicit self-filter plus
 * RLS backstop. Classification-free.
 */
export async function listOwnSchools(): Promise<SchoolPipelineRow[]> {
  const session = await requireRole([
    'coordinator',
    'admin',
    'super_admin',
  ])

  const supabase = await createClient()
  let query = supabase
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .order('name', { ascending: true })

  // Coordinators are hard-scoped to their own schools. Admins viewing the
  // coordinator surface see everything (RLS allows it) — but the dedicated
  // coordinator pages always run as a coordinator.
  if (session.role === 'coordinator') {
    query = query.eq('coordinator_id', session.userId)
  }

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as SafeSchoolRow[]).map(toSchoolPipelineRow)
}

/**
 * Fetch one school the caller is allowed to see (classification-free). Returns
 * null when not found / not visible under RLS. Coordinators additionally are
 * self-scoped here.
 */
export async function getSchool(
  schoolId: string
): Promise<SchoolPipelineRow | null> {
  const session = await requireRole([
    'coordinator',
    'admin',
    'super_admin',
  ])

  const supabase = await createClient()
  let query = supabase
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .eq('id', schoolId)

  if (session.role === 'coordinator') {
    query = query.eq('coordinator_id', session.userId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data ? toSchoolPipelineRow(data as SafeSchoolRow) : null
}

/**
 * Session logistics for a school. The `sessions` parent is now module-free (the
 * admin-designed module anchor moved to the admin-only `session_design` child,
 * 0006), so ALL roles read the base table directly with an explicit safe-column
 * allow-list. Coordinators are scoped by the sessions_coordinator_select RLS
 * policy; module_code is never projected here. NO module code is returned.
 */
export async function listSchoolSessions(
  schoolId: string
): Promise<SessionLogisticsRow[]> {
  await requireRole(['coordinator', 'admin', 'super_admin'])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, school_id, grade, session_date, day_of_week, start_time, expected_strength, status, created_at, updated_at'
    )
    .eq('school_id', schoolId)
    .order('session_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return ((data ?? []) as SafeSessionRow[]).map(toSessionLogisticsRow)
}

/**
 * Resolve assignable coordinators for the admin create/assign UI. We list users
 * whose role is 'coordinator' (RLS lets admins read user_roles), then resolve a
 * friendly email label via the service-role auth admin API.
 *
 * Admin-gated.
 */
export async function listCoordinatorOptions(): Promise<CoordinatorOption[]> {
  await requireRole(['admin', 'super_admin'])

  const supabase = await createClient()
  const { data: roleRows, error } = await supabase
    .from('user_roles')
    .select('user_id, school_id')
    .eq('role', 'coordinator')

  if (error) throw error
  const rows = (roleRows ?? []) as { user_id: string; school_id: string | null }[]
  if (rows.length === 0) return []

  // Resolve display emails via the service-role auth admin API. This touches no
  // program data — only the auth user's email — and never the classification
  // split. Failures degrade gracefully to a short id label.
  const labels = new Map<string, string>()
  try {
    const admin = createAdminClient()
    // getUserById is the least-privilege call available; loop over the small set
    // of coordinators (this set is operationally tiny).
    await Promise.all(
      rows.map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.user_id)
        if (data.user?.email) labels.set(r.user_id, data.user.email)
      })
    )
  } catch {
    // Service-role lookup unavailable — fall back to id labels below.
  }

  return rows.map((r) => ({
    userId: r.user_id,
    label: labels.get(r.user_id) ?? `Coordinator ${r.user_id.slice(0, 8)}`,
    schoolId: r.school_id,
  }))
}

/**
 * Build a coordinatorId -> label map for rendering the admin board (so the board
 * can show who owns each school without leaking anything sensitive).
 */
export async function getCoordinatorLabelMap(): Promise<Map<string, string>> {
  const options = await listCoordinatorOptions()
  const map = new Map<string, string>()
  for (const o of options) map.set(o.userId, o.label)
  return map
}

// -----------------------------------------------------------------------------
// Shared write helpers (used by Server Actions in both route groups). Each
// re-verifies role itself; they are the actual authorization boundary for a
// direct POST.
// -----------------------------------------------------------------------------

export interface CreateSchoolInput {
  name: string
  type: SchoolType
  feeBracket: FeeBracket
  coordinatorId: string | null
}

/**
 * Create a school + assign a coordinator. Admin/super_admin only (per RBAC:
 * coordinators run pipelines but do not create school records / assign owners).
 * Returns the new school id.
 */
export async function createSchool(
  input: CreateSchoolInput
): Promise<{ id: string }> {
  const session = await requireRole(['admin', 'super_admin'])
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('schools')
    .insert({
      name: input.name,
      type: input.type,
      fee_bracket: input.feeBracket,
      coordinator_id: input.coordinatorId,
      created_by: session.userId,
      // pipeline_stage / status take DB defaults (approach / not_started).
    })
    .select('id')
    .single()

  if (error) throw error
  return { id: (data as { id: string }).id }
}

/**
 * Reassign a school's coordinator. Admin/super_admin only.
 */
export async function assignCoordinator(
  schoolId: string,
  coordinatorId: string | null
): Promise<void> {
  await requireRole(['admin', 'super_admin'])
  const supabase = await createClient()

  const { error } = await supabase
    .from('schools')
    .update({ coordinator_id: coordinatorId, updated_at: new Date().toISOString() })
    .eq('id', schoolId)

  if (error) throw error
}

/**
 * Update a school's pipeline stage + status. Coordinator (own schools), admin,
 * or super_admin. The status MUST be valid for the target stage (Appendix A).
 *
 * NOTE: this writes ONLY stage + status — never classification columns (which do
 * not exist on `schools` anyway). The RLS coordinator-update policy backstops
 * the self-scope.
 */
export async function updateSchoolStage(
  schoolId: string,
  stage: PipelineStage,
  status: SchoolStatus
): Promise<void> {
  const session = await assertCanWriteSchool(schoolId)

  const supabase = await createClient()
  const { error } = await supabase
    .from('schools')
    .update({
      pipeline_stage: stage,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', schoolId)

  if (error) throw error

  // Alert the triage owners so no school is "lost" between stages (PRD §7.11,
  // §3 "zero lost schools"). Best-effort; the actor (if an admin) is excluded.
  const { data: school } = await supabase
    .from('schools')
    .select('name')
    .eq('id', schoolId)
    .maybeSingle()
  const name = (school as { name: string } | null)?.name ?? 'A school'
  await notifyAdmins(
    {
      type: 'stage_change',
      title: `${name}: ${STAGE_LABELS[stage]}`,
      body: `${name} moved to "${STAGE_LABELS[stage]}" — ${STATUS_LABELS[status]}.`,
      entityType: 'schools',
      entityId: schoolId,
    },
    { excludeUserId: session.userId }
  )
}

export interface SessionLogisticsInput {
  grade: string
  sessionDate: string | null
  dayOfWeek: string | null
  startTime: string | null
  expectedStrength: number | null
  status: SessionStatus
}

/**
 * Create a session-logistics record for a school. Coordinator (own school),
 * admin, or super_admin. The `sessions` table is module-free — the admin-designed
 * module anchor lives in the admin-only `session_design` child (0006) and is set
 * elsewhere — so there is nothing module-related to omit here.
 */
export async function createSessionLogistics(
  schoolId: string,
  input: SessionLogisticsInput
): Promise<{ id: string }> {
  const session = await assertCanWriteSchool(schoolId)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      school_id: schoolId,
      grade: input.grade,
      session_date: input.sessionDate,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      expected_strength: input.expectedStrength,
      status: input.status,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (error) throw error
  return { id: (data as { id: string }).id }
}

/**
 * Update an existing session-logistics record. Coordinator (own school), admin,
 * or super_admin. The module anchor lives on the admin-only session_design child
 * (0006); this logistics update never touches it.
 */
export async function updateSessionLogistics(
  schoolId: string,
  sessionId: string,
  input: SessionLogisticsInput
): Promise<void> {
  await assertCanWriteSchool(schoolId)

  const supabase = await createClient()
  const { error } = await supabase
    .from('sessions')
    .update({
      grade: input.grade,
      session_date: input.sessionDate,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      expected_strength: input.expectedStrength,
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('school_id', schoolId)

  if (error) throw error
}

/**
 * Authorize a write against a specific school: admins/super_admin always; a
 * coordinator only for a school they own. Throws AuthorizationError otherwise.
 * Returns the verified session for reuse.
 */
async function assertCanWriteSchool(
  schoolId: string
): Promise<SessionContext> {
  const session = await requireRole([
    'coordinator',
    'admin',
    'super_admin',
  ])

  if (session.role === 'coordinator') {
    // Confirm ownership server-side (independent of any client-supplied claim).
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('schools')
      .select('id')
      .eq('id', schoolId)
      .eq('coordinator_id', session.userId)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      // RLS would also block the write; fail fast with a clear 403.
      throw new AuthorizationError('Forbidden: not your school.', 403)
    }
  }

  return session
}
