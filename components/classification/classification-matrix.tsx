import * as React from 'react'

import { cn } from '@/lib/utils'
import {
  CATEGORY_A_CODES,
  CATEGORY_B_CODES,
  type MatrixCell,
} from '@/app/(app)/admin/classification/_data'

// =============================================================================
// Mission ON — Smart Choices
// components/classification/classification-matrix.tsx — the 3×3 module-code
// distribution (PRD §6.3). PRESENTATIONAL ONLY: the caller passes already-
// aggregated per-cell counts (no raw confidential rows reach here). Rows are
// Category A (demographic), columns are Category B (behaviour); each cell shows
// the module code and how many schools currently sit in it (by effective code).
// =============================================================================

const A_LABEL: Record<string, string> = {
  A1: 'A1 · Private, fees ≥ ₹1L',
  A2: 'A2 · Private, fees < ₹1L',
  A3: 'A3 · Government',
}

const B_LABEL: Record<string, string> = {
  B1: 'B1 · No / few exposure',
  B2: 'B2 · Mild usage',
  B3: 'B3 · Frequent users',
}

export function ClassificationMatrix({ cells }: { cells: MatrixCell[] }) {
  const max = Math.max(1, ...cells.map((c) => c.count))
  const cellAt = (a: string, b: string) =>
    cells.find((c) => c.aCode === a && c.bCode === b)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1.5">
        <thead>
          <tr>
            <th className="w-32" />
            {CATEGORY_B_CODES.map((b) => (
              <th
                key={b}
                className="px-2 py-1 text-center text-xs font-medium text-ink-muted"
              >
                {B_LABEL[b]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORY_A_CODES.map((a) => (
            <tr key={a}>
              <th className="py-1 pr-2 text-left text-xs font-medium text-ink-muted">
                {A_LABEL[a]}
              </th>
              {CATEGORY_B_CODES.map((b) => {
                const cell = cellAt(a, b)
                const count = cell?.count ?? 0
                const intensity = count === 0 ? 0 : 0.18 + (count / max) * 0.82
                return (
                  <td key={b} className="p-0">
                    <div
                      className={cn(
                        'flex h-20 flex-col items-center justify-center rounded-lg border text-center',
                        count > 0
                          ? 'border-brand-200'
                          : 'border-border bg-surface'
                      )}
                      style={
                        count > 0
                          ? {
                              backgroundColor: `color-mix(in srgb, var(--color-brand-400) ${Math.round(
                                intensity * 100
                              )}%, white)`,
                            }
                          : undefined
                      }
                    >
                      <span
                        className={cn(
                          'text-xs font-medium',
                          count > 0 ? 'text-brand-800' : 'text-ink-muted'
                        )}
                      >
                        {cell?.moduleCode ?? `${a}-${b}`}
                      </span>
                      <span
                        className={cn(
                          'text-2xl font-semibold tabular-nums',
                          count > 0 ? 'text-brand-800' : 'text-ink-muted'
                        )}
                      >
                        {count}
                      </span>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
