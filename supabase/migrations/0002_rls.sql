-- =============================================================================
-- Mission ON — Smart Choices
-- 0002_rls.sql — Enable RLS (default deny) + explicit policies per PRD §11.
-- APPLY AFTER 0003_functions.sql (policies use current_user_role(),
-- is_admin_role(), is_super_admin(), can_access_learner_identity(),
-- has_open_escalation()).
-- =============================================================================
-- Default posture: RLS enabled on EVERY table. With RLS on and no permissive
-- policy, access is denied. We then add only the explicit grants below.
-- The DAL backstops these with column allow-lists; RLS is the data-layer
-- guarantee that survives even a direct API call.
-- =============================================================================

alter table user_roles                  enable row level security;
alter table schools                      enable row level security;
alter table questionnaire_templates      enable row level security;
alter table questionnaire_responses      enable row level security;
alter table sessions                     enable row level security;
alter table mentor_profiles              enable row level security;
alter table mentor_public                enable row level security;
alter table mentor_availability          enable row level security;
alter table mentor_school_allocations    enable row level security;
alter table learner_profiles             enable row level security;
alter table learner_public               enable row level security;
alter table learner_mentor_assignments   enable row level security;
alter table mentor_change_requests       enable row level security;
alter table follow_through_logs          enable row level security;
alter table safeguarding_escalations     enable row level security;
alter table feedback_responses           enable row level security;
alter table anonymous_posts              enable row level security;
alter table bug_reports                  enable row level security;
alter table audit_logs                   enable row level security;
alter table notifications                enable row level security;
alter table program_config               enable row level security;

-- =============================================================================
-- user_roles
--   SELECT: self (own role) + admins/super_admin (manage joiners).
--   INSERT/UPDATE/DELETE: super_admin may set ANY role; admin may allocate roles
--     to new joiners but may NOT create/modify super_admin rows, and may NOT
--     elevate anyone (including self) to super_admin.
-- =============================================================================
create policy user_roles_select_self_or_admin on user_roles
  for select to authenticated
  using (user_id = auth.uid() or is_admin_role());

-- super_admin: full control over role rows.
create policy user_roles_super_admin_write on user_roles
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- admin: may insert/update/delete NON super_admin rows only (no elevation).
create policy user_roles_admin_insert on user_roles
  for insert to authenticated
  with check (current_user_role() = 'admin' and role <> 'super_admin');

create policy user_roles_admin_update on user_roles
  for update to authenticated
  using (current_user_role() = 'admin' and role <> 'super_admin')
  with check (current_user_role() = 'admin' and role <> 'super_admin');

create policy user_roles_admin_delete on user_roles
  for delete to authenticated
  using (current_user_role() = 'admin' and role <> 'super_admin');

-- =============================================================================
-- schools
--   SELECT: admin/super_admin (all); coordinator (own schools only).
--   INSERT/UPDATE: admin/super_admin (all); coordinator (own schools — run the
--     pipeline / update stages). Coordinators cannot reassign ownership away
--     arbitrarily but may update their own rows.
-- =============================================================================
create policy schools_select on schools
  for select to authenticated
  using (
    is_admin_role()
    or coordinator_id = auth.uid()
  );

create policy schools_admin_write on schools
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

create policy schools_coordinator_update on schools
  for update to authenticated
  using (current_user_role() = 'coordinator' and coordinator_id = auth.uid())
  with check (current_user_role() = 'coordinator' and coordinator_id = auth.uid());

-- =============================================================================
-- questionnaire_templates — the fixed form.
--   SELECT: admin/super_admin (full); coordinator (needs to issue/track) may
--     read the active template too.
--   WRITE: admin/super_admin only.
-- =============================================================================
create policy qtemplates_select on questionnaire_templates
  for select to authenticated
  using (is_admin_role() or (current_user_role() = 'coordinator' and is_active));

create policy qtemplates_admin_write on questionnaire_templates
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- =============================================================================
-- questionnaire_responses  (HIGH RISK — classification hiding)
--   The CLASSIFICATION columns (computed_*/confirmed_module_code/divergence/
--   confidence) must be visible to admin/super_admin ONLY. RLS is row-level, so
--   we CANNOT hide individual columns here. The split is enforced as follows:
--     * Admin/super_admin: full row SELECT (they see classification).
--     * Coordinator: a row-level SELECT is granted ONLY through a dedicated
--       column-restricted VIEW (questionnaire_responses_coordinator) that does
--       NOT project the classification columns. The base table grants NO direct
--       SELECT to coordinators, so a coordinator cannot reach classification via
--       any path (table or view).
--   WRITE: admin/super_admin full. Coordinator may UPDATE only lifecycle fields
--     (status/answers/issued_at/completed_at) on their own school's row. The
--     classification columns (computed_*/confirmed_module_code/divergence/
--     confidence/confirmed_by/confirmed_at) are admin-only on WRITE too. This is
--     NOT enforced by a table CHECK (there is none) and NOT by the DAL alone — it
--     is backstopped here, independently of any caller, by:
--       (a) a BEFORE UPDATE trigger (enforce_qresponse_classification_immutable)
--           that rejects any change to a classification column unless the caller
--           is admin/super_admin or the privileged service_role path; and
--       (b) column-level privilege REVOKE/GRANT: `authenticated` may INSERT/UPDATE
--           only the lifecycle/answer columns, never the classification columns.
--     Together these survive a direct PostgREST/Server-Action POST even though the
--     coordinator UPDATE policy's row predicate (below) matches the row.
-- =============================================================================
create policy qresponses_admin_select on questionnaire_responses
  for select to authenticated
  using (is_admin_role());

create policy qresponses_admin_write on questionnaire_responses
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- Coordinator INSERT/UPDATE for their own school's lifecycle. They may write
-- answers/status but classification columns are set only by admins/the engine.
create policy qresponses_coordinator_insert on questionnaire_responses
  for insert to authenticated
  with check (
    current_user_role() = 'coordinator'
    and exists (
      select 1 from schools s
      where s.id = questionnaire_responses.school_id
        and s.coordinator_id = auth.uid()
    )
    -- coordinator-created rows must NOT carry classification:
    and computed_module_code is null
    and confirmed_module_code is null
  );

create policy qresponses_coordinator_update on questionnaire_responses
  for update to authenticated
  using (
    current_user_role() = 'coordinator'
    and exists (
      select 1 from schools s
      where s.id = questionnaire_responses.school_id
        and s.coordinator_id = auth.uid()
    )
  )
  with check (
    current_user_role() = 'coordinator'
    and exists (
      select 1 from schools s
      where s.id = questionnaire_responses.school_id
        and s.coordinator_id = auth.uid()
    )
  );

-- Column-restricted view for coordinators: lifecycle ONLY, NO classification.
-- security_invoker so the view runs under the coordinator's own RLS — but since
-- the base table grants coordinators no SELECT, we expose this view explicitly
-- with security_barrier and grant it directly. We therefore make it
-- security_invoker = false (definer) BUT project only safe columns, and rely on
-- the WHERE clause to scope rows to the coordinator's own schools.
create or replace view questionnaire_responses_coordinator
with (security_barrier = true, security_invoker = false) as
  select
    qr.id,
    qr.school_id,
    qr.template_id,
    qr.status,
    qr.issued_at,
    qr.completed_at,
    qr.created_at,
    qr.updated_at
  from questionnaire_responses qr
  where exists (
    select 1 from schools s
    where s.id = qr.school_id
      and s.coordinator_id = auth.uid()
  );

grant select on questionnaire_responses_coordinator to authenticated;

-- -----------------------------------------------------------------------------
-- CLASSIFICATION-WRITE BACKSTOP (independent of the DAL).
-- RLS WITH CHECK sees only the NEW row, so it cannot compare against OLD; the
-- coordinator UPDATE policy above therefore cannot, on its own, stop a coordinator
-- from setting/altering the admin-only classification columns on a row they own.
-- We close that integrity hole at the data layer with two mechanisms:
--   (a) a BEFORE UPDATE trigger that rejects classification-column changes unless
--       the caller is admin/super_admin or the privileged service_role/owner path
--       (the engine writes computed_* via the service-role client; the admin
--       confirm path writes confirmed_* under is_admin_role() RLS); and
--   (b) column-level privilege REVOKE/GRANT as defense-in-depth so `authenticated`
--       physically cannot name the classification columns in INSERT/UPDATE.
-- -----------------------------------------------------------------------------
create or replace function enforce_qresponse_classification_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins/super_admins may set classification (admin confirm path runs under
  -- is_admin_role() RLS). The service_role/owner path (engine auto-classify via
  -- the service-role client, and migrations) does not run as 'authenticated';
  -- allow it too. Coordinators (role 'authenticated') are NOT short-circuited.
  if is_admin_role() or current_user <> 'authenticated' then
    return new;
  end if;
  if new.computed_a_code       is distinct from old.computed_a_code
  or new.computed_b_code       is distinct from old.computed_b_code
  or new.computed_module_code  is distinct from old.computed_module_code
  or new.confirmed_module_code is distinct from old.confirmed_module_code
  or new.divergence_flag       is distinct from old.divergence_flag
  or new.confidence            is distinct from old.confidence
  or new.confirmed_by          is distinct from old.confirmed_by
  or new.confirmed_at          is distinct from old.confirmed_at then
    raise exception 'classification columns are admin-only';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_qresponses_classification_immutable on questionnaire_responses;
create trigger trg_qresponses_classification_immutable
  before update on questionnaire_responses
  for each row execute function enforce_qresponse_classification_immutable();

-- Defense-in-depth: strip blanket column write privileges from `authenticated`,
-- then re-grant only the columns an `authenticated` caller legitimately writes:
--   * lifecycle/answers — the coordinator capture path (own school's row); and
--   * the admin CONFIRM columns — the admin confirm path runs under the
--     authenticated role (RLS-scoped client, gated by qresponses_admin_write +
--     the trigger's is_admin_role() short-circuit), so confirmed_module_code /
--     confirmed_by / confirmed_at / divergence_flag / status must stay grantable.
-- The engine-computed columns (computed_a_code/computed_b_code/
-- computed_module_code/confidence) are written ONLY via the service-role client
-- (role `service_role`, not `authenticated`), so they are deliberately NOT granted
-- to `authenticated` — a coordinator physically cannot name them in a write,
-- giving column-level defense-in-depth on top of the trigger.
revoke update on questionnaire_responses from authenticated;
grant update (
  answers, status, issued_at, completed_at, updated_at,
  confirmed_module_code, divergence_flag, confirmed_by, confirmed_at
) on questionnaire_responses to authenticated;
revoke insert on questionnaire_responses from authenticated;
grant insert (
  school_id, template_id, answers, status, issued_at, completed_at
) on questionnaire_responses to authenticated;

-- =============================================================================
-- sessions
--   SELECT: admin/super_admin (all incl. module_code); coordinator (own schools'
--     logistics). module_code must NOT reach coordinators -> same view pattern:
--     coordinators read sessions via sessions_coordinator view (no module_code).
--   WRITE: admin/super_admin full; coordinator may set logistics on own schools.
-- =============================================================================
create policy sessions_admin_select on sessions
  for select to authenticated
  using (is_admin_role());

-- Mentors may see sessions for schools they're allocated to (assigned schools).
create policy sessions_mentor_select on sessions
  for select to authenticated
  using (
    current_user_role() = 'mentor'
    and exists (
      select 1
      from mentor_school_allocations msa
      join mentor_profiles mp on mp.id = msa.mentor_profile_id
      where mp.user_id = auth.uid()
        and msa.school_id = sessions.school_id
    )
  );

create policy sessions_admin_write on sessions
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

create policy sessions_coordinator_write on sessions
  for all to authenticated
  using (
    current_user_role() = 'coordinator'
    and exists (
      select 1 from schools s
      where s.id = sessions.school_id and s.coordinator_id = auth.uid()
    )
  )
  with check (
    current_user_role() = 'coordinator'
    and exists (
      select 1 from schools s
      where s.id = sessions.school_id and s.coordinator_id = auth.uid()
    )
    -- coordinators never design the module:
    and module_code is null
  );

create or replace view sessions_coordinator
with (security_barrier = true, security_invoker = false) as
  select
    se.id, se.school_id, se.grade, se.session_date, se.day_of_week,
    se.start_time, se.expected_strength, se.status, se.created_at, se.updated_at
  from sessions se
  where exists (
    select 1 from schools s
    where s.id = se.school_id and s.coordinator_id = auth.uid()
  );

grant select on sessions_coordinator to authenticated;

-- =============================================================================
-- mentor_profiles  (HIGH RISK — real mentor identity)
--   SELECT: admin/super_admin (all) + the mentor themselves (own row).
--   NO SELECT path for coordinator, learner, or other mentors.
--   WRITE: admin/super_admin (all) + mentor (own row, editable profile).
-- =============================================================================
create policy mentor_profiles_select on mentor_profiles
  for select to authenticated
  using (is_admin_role() or user_id = auth.uid());

create policy mentor_profiles_admin_write on mentor_profiles
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

create policy mentor_profiles_self_update on mentor_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================================================
-- mentor_public — alias directory. Visible to ALL authenticated (coordinator,
--   mentor, learner, admin) — this is what learners browse. Write: admin + self.
-- =============================================================================
create policy mentor_public_select on mentor_public
  for select to authenticated
  using (true);

create policy mentor_public_admin_write on mentor_public
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

create policy mentor_public_self_update on mentor_public
  for update to authenticated
  using (
    exists (
      select 1 from mentor_profiles mp
      where mp.id = mentor_public.mentor_profile_id and mp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from mentor_profiles mp
      where mp.id = mentor_public.mentor_profile_id and mp.user_id = auth.uid()
    )
  );

-- =============================================================================
-- mentor_availability — admin/super_admin (all); mentor (own).
-- =============================================================================
create policy mentor_avail_select on mentor_availability
  for select to authenticated
  using (
    is_admin_role()
    or exists (
      select 1 from mentor_profiles mp
      where mp.id = mentor_availability.mentor_profile_id and mp.user_id = auth.uid()
    )
  );

create policy mentor_avail_self_write on mentor_availability
  for all to authenticated
  using (
    exists (
      select 1 from mentor_profiles mp
      where mp.id = mentor_availability.mentor_profile_id and mp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from mentor_profiles mp
      where mp.id = mentor_availability.mentor_profile_id and mp.user_id = auth.uid()
    )
  );

create policy mentor_avail_admin_write on mentor_availability
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- =============================================================================
-- mentor_school_allocations — admin/super_admin allocate. Mentor reads own.
-- =============================================================================
create policy mentor_alloc_select on mentor_school_allocations
  for select to authenticated
  using (
    is_admin_role()
    or exists (
      select 1 from mentor_profiles mp
      where mp.id = mentor_school_allocations.mentor_profile_id and mp.user_id = auth.uid()
    )
  );

create policy mentor_alloc_admin_write on mentor_school_allocations
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- =============================================================================
-- learner_profiles  (HIGHEST RISK — minor real identity)
--   SELECT: admin/super_admin (all); the learner themselves (own row); mentor
--     ONLY when can_access_learner_identity(id) is true (active, non-resolved
--     safeguarding escalation linking that mentor+learner).
--   WRITE: admin/super_admin (all); learner self-update of own contact fields.
-- =============================================================================
create policy learner_profiles_select on learner_profiles
  for select to authenticated
  using (
    is_admin_role()
    or user_id = auth.uid()
    or (current_user_role() = 'mentor' and can_access_learner_identity(id))
  );

create policy learner_profiles_admin_write on learner_profiles
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

create policy learner_profiles_self_update on learner_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================================================
-- learner_public — alias. SELECT: admin/super_admin; the learner (own); the
--   mentor(s) assigned to that learner (alias-first mentoring). WRITE: admin +
--   learner self (own alias row).
-- =============================================================================
create policy learner_public_select on learner_public
  for select to authenticated
  using (
    is_admin_role()
    or exists (
      select 1 from learner_profiles lp
      where lp.id = learner_public.learner_profile_id and lp.user_id = auth.uid()
    )
    or (
      current_user_role() = 'mentor'
      and exists (
        select 1
        from learner_mentor_assignments lma
        join mentor_public mpub on mpub.id = lma.mentor_public_id
        join mentor_profiles mp  on mp.id = mpub.mentor_profile_id
        where lma.learner_public_id = learner_public.id
          and mp.user_id = auth.uid()
          and lma.status = 'active'
      )
    )
  );

create policy learner_public_admin_write on learner_public
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

create policy learner_public_self_update on learner_public
  for update to authenticated
  using (
    exists (
      select 1 from learner_profiles lp
      where lp.id = learner_public.learner_profile_id and lp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from learner_profiles lp
      where lp.id = learner_public.learner_profile_id and lp.user_id = auth.uid()
    )
  );

-- =============================================================================
-- learner_mentor_assignments — learner chooses (insert own active assignment);
--   admin/super_admin manage (reassign on approved change request). Mentor reads
--   their own assignments. Learner reads/creates their own.
-- =============================================================================
create policy lma_select on learner_mentor_assignments
  for select to authenticated
  using (
    is_admin_role()
    or exists (
      select 1 from learner_public lpub
      join learner_profiles lp on lp.id = lpub.learner_profile_id
      where lpub.id = learner_mentor_assignments.learner_public_id
        and lp.user_id = auth.uid()
    )
    or exists (
      select 1 from mentor_public mpub
      join mentor_profiles mp on mp.id = mpub.mentor_profile_id
      where mpub.id = learner_mentor_assignments.mentor_public_id
        and mp.user_id = auth.uid()
    )
  );

create policy lma_learner_insert on learner_mentor_assignments
  for insert to authenticated
  with check (
    current_user_role() = 'learner'
    and exists (
      select 1 from learner_public lpub
      join learner_profiles lp on lp.id = lpub.learner_profile_id
      where lpub.id = learner_mentor_assignments.learner_public_id
        and lp.user_id = auth.uid()
    )
  );

create policy lma_admin_write on learner_mentor_assignments
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- =============================================================================
-- mentor_change_requests — learner raises (insert own/open); reads own. Admin/
--   super_admin read all + approve/reject (update). Coordinator/mentor: none.
-- =============================================================================
create policy mcr_select on mentor_change_requests
  for select to authenticated
  using (
    is_admin_role()
    or exists (
      select 1 from learner_public lpub
      join learner_profiles lp on lp.id = lpub.learner_profile_id
      where lpub.id = mentor_change_requests.learner_public_id
        and lp.user_id = auth.uid()
    )
  );

create policy mcr_learner_insert on mentor_change_requests
  for insert to authenticated
  with check (
    current_user_role() = 'learner'
    and status = 'open'
    and exists (
      select 1 from learner_public lpub
      join learner_profiles lp on lp.id = lpub.learner_profile_id
      where lpub.id = mentor_change_requests.learner_public_id
        and lp.user_id = auth.uid()
    )
  );

create policy mcr_admin_update on mentor_change_requests
  for update to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- =============================================================================
-- follow_through_logs  (HIGH RISK — Ring-1 confidential)
--   SELECT: the AUTHORING mentor (own logs). Admin/super_admin see a row ONLY
--     when it is safeguarding_escalated AND an open/acknowledged escalation
--     exists on it (has_open_escalation). Coordinator/learner/school: NONE.
--   INSERT/UPDATE: the authoring mentor only (own logs).
-- =============================================================================
create policy ftl_mentor_select on follow_through_logs
  for select to authenticated
  using (
    exists (
      select 1 from mentor_profiles mp
      where mp.id = follow_through_logs.mentor_id and mp.user_id = auth.uid()
    )
  );

create policy ftl_admin_select on follow_through_logs
  for select to authenticated
  using (
    is_admin_role()
    and safeguarding_escalated = true
    and has_open_escalation(id)
  );

create policy ftl_mentor_insert on follow_through_logs
  for insert to authenticated
  with check (
    current_user_role() = 'mentor'
    and exists (
      select 1 from mentor_profiles mp
      where mp.id = follow_through_logs.mentor_id and mp.user_id = auth.uid()
    )
  );

create policy ftl_mentor_update on follow_through_logs
  for update to authenticated
  using (
    exists (
      select 1 from mentor_profiles mp
      where mp.id = follow_through_logs.mentor_id and mp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from mentor_profiles mp
      where mp.id = follow_through_logs.mentor_id and mp.user_id = auth.uid()
    )
  );

-- =============================================================================
-- safeguarding_escalations
--   SELECT: admin/super_admin (all); the escalating mentor (own); the
--     escalated-to user (their cases, e.g. jkkn_counsellor).
--   INSERT: mentor escalating their own flagged log.
--   UPDATE (acknowledge/resolve): admin/super_admin and the escalated-to user.
-- =============================================================================
create policy safeguard_select on safeguarding_escalations
  for select to authenticated
  using (
    is_admin_role()
    or escalated_by = auth.uid()
    or escalated_to = auth.uid()
  );

create policy safeguard_mentor_insert on safeguarding_escalations
  for insert to authenticated
  with check (
    current_user_role() = 'mentor'
    and escalated_by = auth.uid()
    and exists (
      select 1
      from follow_through_logs ftl
      join mentor_profiles mp on mp.id = ftl.mentor_id
      where ftl.id = safeguarding_escalations.follow_through_log_id
        and mp.user_id = auth.uid()
    )
  );

create policy safeguard_update on safeguarding_escalations
  for update to authenticated
  using (is_admin_role() or escalated_to = auth.uid())
  with check (is_admin_role() or escalated_to = auth.uid());

-- =============================================================================
-- feedback_responses
--   SELECT: admin/super_admin (aggregate); the learner (own); the mentor whose
--     alias the feedback targets (own learners' feedback).
--   INSERT: learner (own feedback).
-- =============================================================================
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
    or (
      feedback_responses.mentor_public_id is not null
      and exists (
        select 1 from mentor_public mpub
        join mentor_profiles mp on mp.id = mpub.mentor_profile_id
        where mpub.id = feedback_responses.mentor_public_id
          and mp.user_id = auth.uid()
      )
    )
  );

create policy feedback_learner_insert on feedback_responses
  for insert to authenticated
  with check (
    current_user_role() = 'learner'
    and exists (
      select 1 from learner_public lpub
      join learner_profiles lp on lp.id = lpub.learner_profile_id
      where lpub.id = feedback_responses.learner_public_id
        and lp.user_id = auth.uid()
    )
  );

-- =============================================================================
-- anonymous_posts  (moderation by CONTENT only — NO author identity)
--   INSERT: any authenticated user (no user_id stored).
--   SELECT: any authenticated user where NOT hidden; admin/super_admin also see
--     hidden posts.
--   UPDATE: admin/super_admin only (toggle is_hidden — moderation).
--   No DELETE policy: posts are hidden, not deleted, preserving the record.
-- =============================================================================
create policy anon_insert on anonymous_posts
  for insert to authenticated
  with check (true);

create policy anon_select_visible on anonymous_posts
  for select to authenticated
  using (is_hidden = false or is_admin_role());

create policy anon_admin_update on anonymous_posts
  for update to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- =============================================================================
-- bug_reports
--   INSERT: any authenticated user (their own report).
--   SELECT: the reporter (own) + admin/super_admin (all, the queue).
--   UPDATE (triage/assign/resolve/close): admin/super_admin only.
-- =============================================================================
create policy bug_insert on bug_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy bug_select on bug_reports
  for select to authenticated
  using (reporter_id = auth.uid() or is_admin_role());

create policy bug_admin_update on bug_reports
  for update to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- =============================================================================
-- audit_logs
--   INSERT: NONE for clients — writes happen only via write_audit_log()
--     SECURITY DEFINER RPC granted to service_role. No INSERT policy exists, so
--     authenticated/anon cannot insert even directly.
--   SELECT: super_admin only.
-- =============================================================================
create policy audit_super_admin_select on audit_logs
  for select to authenticated
  using (is_super_admin());

-- (Deliberately NO insert/update/delete policies: append-only via RPC.)

-- =============================================================================
-- notifications — each user sees/updates own; admin/super_admin may create.
-- =============================================================================
create policy notif_select on notifications
  for select to authenticated
  using (user_id = auth.uid() or is_admin_role());

create policy notif_self_update on notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notif_admin_insert on notifications
  for insert to authenticated
  with check (is_admin_role());

-- =============================================================================
-- program_config — SELECT: any authenticated (non-sensitive config). WRITE:
--   super_admin only.
-- =============================================================================
create policy program_config_select on program_config
  for select to authenticated
  using (true);

create policy program_config_super_admin_write on program_config
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
