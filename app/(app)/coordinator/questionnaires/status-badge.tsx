import { Badge } from '@/components/ui/badge'
import type { QuestionnaireStatus } from '@/types/database'

type Variant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

const STATUS_META: Record<
  QuestionnaireStatus,
  { label: string; variant: Variant }
> = {
  draft: { label: 'Draft', variant: 'neutral' },
  issued: { label: 'Issued', variant: 'info' },
  partially_filled: { label: 'Partially filled', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  confirmed: { label: 'Confirmed', variant: 'brand' },
}

/** Lifecycle status badge — safe for coordinators (no classification). */
export function QuestionnaireStatusBadge({
  status,
}: {
  status: QuestionnaireStatus | null
}) {
  if (status === null) {
    return <Badge variant="neutral">Not issued</Badge>
  }
  const meta = STATUS_META[status]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}
