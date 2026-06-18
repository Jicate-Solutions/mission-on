import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/questionnaires/_builder/queries.ts — Admin/super_admin reads
// for the Questionnaire Builder (PRD §7.3 / §15 Phase 2).
//
// SECURITY: every exported function re-verifies admin/super_admin via
// requireRole(['admin','super_admin']) BEFORE touching the DB — a page-level
// gate is never trusted (a Server Component render is reachable, and these
// helpers may also be called from actions). Reads go through the RLS-scoped SSR
// client: the qtemplates_select policy admits templates to admins (and the
// active one to coordinators, which we never use here).
//
// This module reads the questionnaire TEMPLATE (no PII). The `questions` jsonb it
// returns is the EXACT shape lib/classification.ts consumes.
// =============================================================================

import { requireRole } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type { TemplateQuestion } from '@/types/database'

import type { BuilderTemplate } from './types'

const ADMIN_ROLES = ['admin', 'super_admin'] as const

interface TemplateRowShape {
  id: string
  version: number
  title: string
  is_active: boolean
  questions: TemplateQuestion[]
}

function toBuilderTemplate(row: TemplateRowShape): BuilderTemplate {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    isActive: row.is_active,
    // questions is canonical TemplateQuestion[] as stored; pass through untouched.
    questions: Array.isArray(row.questions) ? row.questions : [],
  }
}

/**
 * Load the ACTIVE questionnaire template (is_active = true). Returns null when no
 * active template exists yet. ADMIN / SUPER_ADMIN ONLY (re-verified). When more
 * than one row is somehow flagged active, the highest version wins.
 */
export async function getActiveTemplate(): Promise<BuilderTemplate | null> {
  await requireRole(ADMIN_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('questionnaire_templates')
    .select('id, version, title, is_active, questions')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load active questionnaire template: ${error.message}`)
  }
  if (!data) return null

  return toBuilderTemplate(data as unknown as TemplateRowShape)
}

/**
 * The current maximum version across ALL templates (active or not). Used by the
 * save action to compute the next version (max + 1). Returns 0 when none exist.
 * ADMIN / SUPER_ADMIN ONLY (re-verified).
 */
export async function getMaxTemplateVersion(): Promise<number> {
  await requireRole(ADMIN_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('questionnaire_templates')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read template versions: ${error.message}`)
  }
  return (data as { version: number } | null)?.version ?? 0
}
