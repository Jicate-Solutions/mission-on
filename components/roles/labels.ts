import type { Role } from '@/types/database'

/**
 * Human-readable labels + ordering for the role union. Pure constants — safe to
 * import from both Server and Client Components (no 'server-only' here).
 */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  coordinator: 'School Coordinator',
  mentor: 'Mentor',
  learner: 'Learner',
}

/** Display order for role <select> options and roster grouping. */
export const ROLE_ORDER: readonly Role[] = [
  'super_admin',
  'admin',
  'coordinator',
  'mentor',
  'learner',
]

export function roleLabel(role: Role | null): string {
  return role ? ROLE_LABELS[role] : 'No role'
}
