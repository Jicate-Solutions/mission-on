// =============================================================================
// Mission ON — Smart Choices
// components/modules/module-code-badge.tsx — Presentational badge for a module
// code (e.g. "A2-B2"), or a muted "—" when no code is set. Plain server-safe
// component (no client JS). Module codes are admin/super_admin-visible by RBAC;
// this is only ever rendered on admin/super_admin module pages.
// =============================================================================

import { Badge } from '@/components/ui/badge'
import type { ModuleCode } from '@/types/database'

export function ModuleCodeBadge({
  code,
  variant = 'brand',
}: {
  code: ModuleCode | null
  variant?: 'brand' | 'neutral' | 'success'
}) {
  if (!code) return <span className="text-ink-muted">—</span>
  return <Badge variant={variant}>{code}</Badge>
}
