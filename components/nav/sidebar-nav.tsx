'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NavIcon } from '@/components/nav/nav-icon'
import type { NavSection } from '@/components/nav/nav-config'
import { isNavItemActive } from '@/components/nav/nav-config'
import { cn } from '@/lib/utils'

export interface SidebarNavProps {
  sections: NavSection[]
  /** Optional click handler so the mobile drawer can close on navigate. */
  onNavigate?: () => void
}

/**
 * Role-filtered sidebar links. The sections come pre-filtered by role from the
 * server shell (it picks NAV_CONFIG[role]); this component only handles active
 * styling via usePathname. It holds NO sensitive data.
 */
export function SidebarNav({ sections, onNavigate }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="flex flex-col gap-7">
      {sections.map((section, i) => (
        <div key={section.heading ?? `section-${i}`} className="flex flex-col gap-0.5">
          {section.heading ? (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted/80">
              {section.heading}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = isNavItemActive(item.href, pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'bg-brand-50 font-semibold text-brand-800'
                    : 'font-medium text-ink-muted hover:bg-surface-muted hover:text-ink'
                )}
              >
                {/* "You are here" — green bar in the gutter; absolute so the
                    icon/label grid never shifts between active and inactive. */}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary"
                  />
                ) : null}
                <NavIcon
                  name={item.icon}
                  className={cn(
                    'size-5 shrink-0 transition-colors',
                    active
                      ? 'text-primary'
                      : item.sensitive
                        ? 'text-warning/80'
                        : 'text-ink-muted/70 group-hover:text-ink'
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
