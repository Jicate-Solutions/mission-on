-- =============================================================================
-- Mission ON — Smart Choices
-- 0006_classification_split.sql — Split the admin-only classification/design data
-- out of the coordinator-facing parent tables, and SUPERSEDE the two
-- SECURITY DEFINER column-hiding views.
-- APPLY AFTER 0005_hardening.sql.
-- =============================================================================
-- WHY:
--   0002 hid the admin-only classification columns from coordinators using two
--   column-restricted SECURITY DEFINER views (questionnaire_responses_coordinator,
--   sessions_coordinator) plus a BEFORE UPDATE immutability trigger and
--   column-level privilege gymnastics. The security advisor flagged both views as
--   ERROR security_definer_view (a view owned by a privileged role bypasses the
--   querying user's RLS).
--
--   This migration removes the need for those views entirely by relocating the
--   sensitive data into dedicated admin-only CHILD tables:
--     * questionnaire_classification  (computed_*/confirmed_*/divergence/confidence)
--     * session_design                (module_code)
--   The parent tables (questionnaire_responses, sessions) become classification-
--   /module-free, so coordinators can be granted a plain ROW-LEVEL SELECT on the
--   parents — no column-hiding view, no immutability trigger, no column-grant
--   gymnastics. The child tables carry admin/super_admin-only RLS; coordinators,
--   learners and mentors have NO access to them. The engine's auto-classify path
--   writes the child via the service_role client (bypasses RLS).
--
--   This SUPERSEDES the two SECURITY DEFINER views noted as the top follow-up in
--   0005_hardening.sql; after this migration those two advisor ERRORs are gone.
--
-- The live DB is empty of real data (only program_config + template v1 seed), so
-- the column drops require no backfill.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. questionnaire_classification — admin-only child of questionnaire_responses.
--    Holds the classification outputs that must never reach coordinators.
-- -----------------------------------------------------------------------------
create table questionnaire_classification (
  id                    uuid primary key default gen_random_uuid(),
  response_id           uuid not null unique references questionnaire_responses(id) on delete cascade,
  computed_a_code       category_a_code,
  computed_b_code       category_b_code,
  computed_module_code  module_code,
  confirmed_module_code module_code,
  divergence_flag       boolean not null default false,
  confidence            numeric(4,3),       -- 0.000..1.000
  confirmed_by          uuid references auth.users(id) on delete set null,
  confirmed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_qclass_response on questionnaire_classification(response_id);

create trigger trg_qclass_updated
  before update on questionnaire_classification
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- B. session_design — admin-only child of sessions. Holds the planning module
--    anchor (admin-designed) that must never reach coordinators.
-- -----------------------------------------------------------------------------
create table session_design (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null unique references sessions(id) on delete cascade,
  module_code module_code,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_session_design_session on session_design(session_id);

create trigger trg_session_design_updated
  before update on session_design
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- C. Tear down the now-obsolete classification guards on questionnaire_responses.
--    With the classification columns gone from the parent there is nothing left
--    to protect there, so the immutability trigger/function and the column-level
--    privilege customizations (which named the dropped columns) are removed.
-- -----------------------------------------------------------------------------
drop trigger if exists trg_qresponses_classification_immutable on questionnaire_responses;
drop function if exists enforce_qresponse_classification_immutable();

-- Reset the 0002 column-level privilege customizations (they named columns that
-- are about to be dropped). A clean blanket grant is re-applied in step G.
revoke insert on questionnaire_responses from authenticated;
revoke update on questionnaire_responses from authenticated;

-- The 0002 coordinator policies referenced the classification columns in their
-- predicates, so they depend on those columns. Recreate them WITHOUT the
-- classification predicates before dropping the columns. (A coordinator can no
-- longer set classification at all — there are no such columns on the parent.)
drop policy qresponses_coordinator_insert on questionnaire_responses;
create policy qresponses_coordinator_insert on questionnaire_responses
  for insert to authenticated
  with check (
    current_user_role() = 'coordinator'
    and exists (
      select 1 from schools s
      where s.id = questionnaire_responses.school_id
        and s.coordinator_id = auth.uid()
    )
  );

drop policy sessions_coordinator_write on sessions;
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
  );

-- Drop the 8 classification columns from the parent (moved to the child table).
alter table questionnaire_responses
  drop column computed_a_code,
  drop column computed_b_code,
  drop column computed_module_code,
  drop column confirmed_module_code,
  drop column divergence_flag,
  drop column confidence,
  drop column confirmed_by,
  drop column confirmed_at;

-- -----------------------------------------------------------------------------
-- D. sessions: drop module_code (moved to session_design).
-- -----------------------------------------------------------------------------
alter table sessions drop column module_code;

-- -----------------------------------------------------------------------------
-- E. Drop the two SECURITY DEFINER column-hiding views. The parents are now safe
--    to expose to coordinators at the row level, so these views are obsolete.
--    This clears the two advisor ERROR security_definer_view findings.
-- -----------------------------------------------------------------------------
drop view if exists questionnaire_responses_coordinator;
drop view if exists sessions_coordinator;

-- -----------------------------------------------------------------------------
-- F. RLS on the two new admin-only child tables.
--    questionnaire_classification: admin/super_admin FOR ALL only. NO coordinator,
--      learner or mentor access — the engine auto-classify path uses the
--      service_role client (bypasses RLS), so no extra policy is needed.
--    session_design: admin/super_admin FOR ALL only (admin-designed module anchor).
-- -----------------------------------------------------------------------------
alter table questionnaire_classification enable row level security;
create policy qclass_admin_all on questionnaire_classification
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

alter table session_design enable row level security;
create policy session_design_admin_all on session_design
  for all to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- -----------------------------------------------------------------------------
-- G. questionnaire_responses is now classification-free → grant coordinators a
--    plain row-level SELECT on the parent (replaces the dropped view). The
--    existing qresponses_admin_select/write and coordinator insert/update remain.
-- -----------------------------------------------------------------------------
create policy qresponses_coordinator_select on questionnaire_responses
  for select to authenticated
  using (
    current_user_role() = 'coordinator'
    and exists (
      select 1 from schools s
      where s.id = questionnaire_responses.school_id
        and s.coordinator_id = auth.uid()
    )
  );

-- No classification columns remain on the parent, so the 0002 column-grant
-- gymnastics are no longer needed. Re-grant a clean blanket INSERT/UPDATE to
-- `authenticated`; RLS still scopes which rows each caller may touch.
grant insert, update on questionnaire_responses to authenticated;

-- -----------------------------------------------------------------------------
-- H. sessions is now module-free → grant coordinators a plain row-level SELECT
--    on the parent (replaces the dropped sessions_coordinator view). The existing
--    sessions_admin_select/write, sessions_mentor_select and the recreated
--    sessions_coordinator_write remain.
-- -----------------------------------------------------------------------------
create policy sessions_coordinator_select on sessions
  for select to authenticated
  using (
    current_user_role() = 'coordinator'
    and exists (
      select 1 from schools s
      where s.id = sessions.school_id
        and s.coordinator_id = auth.uid()
    )
  );
