-- =============================================================================
-- Mission ON — Smart Choices
-- 0009_feedback_anon_hardening.sql — make feedback anonymity real at the DATA
-- layer, not just in the application DTO (PRD §7.8 anonymity_flag, §12, §13/§14).
--
-- PROBLEM: RLS is ROW-level, not column-level. The feedback_select policy let a
-- mentor read whole feedback rows targeting their alias — including
-- learner_public_id — even when is_anonymous = true. A mentor could then join
-- learner_public to recover the submitter's alias, de-anonymizing "anonymous"
-- feedback via a direct API call (exactly what §14 forbids for minor data).
--
-- FIX: mentors no longer read the base table at all. They read a SECURITY
-- DEFINER view that (a) self-restricts to feedback targeting the caller's own
-- mentor alias, and (b) NEVER projects learner_public_id — it exposes the learner
-- alias ONLY for non-anonymous rows and NULL otherwise. The mentor branch is
-- removed from the base-table feedback_select policy so learner_public_id is
-- unreachable by a mentor even via raw queries.
--
-- ACCEPTED LINT (intentional, mirrors 0005's documented exceptions):
--   * ERROR security_definer_view on public.mentor_feedback_v — REQUIRED. The
--     view MUST run as its owner (postgres) to bypass the base-table RLS we
--     tightened above; row scoping is enforced by the embedded auth.uid()
--     predicate, and the projection omits learner_public_id, so no caller can
--     read more than their own feedback or recover an anonymous submitter. This
--     is the standard Postgres mechanism for hiding a single column from a role
--     (RLS is row-level only). A SECURITY DEFINER function would downgrade this
--     to WARN with identical behaviour if the ERROR-level lint is undesirable.
-- =============================================================================

-- 1) Remove the mentor branch from the base-table SELECT policy. Admins keep the
--    aggregate path; a learner keeps their own-row self-view. Mentors now read
--    ONLY through mentor_feedback_v (below).
drop policy if exists feedback_select on feedback_responses;
create policy feedback_select on feedback_responses
  for select to authenticated
  using (
    is_admin_role()
    or exists (
      select 1 from learner_public lpub
      join learner_profiles lp on lp.id = lpub.learner_profile_id
      where lpub.id = feedback_responses.learner_public_id
        and lp.user_id = auth.uid()
    )
  );

-- 2) Mentor-facing read. security_invoker = false => the view runs with the
--    owner's privileges (bypassing the base-table RLS we just tightened), so the
--    embedded auth.uid() predicate is the ONLY thing that scopes rows to the
--    calling mentor. security_barrier = true blocks leaky predicate pushdown.
--    The projection deliberately OMITS learner_public_id; learner_alias is NULL
--    for anonymous rows.
drop view if exists mentor_feedback_v;
create view mentor_feedback_v
  with (security_invoker = false, security_barrier = true) as
  select
    fr.id,
    fr.responses,
    fr.is_anonymous,
    fr.created_at,
    fr.mentor_public_id,
    case when fr.is_anonymous then null else lpub.alias end as learner_alias
  from feedback_responses fr
  join learner_public lpub on lpub.id = fr.learner_public_id
  where exists (
    select 1
    from mentor_public mpub
    join mentor_profiles mp on mp.id = mpub.mentor_profile_id
    where mpub.id = fr.mentor_public_id
      and mp.user_id = auth.uid()
  );

grant select on mentor_feedback_v to authenticated;
