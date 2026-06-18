# Porting Checklist

Step-by-step to install the capture + triage core into a Next.js (App Router) +
Supabase app. Assets referenced below live in this skill's `assets/` folder.

## 0. Prerequisites in the target app

These must already exist (the standard @supabase/ssr setup). The assets import
them — create thin shims if your names differ.

| Import path | What it must export |
|---|---|
| `@/lib/supabase/server` | `createServerSupabaseClient()` — cookie-bound SSR server client (used by the API route) |
| `@/lib/supabase/client` | `createClientSupabaseClient()` — browser client; and `getSupabaseClient({ admin })` returning a service-role client when `admin` (server-only, used by the service) |
| `@/components/ui/*` | shadcn/ui `button`, `textarea`, `card`, `tooltip` (+ `badge` if you re-add marketing UI) |
| `public.profiles` table | `(id uuid, full_name text, email text, role text)` keyed to `auth.users.id` |

npm deps: `html2canvas`, `react-hot-toast`, `lucide-react`, `zod`,
`@supabase/ssr`, `@supabase/supabase-js`.

## 1. Database + storage

Apply `assets/migrations/0001_bug_reporter_schema.sql`:
- `supabase migration new bug_reporter_schema`, paste, `supabase db push`; or
- run it via the Supabase MCP `apply_migration` tool; or
- paste into the SQL editor.

Then edit the migration's `profiles` references if your identity table differs,
and DROP the `institution_id`/`department_id`/`module_name`/`sub_module_name`
columns + the matching lines in the route/service if your app has no org tree.

Confirm the bucket: `select name, public, allowed_mime_types from storage.buckets where name = 'bug-reports';`

## 2. Copy the files

| Asset | Destination in target app |
|---|---|
| `assets/lib/bugs.types.ts` | `types/bugs.ts` |
| `assets/lib/file-converters.ts` | `lib/utils/file-converters.ts` |
| `assets/lib/console-log-capture.ts` | `lib/utils/enhanced-logger.ts` |
| `assets/api/bug-reports.route.ts` | `app/api/bug-reports/route.ts` |
| `assets/lib/bug-report-service.ts` | `lib/services/bug-reports/bug-report-service.ts` |
| `assets/components/bug-reporter-widget.tsx` | `components/bug-reporter/bug-reporter-widget.tsx` |

If you already have a logger, keep your own and just ensure the
`(scope, message, data?)` signature + `initializeLogCapture` / `getLogManager`
surface the widget uses (see the console-log-capture asset for the contract).

## 3. Mount the widget

In the **authenticated** layout (not the root layout):

```tsx
import { BugReporterWidget } from '@/components/bug-reporter/bug-reporter-widget';
// ...inside the layout's returned JSX, once:
<BugReporterWidget key="bug-reporter" />
```

## 4. Define access control (RLS)

The migration enables RLS with no policies — see SKILL.md → "Define access
control". Write the policies that match your app before reporters can read their
own reports and triagers can read all.

## 5. Triage UI (not bundled — build from the service)

The skill ships the data layer, not the triage screens (they are ordinary
consumers and vary by design system). Build three thin pages:

- **Admin list** (`app/.../bug-reports/page.tsx`): fetch
  `GET /api/bug-reports?status=&category=&search=&page=` and render a table.
  Show `display_id`, `category`, `status`, `reporter.full_name`, `created_at`,
  and `similar_count` ("+N similar").
- **Admin detail** (`.../bug-reports/[id]/page.tsx`): `getBugReportById`, show
  screenshot + `attachment_urls` + `console_logs`, a status `<select>` wired to
  `updateBugReportStatus`, and the thread via `getBugReportMessages` /
  `sendBugReportMessage` (`is_internal: true` for triager-only notes).
- **My reports** (`.../my-bug-reports/page.tsx`): `getMyBugReports` + the same
  thread component without internal messages.

## 6. Smoke test

1. Sign in, click 🐛, confirm a screenshot auto-captures.
2. Submit a bug; verify a `bug_reports` row with `display_id` like `BUG-000001`.
3. Verify `screenshot_url` resolves (object exists in the `bug-reports` bucket).
4. Hit `GET /api/bug-reports` as a triager; confirm the row appears with
   `reporter` populated.
5. Update status to `resolved`; confirm `resolved_at` is stamped.
