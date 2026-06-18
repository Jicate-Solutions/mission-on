-- =============================================================================
-- Mission ON — Smart Choices
-- 0012_module_design_workspace.sql — complete the Module Design Workspace
-- (PRD §7.4). Adds the delivery-plan fields, a SESSION-level mentor team, and a
-- mentor-facing brief view that exposes the plan WITHOUT the classification code.
--
-- Visibility split (§11): the module CODE is classification (admin-only). The
-- delivery BRIEF (film/demo/framework/escalation/facilitator) must reach assigned
-- mentors. session_brief_v is a security-definer view (same pattern as 0009's
-- mentor_feedback_v) that self-scopes to the caller's sessions and OMITS
-- module_code.
-- =============================================================================

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
drop policy if exists session_mentors_admin_all on session_mentors;
create policy session_mentors_admin_all on session_mentors
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- C. Mentor brief view — definer, self-scoped, OMITS module_code (classification).
--    ACCEPTED LINT: security_definer_view (intentional; same rationale as 0009 —
--    the view MUST run as owner to bypass base RLS, and is scoped by auth.uid()).
drop view if exists session_brief_v;
create view session_brief_v
  with (security_invoker = false, security_barrier = true) as
  select
    s.id            as session_id,
    s.school_id,
    sch.name        as school_name,
    s.grade,
    s.session_date,
    s.start_time,
    s.status,
    sd.media_film,
    sd.demonstration,
    sd.conversation_framework,
    sd.escalation_pathway,
    sd.learning_facilitator,
    sd.notes
  from sessions s
  join schools sch on sch.id = s.school_id
  left join session_design sd on sd.session_id = s.id
  where exists (
    select 1
    from session_mentors sm
    join mentor_profiles mp on mp.id = sm.mentor_profile_id
    where sm.session_id = s.id
      and mp.user_id = auth.uid()
  );

grant select on session_brief_v to authenticated;
