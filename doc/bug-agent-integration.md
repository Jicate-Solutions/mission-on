# Bug Agent Integration — Mission ON

This project's **bug-reports module** is wired to the `bug-agent` skill. Reporters
file bugs in-app; an admin exports them as the markdown the skill consumes; the
skill analyzes → validates → plans → (with human approval) fixes → marks resolved.

## What was added (migration `0008_bug_agent_integration.sql`)

- `bug_reports.display_id` — `BUG-000001` style, auto-assigned by a trigger off
  `bug_reports_display_seq` (the `authenticated` role has `USAGE` on the sequence).
- `bug_reports.module` / `sub_module` — feature area (reporter-tagged on the form).
- `bug_reports.severity` — `P0`..`P3`, admin-assigned during triage (CHECK-constrained).
- `bug_reports.console_logs` / `screenshot_url` / `similar_count` — Bug Agent inputs.
- `bug_reports.resolved_at` — set automatically when status flips to `resolved`.
- `bug_report_messages` — discussion/resolution thread the status-updater can post to
  (RLS: admins + the bug's reporter).

## How to run the Bug Agent

1. Sign in as **admin / super_admin** → open **/bug-reports**.
2. Click **⬇ Export for Bug Agent**. This hits `GET /api/bug-reports/export` and
   downloads `bugs-all-<date>.md`. Filters:
   - `?module=<slug>` — only that module (e.g. `?module=schools`).
   - `?includeResolved=true` — include resolved/closed (default: unresolved only).
3. Run the skill on the file: `run bug agent` and share the downloaded `.md`
   (or `@doc/…`), e.g. *"run bug agent on this export"*.
4. **Approve the plan** when prompted (the skill will NOT implement without an
   explicit `approved`).
5. The status-updater marks fixed bugs resolved via either:
   - `PATCH /api/bug-reports/[id]` body `{ "status": "resolved" }`, or
   - `UPDATE public.bug_reports SET status='resolved', resolved_at=now() WHERE id='…'`
     (the `resolved_at` trigger also sets the timestamp automatically).

## Mission ON module → codebase map

> The skill's built-in map is for MyJKKN. Use THIS map for mission-on. There is no
> `lib/services/` or `hooks/` layer — data access lives in route-group `_data`/`_lib`
> files and `lib/dal/*`, all server-only with auth re-verification + RLS.

| Module slug      | Pages (route group)                              | Data / actions                                            | API |
|------------------|--------------------------------------------------|-----------------------------------------------------------|-----|
| `schools`        | `app/(app)/{admin,super-admin,coordinator}/schools/` | `app/api/schools/_lib/{pipeline,actions}.ts`           | `app/api/schools/` |
| `questionnaires` | `app/(app)/{admin,super-admin,coordinator}/questionnaires/` | `app/(app)/admin/questionnaires/_data.ts`, `coordinator/questionnaires/_data.ts` | `app/api/questionnaires/` |
| `classification` | `app/(app)/{admin,super-admin}/classification/`  | `app/(app)/admin/classification/_data.ts`                 | — |
| `module-design`  | `app/(app)/{admin,super-admin}/modules/`, `mentor/modules/` | `app/(app)/admin/modules/_lib/{queries,actions}.ts`  | `app/api/modules/` |
| `mentors`        | `app/(app)/{admin,super-admin}/mentors/`, `mentor/profile/` | `app/(app)/admin/mentors/_lib/queries.ts`, `lib/dal/mentors.ts` | `app/api/mentors/` |
| `learners`       | `app/(app)/{admin,super-admin}/learners/`, `learner/`, `mentor/learners/` | `app/(app)/admin/learners/_data/directory.ts`, `lib/dal/learners.ts` | `app/api/learners/` |
| `follow-through` | `app/(app)/mentor/follow-through/`               | `app/(app)/mentor/follow-through/_data.ts`, `_actions.ts` | `app/api/follow-through/` |
| `safeguarding`   | `app/(app)/{admin,super-admin}/safeguarding/`    | (queue/detail views in folder)                            | `app/api/safeguarding/` |
| `feedback`       | `app/(app)/{learner,mentor,admin,super-admin}/feedback/` | `app/(app)/learner/feedback/feedback-dal.ts`         | `app/api/feedback/` |
| `anonymous-chat` | `app/(app)/anonymous-chat/`                      | `anon-dal.ts`                                             | `app/api/anonymous-chat/` |
| `roles`          | `app/(app)/{admin,super-admin}/roles/`           | `app/api/roles/` + folder `_lib`                          | `app/api/roles/` |
| `auth`           | `app/(auth)/{login,signup}/`, `proxy.ts`         | `lib/auth/actions.ts`, `lib/dal/session.ts`               | `app/auth/callback/` |
| `bug-reports`    | `app/(app)/bug-reports/`                          | `app/(app)/bug-reports/bug-dal.ts`                        | `app/api/bug-reports/` |

**Supabase (read for any module):** `supabase/migrations/0001_init.sql` (schema),
`0002_rls.sql` + `0007_rls_recursion_fix.sql` (policies), `0003_functions.sql`
(SECURITY DEFINER helpers), `0006_classification_split.sql` (classification/module
split). RLS helper functions: `current_user_role()`, `is_admin_role()`,
`is_super_admin()`, `can_access_learner_identity()`, `auth_owns_learner_public()`.

## Known mission-on error patterns (for the validator)

- `42P17: infinite recursion detected in policy` → an RLS policy used an inline
  cross-table `EXISTS`; fix with a `SECURITY DEFINER` helper (see `0007`). **P1.**
- Empty `{"message":""}` from a Supabase call after a schema change → PostgREST
  schema cache stale; `notify pgrst, 'reload schema'`. **P1.**
- A reused client component navigating to `/admin/*` under `/super-admin` → hardcoded
  `router.push`/`href`; parameterize with a `basePath` prop. **P2.**
