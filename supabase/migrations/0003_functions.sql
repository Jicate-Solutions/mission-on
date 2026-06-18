-- =============================================================================
-- Mission ON — Smart Choices
-- 0003_functions.sql — Helper functions, SECURITY DEFINER reveal gate, audit RPC.
-- APPLY BEFORE 0002_rls.sql: the RLS policies reference current_user_role(),
-- is_admin_role(), and can_access_learner_identity().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- current_user_role() — the caller's role from user_roles, or NULL if none.
-- SECURITY DEFINER so it can read user_roles regardless of the table's own RLS,
-- which avoids recursive policy evaluation. STABLE: one value per statement.
-- -----------------------------------------------------------------------------
create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid();
$$;

revoke all on function current_user_role() from public;
grant execute on function current_user_role() to authenticated;

-- Convenience: caller is admin or super_admin.
create or replace function is_admin_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid())
      in ('admin', 'super_admin'),
    false
  );
$$;

revoke all on function is_admin_role() from public;
grant execute on function is_admin_role() to authenticated;

-- Convenience: caller is super_admin.
create or replace function is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()) = 'super_admin',
    false
  );
$$;

revoke all on function is_super_admin() from public;
grant execute on function is_super_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- can_access_learner_identity(learner uuid) -> boolean
-- The reveal-on-safeguarding gate. A mentor may read a learner's REAL identity
-- (learner_profiles row) ONLY when there is an ACTIVE (open or acknowledged —
-- NOT resolved) safeguarding escalation on a follow_through_log that links
-- THIS calling mentor to THIS learner.
--
-- `learner` is a learner_profiles.id. SECURITY DEFINER so it can traverse
-- follow_through_logs / safeguarding_escalations whose own RLS would otherwise
-- hide the linking rows from the mentor.
-- -----------------------------------------------------------------------------
create or replace function can_access_learner_identity(learner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.follow_through_logs ftl
    join public.mentor_profiles mp
      on mp.id = ftl.mentor_id
     and mp.user_id = auth.uid()                 -- log belongs to the calling mentor
    join public.safeguarding_escalations se
      on se.follow_through_log_id = ftl.id
    where ftl.learner_id = learner
      and ftl.safeguarding_escalated = true
      and se.status in ('open', 'acknowledged')  -- active, NOT resolved
  );
$$;

revoke all on function can_access_learner_identity(uuid) from public;
grant execute on function can_access_learner_identity(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- has_open_escalation(log uuid) -> boolean
-- Used by follow_through_logs admin SELECT policy: admins see a log ONLY when it
-- is escalated AND an open/acknowledged escalation exists on it.
-- -----------------------------------------------------------------------------
create or replace function has_open_escalation(log uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.safeguarding_escalations se
    where se.follow_through_log_id = log
      and se.status in ('open', 'acknowledged')
  );
$$;

revoke all on function has_open_escalation(uuid) from public;
grant execute on function has_open_escalation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- classification_distance(a_demographic, a_behaviour) -> int
-- Optional reference helper for the DAL/divergence check. Returns the absolute
-- step distance between two Category A codes (A1=1, A2=2, A3=3). The PRD flags a
-- school when demographic and behavioural signals diverge by MORE THAN 1 step.
-- The authoritative scoring engine lives in the app DAL; this is convenience.
-- -----------------------------------------------------------------------------
create or replace function classification_distance(
  a_demographic category_a_code,
  a_behaviour   category_a_code
)
returns int
language sql
immutable
as $$
  select abs(
    case a_demographic when 'A1' then 1 when 'A2' then 2 when 'A3' then 3 end
    - case a_behaviour when 'A1' then 1 when 'A2' then 2 when 'A3' then 3 end
  );
$$;

-- -----------------------------------------------------------------------------
-- write_audit_log(...) — the ONLY way to write audit_logs. SECURITY DEFINER and
-- granted to service_role only. Clients (anon/authenticated) cannot call it, so
-- they cannot forge audit entries. The DAL invokes this via the service-role
-- (admin) Supabase client on the audit path.
-- -----------------------------------------------------------------------------
create or replace function write_audit_log(
  p_actor_id    uuid,
  p_action      text,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- Lock it down: only the service role may write audit entries.
revoke all on function write_audit_log(uuid, text, text, uuid, jsonb) from public;
revoke all on function write_audit_log(uuid, text, text, uuid, jsonb) from authenticated;
revoke all on function write_audit_log(uuid, text, text, uuid, jsonb) from anon;
grant execute on function write_audit_log(uuid, text, text, uuid, jsonb) to service_role;
