import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// safeguarding queue (admin / super_admin) — server-only data layer.
//
// The queue is the ONLY place admins read the otherwise-confidential follow-
// through log: RLS (ftl_admin_select) exposes a log to admins ONLY when it is
// safeguarding_escalated AND has an open/acknowledged escalation. Reading the
// revealed log text is a classification-grade access — we AUDIT it via the
// DAL writeAudit() path on the detail read.
//
// Learner real identity is fetched through the DAL getLearnerFull(), which is
// admin-gated and writes its own reveal audit for mentors (admins are routine).
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole, writeAudit, getLearnerFull } from '@/lib/dal'
import type { EscalationStatus, LearnerFull } from '@/types/database'

/** One row in the safeguarding queue (list view — no log text yet). */
export interface QueueItem {
  id: string
  followThroughLogId: string
  reason: string
  status: EscalationStatus
  escalatedBy: string
  escalatedTo: string | null
  createdAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
  /** ISO deadline for the current SLA step (ack or resolve); null when resolved. */
  slaDeadline: string | null
  /** True when the current SLA step has been breached (PRD §12 timelines). */
  isOverdue: boolean
}

/** SLA thresholds (hours). Stored in program_config.settings; sensible defaults. */
interface SafeguardingSla {
  ackHours: number
  resolveHours: number
}

const DEFAULT_SLA: SafeguardingSla = { ackHours: 24, resolveHours: 72 }

/**
 * Read the safeguarding SLA from program_config.settings (readable by all
 * authenticated). An OPEN escalation must be ACKNOWLEDGED within ackHours of
 * creation; an ACKNOWLEDGED one RESOLVED within resolveHours of acknowledgement.
 * Falls back to defaults when unset or invalid.
 */
async function getSafeguardingSla(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<SafeguardingSla> {
  const { data } = await supabase
    .from('program_config')
    .select('settings')
    .eq('id', 1)
    .maybeSingle()
  const s = ((data?.settings as Record<string, unknown> | undefined) ?? {})
  const num = (v: unknown, d: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d
  return {
    ackHours: num(s.safeguarding_ack_hours, DEFAULT_SLA.ackHours),
    resolveHours: num(s.safeguarding_resolve_hours, DEFAULT_SLA.resolveHours),
  }
}

/**
 * Compute the current SLA deadline + overdue flag for one escalation. The clock
 * runs from creation (for open) or acknowledgement (for acknowledged); resolved
 * cases have no live SLA.
 */
function computeSla(
  item: { status: EscalationStatus; createdAt: string; acknowledgedAt: string | null },
  sla: SafeguardingSla,
  nowMs: number
): { slaDeadline: string | null; isOverdue: boolean } {
  if (item.status === 'resolved') return { slaDeadline: null, isOverdue: false }
  const fromAck = item.status === 'acknowledged' && item.acknowledgedAt
  const baseIso = fromAck ? (item.acknowledgedAt as string) : item.createdAt
  const hours = fromAck ? sla.resolveHours : sla.ackHours
  const deadlineMs = new Date(baseIso).getTime() + hours * 3_600_000
  return {
    slaDeadline: new Date(deadlineMs).toISOString(),
    isOverdue: nowMs > deadlineMs,
  }
}

/** Full detail of one escalation, including the revealed log + learner identity. */
export interface EscalationDetail extends QueueItem {
  auditNotes: string | null
  logNotes: string | null
  logFlags: string[]
  logCreatedAt: string
  /** Real learner identity — revealed because an active escalation exists. */
  learner: LearnerFull | null
}

/**
 * List safeguarding escalations for the admin queue. Admin/super_admin only.
 * RLS (safeguard_select) returns all escalations to admins. Optionally filter
 * by status; default returns the actionable queue (open + acknowledged) first.
 */
export async function listEscalations(opts?: {
  status?: EscalationStatus | 'active'
}): Promise<QueueItem[]> {
  await requireRole(['admin', 'super_admin'])
  const supabase = await createClient()

  let query = supabase
    .from('safeguarding_escalations')
    .select(
      'id, follow_through_log_id, reason, status, escalated_by, escalated_to, created_at, acknowledged_at, resolved_at'
    )
    .order('created_at', { ascending: false })

  if (opts?.status === 'active') {
    query = query.in('status', ['open', 'acknowledged'])
  } else if (opts?.status) {
    query = query.eq('status', opts.status)
  }

  const { data, error } = await query
  if (error) throw error

  const sla = await getSafeguardingSla(supabase)
  const nowMs = Date.now()

  return ((data ?? []) as Array<{
    id: string
    follow_through_log_id: string
    reason: string
    status: EscalationStatus
    escalated_by: string
    escalated_to: string | null
    created_at: string
    acknowledged_at: string | null
    resolved_at: string | null
  }>).map((r) => {
    const base = {
      id: r.id,
      followThroughLogId: r.follow_through_log_id,
      reason: r.reason,
      status: r.status,
      escalatedBy: r.escalated_by,
      escalatedTo: r.escalated_to,
      createdAt: r.created_at,
      acknowledgedAt: r.acknowledged_at,
      resolvedAt: r.resolved_at,
    }
    return { ...base, ...computeSla(base, sla, nowMs) }
  })
}

/**
 * Full detail for one escalation: the escalation row, the revealed follow-
 * through log (RLS exposes it only while active), and the learner's real
 * identity (admin-gated DAL). Reading the confidential log is AUDITED.
 *
 * Returns null if the escalation does not exist / is not visible.
 */
export async function getEscalationDetail(
  escalationId: string
): Promise<EscalationDetail | null> {
  const session = await requireRole(['admin', 'super_admin'])
  const supabase = await createClient()

  const { data: esc, error: escError } = await supabase
    .from('safeguarding_escalations')
    .select(
      'id, follow_through_log_id, reason, status, escalated_by, escalated_to, audit_notes, created_at, acknowledged_at, resolved_at'
    )
    .eq('id', escalationId)
    .maybeSingle<{
      id: string
      follow_through_log_id: string
      reason: string
      status: EscalationStatus
      escalated_by: string
      escalated_to: string | null
      audit_notes: string | null
      created_at: string
      acknowledged_at: string | null
      resolved_at: string | null
    }>()

  if (escError) throw escError
  if (!esc) return null

  // Read the revealed log. RLS only returns it while the escalation is active
  // (open/acknowledged); for a resolved escalation the log re-hides — that is by
  // design (reveal-on-safeguarding ends when the case closes).
  const { data: log, error: logError } = await supabase
    .from('follow_through_logs')
    .select('id, learner_id, notes, flags, created_at')
    .eq('id', esc.follow_through_log_id)
    .maybeSingle<{
      id: string
      learner_id: string
      notes: string | null
      flags: string[]
      created_at: string
    }>()

  if (logError) throw logError

  let learner: LearnerFull | null = null
  if (log) {
    // Audit the admin's access to the confidential safeguarding log + the
    // learner identity it reveals (identity.reveal is the on-allow-list action
    // that best describes reading otherwise-masked minor identity).
    await writeAudit({
      action: 'identity.reveal',
      entityType: 'follow_through_logs',
      entityId: log.id,
      actorId: session.userId,
      metadata: {
        via: 'safeguarding_queue',
        role: session.role,
        escalationId: esc.id,
      },
    })
    // Reveal the learner's real identity (admin-gated DAL).
    learner = await getLearnerFull(log.learner_id)
  }

  const sla = await getSafeguardingSla(supabase)
  const slaState = computeSla(
    {
      status: esc.status,
      createdAt: esc.created_at,
      acknowledgedAt: esc.acknowledged_at,
    },
    sla,
    Date.now()
  )

  return {
    id: esc.id,
    followThroughLogId: esc.follow_through_log_id,
    reason: esc.reason,
    status: esc.status,
    escalatedBy: esc.escalated_by,
    escalatedTo: esc.escalated_to,
    auditNotes: esc.audit_notes,
    createdAt: esc.created_at,
    acknowledgedAt: esc.acknowledged_at,
    resolvedAt: esc.resolved_at,
    slaDeadline: slaState.slaDeadline,
    isOverdue: slaState.isOverdue,
    logNotes: log?.notes ?? null,
    logFlags: log?.flags ?? [],
    logCreatedAt: log?.created_at ?? esc.created_at,
    learner,
  }
}
