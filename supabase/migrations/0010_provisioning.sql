-- =============================================================================
-- Mission ON — Smart Choices
-- 0010_provisioning.sql — atomic identity provisioning (PRD §7.5, §7.6).
--
-- PROBLEM: assigning a user the 'mentor' / 'learner' role only wrote user_roles;
-- the mentor_profiles+mentor_public (and learner_profiles+learner_public) rows
-- that mentor browsing, selection, feedback and follow-through all FK to were
-- never created. So the mentoring core only worked on seed data.
--
-- These functions create the profile (REAL data) + public (ALIAS) rows in ONE
-- transaction, and are IDEMPOTENT: if the profile already exists they leave the
-- real data untouched, ensure the alias row exists, and (mentor) reactivate it.
-- The caller (service-role role-allocation action) supplies a candidate alias and
-- retries with a fresh one on a UNIQUE violation (the alias column is unique).
--
-- Restricted to service_role: provisioning is an admin operation invoked from the
-- server with the service-role client. Authenticated users cannot call these via
-- the PostgREST RPC endpoint.
-- =============================================================================

create or replace function provision_mentor_identity(
  p_user_id   uuid,
  p_real_name text,
  p_alias     text
) returns text
language plpgsql
set search_path = public as $$
declare
  v_profile_id uuid;
  v_alias      text;
begin
  select id into v_profile_id from mentor_profiles where user_id = p_user_id;

  if v_profile_id is null then
    insert into mentor_profiles (user_id, real_name)
      values (p_user_id, p_real_name)
      returning id into v_profile_id;
  end if;

  select alias into v_alias from mentor_public where mentor_profile_id = v_profile_id;

  if v_alias is null then
    insert into mentor_public (mentor_profile_id, alias)
      values (v_profile_id, p_alias)
      returning alias into v_alias;   -- raises 23505 on alias clash; caller retries
  else
    update mentor_public set is_active = true where mentor_profile_id = v_profile_id;
  end if;

  return v_alias;
end $$;

create or replace function provision_learner_identity(
  p_user_id   uuid,
  p_real_name text,
  p_alias     text
) returns text
language plpgsql
set search_path = public as $$
declare
  v_profile_id uuid;
  v_alias      text;
begin
  select id into v_profile_id from learner_profiles where user_id = p_user_id;

  if v_profile_id is null then
    insert into learner_profiles (user_id, real_name)
      values (p_user_id, p_real_name)
      returning id into v_profile_id;
  end if;

  select alias into v_alias from learner_public where learner_profile_id = v_profile_id;

  if v_alias is null then
    insert into learner_public (learner_profile_id, alias)
      values (v_profile_id, p_alias)
      returning alias into v_alias;   -- raises 23505 on alias clash; caller retries
  end if;

  return v_alias;
end $$;

revoke all on function provision_mentor_identity(uuid, text, text)  from public;
revoke all on function provision_learner_identity(uuid, text, text) from public;
grant execute on function provision_mentor_identity(uuid, text, text)  to service_role;
grant execute on function provision_learner_identity(uuid, text, text) to service_role;
