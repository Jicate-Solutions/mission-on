import { LifeBuoy, Phone, ExternalLink } from 'lucide-react'

import {
  CRISIS_RESOURCES,
  CRISIS_INTRO,
} from '@/app/(app)/anonymous-chat/crisis-resources'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * In-app crisis / wellbeing resources panel (PRD §12). Server Component — pure
 * presentation over the static CRISIS_RESOURCES data. Sensitive situations are
 * routed to humans (helplines / a trusted adult), never auto-handled.
 */
export function CrisisPanel() {
  return (
    <Card className="border-[color-mix(in_srgb,var(--color-info)_40%,var(--color-border))]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="size-4 text-info" aria-hidden="true" />
          Need to talk to someone?
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{CRISIS_INTRO}</p>
        <ul className="flex flex-col gap-2">
          {CRISIS_RESOURCES.map((r) => (
            <li key={r.key}>
              <a
                href={r.href}
                {...(r.external
                  ? { rel: 'noopener noreferrer' }
                  : {})}
                className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2 hover:bg-surface-muted"
              >
                <Phone
                  className="mt-0.5 size-4 shrink-0 text-info"
                  aria-hidden="true"
                />
                <span className="flex flex-col">
                  <span className="flex items-center gap-1 text-sm font-medium text-ink">
                    {r.label}
                    {r.external ? (
                      <ExternalLink
                        className="size-3 text-ink-muted"
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {r.description}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
