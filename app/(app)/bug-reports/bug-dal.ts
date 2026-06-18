import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/bug-reports/bug-dal.ts — module-local server-only data access for
// the bug report system (PRD §7.10, §11).
//
// Any role may raise a bug (their own report). Admin/super_admin run the
// triage -> assign -> resolve -> close workflow; status is visible to the
// reporter (RLS: reporter sees own rows; admins see all).
//
// Every function re-verifies session + role internally (defense against a direct
// POST to a Server Action / Route Handler). The reporter_id and reporter_role
// are taken from the VERIFIED session, never from caller input, so a report
// cannot be attributed to someone else or forge a privileged reporter_role.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireSession, requireRole } from '@/lib/dal/session'
import { notifyTriageOfNewBug } from '@/app/(app)/bug-reports/_routing'
import {
  BUG_MAX_DESCRIPTION,
  BUG_MAX_RESOLUTION,
  BUG_MAX_LOGS,
  BUG_STATUSES,
  isBugModule,
  isBugSeverity,
} from '@/app/(app)/bug-reports/bug-constants'
import type {
  BugReportRow,
  BugStatus,
  BugSeverity,
  Role,
} from '@/types/database'

export { BUG_MAX_DESCRIPTION, BUG_MAX_RESOLUTION, BUG_STATUSES }

/** Reporter-facing view of a bug report. */
export interface BugReportView {
  id: string
  displayId: string | null
  reporterId: string
  reporterRole: Role
  description: string
  status: BugStatus
  assigneeId: string | null
  resolution: string | null
  module: string | null
  severity: BugSeverity | null
  createdAt: string
  updatedAt: string
  /** True when the verified caller authored this report. */
  isOwn: boolean
  /** True when this report is assigned to the verified caller. */
  assignedToMe: boolean
}

function toView(
  row: Pick<
    BugReportRow,
    | 'id'
    | 'display_id'
    | 'reporter_id'
    | 'reporter_role'
    | 'description'
    | 'status'
    | 'assignee_id'
    | 'resolution'
    | 'module'
    | 'severity'
    | 'created_at'
    | 'updated_at'
  >,
  callerId: string
): BugReportView {
  return {
    id: row.id,
    displayId: row.display_id,
    reporterId: row.reporter_id,
    reporterRole: row.reporter_role,
    description: row.description,
    status: row.status,
    assigneeId: row.assignee_id,
    resolution: row.resolution,
    module: row.module,
    severity: row.severity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwn: row.reporter_id === callerId,
    assignedToMe: row.assignee_id === callerId,
  }
}

/**
 * List bug reports the caller may see (RLS-scoped): a reporter sees their own;
 * admin/super_admin see the whole queue. Newest first.
 */
export async function listBugReports(): Promise<BugReportView[]> {
  const session = await requireSession()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bug_reports')
    .select(
      'id, display_id, reporter_id, reporter_role, description, status, assignee_id, resolution, module, severity, created_at, updated_at'
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) =>
    toView(row as BugReportRow, session.userId)
  )
}

export interface CreateBugResult {
  ok: boolean
  error?: string
}

/**
 * Raise a bug report. reporter_id / reporter_role come from the verified session
 * (RLS also enforces reporter_id = auth.uid() on insert). A roleless user cannot
 * file (they have no role to record).
 */
export interface CreateBugInput {
  /** Feature area the bug is in (BugModule). Invalid/empty -> 'other'. */
  module?: string | null
  /** Optional pasted console logs / stack trace (Bug Agent input). */
  consoleLogs?: string | null
}

export async function createBugReport(
  rawDescription: string,
  input: CreateBugInput = {}
): Promise<CreateBugResult> {
  const session = await requireSession()
  if (!session.role) {
    return { ok: false, error: 'Your account is not yet activated.' }
  }

  const description = rawDescription.trim()
  if (description.length === 0) {
    return { ok: false, error: 'Please describe the problem.' }
  }
  if (description.length > BUG_MAX_DESCRIPTION) {
    return {
      ok: false,
      error: `Keep the description under ${BUG_MAX_DESCRIPTION} characters.`,
    }
  }

  const moduleValue = isBugModule(input.module) ? input.module : 'other'

  const logs = (input.consoleLogs ?? '').trim()
  if (logs.length > BUG_MAX_LOGS) {
    return {
      ok: false,
      error: `Keep the console logs under ${BUG_MAX_LOGS} characters.`,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bug_reports')
    .insert({
      reporter_id: session.userId,
      reporter_role: session.role,
      description,
      status: 'open',
      module: moduleValue,
      console_logs: logs.length > 0 ? logs : null,
    })
    .select('id, display_id')
    .single()

  if (error) throw error

  // Alert the triage owners (admin/super_admin) so reports are never "lost"
  // between raise and triage (PRD §7.11). Best-effort: never fails the report.
  await notifyTriageOfNewBug({
    bugId: data.id,
    displayId: data.display_id,
    reporterRole: session.role,
  })

  return { ok: true }
}

export interface TriageBugInput {
  bugId: string
  status?: BugStatus
  /** Assign to a specific user id (admin/super_admin user). Empty string clears. */
  assigneeId?: string | null
  resolution?: string | null
  /** Bug Agent severity (P0..P3); empty string clears. */
  severity?: string | null
  /** Reclassify the module (BugModule); ignored if invalid. */
  module?: string | null
}

export interface TriageBugResult {
  ok: boolean
  error?: string
}

/**
 * Triage / assign / resolve / close a bug. Admin/super_admin only (RLS backstops
 * with bug_admin_update). Only the supplied fields are changed.
 */
export async function triageBugReport(
  input: TriageBugInput
): Promise<TriageBugResult> {
  await requireRole(['admin', 'super_admin'])

  if (!input.bugId) return { ok: false, error: 'Missing report.' }

  const update: {
    status?: BugStatus
    assignee_id?: string | null
    resolution?: string | null
    severity?: BugSeverity | null
    module?: string
    updated_at: string
  } = { updated_at: new Date().toISOString() }

  if (input.status !== undefined) {
    if (!BUG_STATUSES.includes(input.status)) {
      return { ok: false, error: 'Invalid status.' }
    }
    update.status = input.status
  }

  if (input.assigneeId !== undefined) {
    update.assignee_id = input.assigneeId ? input.assigneeId : null
  }

  if (input.resolution !== undefined) {
    const resolution = (input.resolution ?? '').trim()
    if (resolution.length > BUG_MAX_RESOLUTION) {
      return {
        ok: false,
        error: `Keep the resolution under ${BUG_MAX_RESOLUTION} characters.`,
      }
    }
    update.resolution = resolution.length > 0 ? resolution : null
  }

  if (input.severity !== undefined) {
    const sev = (input.severity ?? '').trim()
    update.severity = sev === '' ? null : isBugSeverity(sev) ? sev : null
  }

  if (input.module !== undefined && isBugModule(input.module)) {
    update.module = input.module
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('bug_reports')
    .update(update)
    .eq('id', input.bugId)

  if (error) throw error
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Bug Agent EXPORT — emit bugs as the markdown-with-YAML format the bug-agent
// skill consumes (## Bug Report: BUG-XXXXXX + ```yaml frontmatter). Admin/
// super_admin only. By default exports unresolved bugs (open/triaged/assigned);
// pass includeResolved to include resolved/closed.
// -----------------------------------------------------------------------------
export interface BugExportFilter {
  module?: string | null
  includeResolved?: boolean
}
export interface BugExport {
  markdown: string
  count: number
  /** Module slug used in the header/filename ('all' when unfiltered). */
  module: string
}

function yamlValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return 'null'
  return String(v)
}

export async function buildBugExport(
  filter: BugExportFilter = {}
): Promise<BugExport> {
  await requireRole(['admin', 'super_admin'])
  const supabase = await createClient()

  let query = supabase
    .from('bug_reports')
    .select(
      'id, display_id, reporter_role, description, status, severity, module, sub_module, console_logs, screenshot_url, similar_count, created_at'
    )
    .order('created_at', { ascending: true })

  if (filter.module && isBugModule(filter.module)) {
    query = query.eq('module', filter.module)
  }
  if (!filter.includeResolved) {
    query = query.in('status', ['open', 'triaged', 'assigned'])
  }

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as Array<
    Pick<
      BugReportRow,
      | 'id'
      | 'display_id'
      | 'reporter_role'
      | 'description'
      | 'status'
      | 'severity'
      | 'module'
      | 'sub_module'
      | 'console_logs'
      | 'screenshot_url'
      | 'similar_count'
      | 'created_at'
    >
  >

  const moduleSlug = filter.module && isBugModule(filter.module)
    ? filter.module
    : 'all'

  const out: string[] = [
    `# Bug Reports — mission-on${moduleSlug !== 'all' ? ` › ${moduleSlug}` : ''}`,
    '',
  ]

  for (const b of rows) {
    out.push(`## Bug Report: ${b.display_id ?? b.id}`, '')
    out.push('```yaml')
    out.push(`id: ${b.id}`)
    out.push(`display_id: ${yamlValue(b.display_id)}`)
    out.push(`module: ${yamlValue(b.module ?? 'other')}`)
    out.push(`sub_module: ${yamlValue(b.sub_module)}`)
    out.push(`status: ${b.status}`)
    out.push(`reporter_role: ${b.reporter_role}`)
    out.push(`severity: ${yamlValue(b.severity)}`)
    out.push(`similar_count: ${b.similar_count ?? 1}`)
    out.push(`screenshot_url: ${yamlValue(b.screenshot_url)}`)
    out.push(`created_at: ${b.created_at}`)
    out.push('```', '')
    out.push(b.description ?? '')
    if (b.console_logs && b.console_logs.trim().length > 0) {
      out.push('', '**Console logs:**', '```', b.console_logs.trim(), '```')
    }
    out.push('', '---', '')
  }

  return { markdown: out.join('\n'), count: rows.length, module: moduleSlug }
}
