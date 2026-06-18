-- =============================================================================
-- Mission ON — Smart Choices
-- 0005_hardening.sql — Security-advisor hardening (applied after 0004).
-- Source: `supabase db advisors` (security) run against the live project on the
-- first apply. Clears the anon-execution + mutable-search_path WARNs and locks
-- the classification trigger function out of the RPC surface.
--
-- NOT fixed here (deliberate — requires a coordinated schema + DAL refactor that
-- must go through the build/review loop, tracked as the top follow-up):
--   * ERROR security_definer_view on questionnaire_responses_coordinator and
--     sessions_coordinator. Proper fix = split the 8 classification columns out
--     of questionnaire_responses into an admin-only child table so coordinators
--     can be granted a row-level SELECT on the parent (no column-hiding view
--     needed), then recreate the views with security_invoker = true (or drop
--     them). The views are referenced by app/api/schools/_lib/pipeline.ts,
--     app/(app)/coordinator/questionnaires/_data.ts,
--     app/api/schools/[schoolId]/sessions/route.ts, and types/database.ts.
--
-- Accepted (by design, not defects):
--   * WARN rls_policy_always_true on anonymous_posts.anon_insert — true anonymity
--     requires unrestricted INSERT with no author identity.
--   * WARN authenticated_security_definer_function_executable on the RLS helper
--     functions (current_user_role/is_admin_role/is_super_admin/
--     can_access_learner_identity/has_open_escalation) — RLS policies call these,
--     so `authenticated` must retain EXECUTE; each returns only facts about the
--     calling user, leaking nothing.
-- =============================================================================

-- Pin search_path on the two functions the linter flagged.
alter function classification_distance(category_a_code, category_a_code) set search_path = public;
alter function set_updated_at() set search_path = public;

-- The classification-immutable trigger function is invoked ONLY by its trigger;
-- it should never be an RPC endpoint. Remove all EXECUTE grants.
revoke all on function enforce_qresponse_classification_immutable() from public;
revoke all on function enforce_qresponse_classification_immutable() from anon;
revoke all on function enforce_qresponse_classification_immutable() from authenticated;

-- All RLS policies are `to authenticated`; anon never needs these helpers.
revoke execute on function current_user_role() from anon;
revoke execute on function is_admin_role() from anon;
revoke execute on function is_super_admin() from anon;
revoke execute on function can_access_learner_identity(uuid) from anon;
revoke execute on function has_open_escalation(uuid) from anon;
revoke execute on function classification_distance(category_a_code, category_a_code) from anon;
