// =============================================================================
// Mission ON — Smart Choices
// components/modules/module-labels.ts — Human-readable reference for the nine
// intervention module codes (PRD §6, §18 Appendix B). Plain data (no
// 'use client' / 'server-only') so both server pages and client widgets in the
// Module Design Workspace may import it.
//
// A module code (e.g. "A2-B2") combines a demographic anchor (A1/A2/A3) and a
// behaviour anchor (B1/B2/B3). This file maps each to its school/usage profile
// so the workspace can render the planning anchor in plain language. It carries
// NO sensitive data — module codes are admin/super_admin-visible by RBAC, and
// this file is only ever imported on admin/super_admin module pages.
// =============================================================================

import type {
  CategoryACode,
  CategoryBCode,
  ModuleCode,
} from '@/types/database'

/** The nine module codes in matrix order (PRD §6.3). */
export const ALL_MODULE_CODES: ModuleCode[] = [
  'A1-B1',
  'A1-B2',
  'A1-B3',
  'A2-B1',
  'A2-B2',
  'A2-B3',
  'A3-B1',
  'A3-B2',
  'A3-B3',
]

/** Category A — demographic profile by fee bracket / school type (PRD §6.1). */
export const CATEGORY_A_PROFILE: Record<CategoryACode, string> = {
  A1: 'Private school · fees above ₹1,00,000 / year',
  A2: 'Private school · fees below ₹1,00,000 / year',
  A3: 'Government school',
}

/** Category B — behaviour profile by usage reality (PRD §6.2). */
export const CATEGORY_B_PROFILE: Record<CategoryBCode, string> = {
  B1: 'No usage / few exposure — aware and afraid to take up drugs',
  B2: 'Mild usage — curiosity-driven, peer-pressure-driven',
  B3: 'Frequent users — and actively influencing others to use',
}

/** Split a module code into its A and B components. */
export function splitModuleCode(code: ModuleCode): {
  a: CategoryACode
  b: CategoryBCode
} {
  const [a, b] = code.split('-') as [CategoryACode, CategoryBCode]
  return { a, b }
}

/** The school (demographic) profile line for a module code. */
export function schoolProfile(code: ModuleCode): string {
  return CATEGORY_A_PROFILE[splitModuleCode(code).a]
}

/** The usage (behaviour) profile line for a module code. */
export function usageProfile(code: ModuleCode): string {
  return CATEGORY_B_PROFILE[splitModuleCode(code).b]
}
