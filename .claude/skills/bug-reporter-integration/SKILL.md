---
name: bug-reporter-integration
description: Port an in-app bug capture + triage system into a Next.js (App Router) + Supabase application. Adds a floating bug-reporter widget that auto-captures a screenshot (html2canvas) and console logs, a /api/bug-reports route, a typed BugReportService, the bug_reports/messages/participants schema with a BUG-NNNNNN display_id, a public Storage bucket, and triage screens. Use when the user wants to add bug reporting, in-app feedback, a "report a bug" / screenshot bug widget, an issue-capture flow, or a bug triage backend to a Next.js + Supabase app, or asks to reuse MyJKKN's bug reporter in another application. Capture + triage only — no leaderboard/gamification.
---

# Bug Reporter Integration

Drop a proven bug capture + triage core into another Next.js + Supabase app.
Reporters file a bug from any page (auto screenshot + console logs); triagers
list, filter, status-manage, and converse on reports.

## What this installs

- **Widget** — floating button → modal; html2canvas viewport screenshot,
  console-log capture, 3 categories (question / feature_request / bug), up to 5
  extra attachments.
- **API** — `POST/GET /api/bug-reports`: zod-validated create with retry,
  signed-URL (browser-direct) upload, and a filtered triage list with computed
  `similar_count`.
- **Service** — `BugReportService`: report read/list, status update, threaded
  messages, participants.
- **Schema** — `bug_reports`, `bug_report_messages`, `bug_report_participants`,
  the `bug_reports_with_details` view, a sequence-based `BUG-NNNNNN` id, and the
  `bug-reports` Storage bucket.

It does **not** include a leaderboard / points / rewards (out of scope).

## How to use this skill

1. **Read [references/architecture-and-gotchas.md](references/architecture-and-gotchas.md) first.**
   It explains the load-bearing decisions (the signed-URL handshake, the
   display_id sequence, the details view, similar_count) that break silently if
   mis-ported.
2. **Follow [references/porting-checklist.md](references/porting-checklist.md)**
   step by step: prerequisites → migration → copy assets → mount → RLS → triage
   UI → smoke test. It maps every `assets/` file to its destination path.
3. **Adapt to the target app** as you go — drop the optional org-routing columns
   if there's no institution/department hierarchy, and match the existing
   Supabase client + `profiles` table names.

## Assets (copy-paste-ready)

| File | Role |
|---|---|
| `assets/migrations/0001_bug_reporter_schema.sql` | Tables, view, sequence/trigger, bucket, RLS scaffold |
| `assets/lib/bugs.types.ts` | Shared TS types → `types/bugs.ts` |
| `assets/lib/file-converters.ts` | `dataURLtoFile` helper |
| `assets/lib/console-log-capture.ts` | Self-contained console capture + scoped logger |
| `assets/api/bug-reports.route.ts` | The API route |
| `assets/lib/bug-report-service.ts` | Typed triage data-access |
| `assets/components/bug-reporter-widget.tsx` | The reporter widget |

## Decision you must make: access control (RLS)

The migration enables Row Level Security but ships **no policies on purpose** —
"who may read and triage bug reports" is app-specific and a real security vs. UX
trade-off. Until you write policies, only the service-role key can touch the
tables (reporter-facing reads come back empty).

Decide and add policies for these questions:
- Can a reporter read **only their own** reports, or all of them?
- Who counts as a **triager** (a `profiles.role`, a JWT claim, a membership
  table)? Triagers need SELECT + UPDATE across all reports + messages.
- Should `is_internal` messages be invisible to reporters at the **DB** level
  (RLS), or just filtered in the UI? DB-level is safer.

Author these in the marked TODO block at the bottom of the migration, then
verify with a non-triager session that cross-reporter reads are denied. Do not
ship with RLS enabled and no policies (reporters see nothing) nor with RLS
disabled (everyone sees everything).

## Verify before calling it done

Run the smoke test in the porting checklist (§6): file a report, confirm the
row + `display_id`, confirm the screenshot object exists and its URL resolves,
list it as a triager, and resolve it to stamp `resolved_at`.
