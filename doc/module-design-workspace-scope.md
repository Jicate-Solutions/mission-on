# Module Design Workspace — Implementation Scope (PRD §7.4)

Status: scoped & decisions locked (2026-06-18). Not yet implemented.

## Goal
Complete PRD §7.4: an admin assembles, per session, a **delivery plan** (media/film,
demonstration, conversation framework, escalation pathway) + a **Learning Facilitator**,
and attaches a **mentor team to the session**. Assigned mentors can **view the delivery
brief** (§9.4) — but never the classification module code (§11).

## Decisions (locked)
1. **Mentor team = session-level** — new `session_mentors` join table (not the current
   school-level `mentor_school_allocations`).
2. **Learning Facilitator = free-text name** on `session_design` (facilitators are not
   app users in v1; not one of the 5 roles in §5).
3. **Delivery plan = typed columns** on `session_design` (1:1 with the PRD's named fields).

## Critical constraint — visibility split (§11)
A mentor may VIEW the design but must NOT see the school's classification. The module
*code* (e.g. A2-B2) **is** classification → stays admin-only. The delivery *brief*
(film/demo/framework/escalation/facilitator) must be mentor-visible. Therefore mentors
read the brief through a **security-definer view that OMITS `module_code`**, scoped to
their own sessions — exactly the `mentor_feedback_v` pattern from migration 0009.

## Schema — migration 0012
```sql
-- A. Delivery-plan fields on the admin-only session_design child.
alter table session_design
  add column if not exists media_film             text,
  add column if not exists demonstration          text,
  add column if not exists conversation_framework text,
  add column if not exists escalation_pathway     text,
  add column if not exists learning_facilitator   text,
  add column if not exists notes                  text;

-- B. Session-level mentor team. Admin-only RLS; mentors read via the brief view.
create table if not exists session_mentors (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references sessions(id) on delete cascade,
  mentor_profile_id uuid not null references mentor_profiles(id) on delete cascade,
  assigned_by       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (session_id, mentor_profile_id)
);
create index if not exists idx_session_mentors_session on session_mentors(session_id);
create index if not exists idx_session_mentors_mentor  on session_mentors(mentor_profile_id);
alter table session_mentors enable row level security;
create policy session_mentors_admin_all on session_mentors
  for all to authenticated using (is_admin_role()) with check (is_admin_role());

-- C. Mentor brief view — definer, self-scoped, OMITS module_code (classification).
create view session_brief_v with (security_invoker = false, security_barrier = true) as
  select s.id as session_id, s.school_id, sch.name as school_name,
         s.grade, s.session_date, s.start_time, s.status,
         sd.media_film, sd.demonstration, sd.conversation_framework,
         sd.escalation_pathway, sd.learning_facilitator, sd.notes
  from sessions s
  join schools sch on sch.id = s.school_id
  left join session_design sd on sd.session_id = s.id
  where exists (
    select 1 from session_mentors sm
    join mentor_profiles mp on mp.id = sm.mentor_profile_id
    where sm.session_id = s.id and mp.user_id = auth.uid()
  );
grant select on session_brief_v to authenticated;
-- Accepted lint: security_definer_view (intentional; same rationale as 0009).
```

## App-layer changes
Phase 1 — admin editor/view + schema:
- `_lib/types.ts` — `SessionDesignDetail` + `WorkspaceSession` gain the plan fields;
  rename mentor team source to session-level (`AssignedMentor` keyed off session_mentors).
- `_lib/queries.ts` — read plan fields; replace `mentorsForSchool` with
  `mentorsForSession` (join session_mentors → mentor_public, alias-only).
- `_lib/actions.ts` — `setSessionModuleDesign` also upserts the 6 plan fields;
  `assign/unassignMentorToSession` repointed to `session_mentors` (keyed by session, not school).
- `components/modules/session-design-form.tsx` — add the 4 brief fields + Learning
  Facilitator + notes textareas; `mentor-team-manager.tsx` now operates per session.

Phase 2 — mentor brief:
- `app/(app)/mentor/modules/_data.ts` + `page.tsx` — read `session_brief_v`; render the
  brief (film/demo/framework/escalation/facilitator). Module code stays hidden.

## RBAC
admin/super_admin edit; coordinator excluded; mentor = brief-only for own sessions;
learner none. Enforced at RLS + DAL (re-verify in every function), per house style.

## Verification (rolled-back DB tests, per house practice)
- Admin: reads code + brief; can assign/unassign session mentors.
- Mentor attached to session X: `session_brief_v` returns X's brief, **no module_code**,
  and **only** sessions they're attached to (not other sessions).
- Mentor NOT attached: sees nothing. Coordinator: no access to session_design/brief.

## Effort
Schema is small. Bulk is repointing mentor attachment school→session (queries/actions/
components) + the form fields + the mentor brief view/page. ~Medium; two shippable phases.
```
