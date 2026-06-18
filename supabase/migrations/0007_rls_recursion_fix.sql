-- =============================================================================
-- Mission ON — Smart Choices
-- 0007_rls_recursion_fix.sql — Break RLS infinite recursion (Postgres 42P17).
--
-- BUG: the SELECT policies on learner_public, learner_mentor_assignments,
-- mentor_change_requests and feedback_responses used inline EXISTS subqueries
-- against each OTHER's RLS-protected tables. learner_public -> lma ->
-- learner_public formed a cycle, so any read of mentor_change_requests /
-- feedback_responses / learner_public aborted with:
--   42P17: infinite recursion detected in policy for relation "learner_public"
-- (Surfaced as an empty-message error in the app because the failing dashboard
-- query used a HEAD count, which has no response body.)
--
-- FIX: replace the cross-table EXISTS subqueries with SECURITY DEFINER helper
-- functions. A definer function bypasses RLS on its INNER lookup, so the policy
-- evaluation no longer re-enters another policy — breaking the cycle while
-- preserving identical access semantics. Same pattern as current_user_role().
--
-- VERIFIED post-apply by role impersonation: super_admin reads all four tables
-- (no recursion); learner sees own alias/assignment + mentor ALIASES but 0 rows
-- of mentor_profiles (real identity); mentor sees its assigned learner's alias.
-- =============================================================================

-- Does auth.uid() own this learner_public row (via learner_profiles)?
create or replace function auth_owns_learner_public(lpub uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.learner_public x
    join public.learner_profiles lp on lp.id = x.learner_profile_id
    where x.id = lpub and lp.user_id = auth.uid()
  );
$$;
revoke all on function auth_owns_learner_public(uuid) from public, anon;
grant execute on function auth_owns_learner_public(uuid) to authenticated;

-- Is auth.uid() the mentor behind this mentor_public row?
create or replace function auth_is_mentor_public(mpub uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mentor_public x
    join public.mentor_profiles mp on mp.id = x.mentor_profile_id
    where x.id = mpub and mp.user_id = auth.uid()
  );
$$;
revoke all on function auth_is_mentor_public(uuid) from public, anon;
grant execute on function auth_is_mentor_public(uuid) to authenticated;

-- Is auth.uid() the mentor actively assigned to this learner_public?
create or replace function auth_mentor_assigned_learner(lpub uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.learner_mentor_assignments lma
    join public.mentor_public mpub on mpub.id = lma.mentor_public_id
    join public.mentor_profiles mp on mp.id = mpub.mentor_profile_id
    where lma.learner_public_id = lpub and mp.user_id = auth.uid() and lma.status = 'active'
  );
$$;
revoke all on function auth_mentor_assigned_learner(uuid) from public, anon;
grant execute on function auth_mentor_assigned_learner(uuid) to authenticated;

-- learner_public
drop policy learner_public_select on learner_public;
create policy learner_public_select on learner_public for select to authenticated using (
  is_admin_role()
  or auth_owns_learner_public(id)
  or (current_user_role() = 'mentor' and auth_mentor_assigned_learner(id))
);
drop policy learner_public_self_update on learner_public;
create policy learner_public_self_update on learner_public for update to authenticated
  using (auth_owns_learner_public(id))
  with check (auth_owns_learner_public(id));

-- learner_mentor_assignments
drop policy lma_select on learner_mentor_assignments;
create policy lma_select on learner_mentor_assignments for select to authenticated using (
  is_admin_role()
  or auth_owns_learner_public(learner_public_id)
  or auth_is_mentor_public(mentor_public_id)
);
drop policy lma_learner_insert on learner_mentor_assignments;
create policy lma_learner_insert on learner_mentor_assignments for insert to authenticated with check (
  current_user_role() = 'learner' and auth_owns_learner_public(learner_public_id)
);

-- mentor_change_requests
drop policy mcr_select on mentor_change_requests;
create policy mcr_select on mentor_change_requests for select to authenticated using (
  is_admin_role() or auth_owns_learner_public(learner_public_id)
);
drop policy mcr_learner_insert on mentor_change_requests;
create policy mcr_learner_insert on mentor_change_requests for insert to authenticated with check (
  current_user_role() = 'learner' and status = 'open' and auth_owns_learner_public(learner_public_id)
);

-- feedback_responses
drop policy feedback_select on feedback_responses;
create policy feedback_select on feedback_responses for select to authenticated using (
  is_admin_role()
  or auth_owns_learner_public(learner_public_id)
  or (mentor_public_id is not null and auth_is_mentor_public(mentor_public_id))
);
drop policy feedback_learner_insert on feedback_responses;
create policy feedback_learner_insert on feedback_responses for insert to authenticated with check (
  current_user_role() = 'learner' and auth_owns_learner_public(learner_public_id)
);
