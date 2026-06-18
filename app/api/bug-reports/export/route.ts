// =============================================================================
// Mission ON — Smart Choices
// app/api/bug-reports/export/route.ts — Bug Agent export endpoint.
//
// GET -> downloads the current bug queue as a markdown file in the format the
// bug-agent skill consumes (## Bug Report: BUG-XXXXXX + ```yaml frontmatter).
// Admin/super_admin only (enforced inside buildBugExport via requireRole).
//
// Query params:
//   ?module=<slug>        — only bugs in that feature module (default: all)
//   ?includeResolved=true — include resolved/closed (default: unresolved only)
// =============================================================================

import { NextResponse } from 'next/server'

import { buildBugExport } from '@/app/(app)/bug-reports/bug-dal'
import { AuthorizationError } from '@/lib/dal'

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const moduleParam = searchParams.get('module')
    const includeResolved = searchParams.get('includeResolved') === 'true'

    const { markdown, count, module } = await buildBugExport({
      module: moduleParam,
      includeResolved,
    })

    // Request-time date for the filename (Route Handlers run at request time).
    const date = new Date().toISOString().slice(0, 10)
    const filename = `bugs-${module}-${date}.md`

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Bug-Count': String(count),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/bug-reports/export]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
