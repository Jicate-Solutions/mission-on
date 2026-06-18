# Apply Mission ON DB Migrations — Hand-off Prompt

Paste the prompt below into a **fresh Claude Code session** (e.g. a new terminal tab) opened in
`D:\Github\mission-on`. It is self-contained — it carries the context a new session won't have
(apply order, the security rationale, what to verify), so it works standalone.

> **Why a separate prompt?** Each Claude session authenticates its own Supabase MCP client. If the
> new tab can't reach the existing auth, it will re-run the browser approve flow — that's expected.

---

## The prompt

```
Apply the Mission ON database migrations to the live Supabase project and verify them.

CONTEXT
- Repo: D:\Github\mission-on  (Next.js 16 + Supabase app, "Mission ON — Smart Choices").
- Supabase project ref: nczimxvcbhbpmvzwcago  (.mcp.json already configures the Supabase MCP server; .env.local has the keys).
- Four reviewed-but-never-executed migration files live in supabase/migrations/.
- This is a minor-safety app: the migrations encode RLS that guarantees a Learner never sees a Mentor's
  real name, a Coordinator never sees a school's classification, and admins only read confidential
  follow-through logs under an active safeguarding escalation. Do NOT weaken any RLS/policy to make SQL run.

STEP 1 — AUTH
- If the Supabase MCP tools aren't live, call mcp__supabase__authenticate, open the URL, approve, then
  paste the http://localhost:<port>/callback?code=... URL into mcp__supabase__complete_authentication.

STEP 2 — DRY RUN ON A BRANCH (preferred)
- List my projects/branches. If database branching is available on this project, create a dev branch
  (e.g. "mission-on-dryrun") and apply migrations THERE first. If branching isn't available, tell me and
  ask before touching the main database.

STEP 3 — APPLY IN THIS EXACT ORDER (functions before the policies that call them):
    0001_init.sql  ->  0003_functions.sql  ->  0002_rls.sql  ->  0004_seed.sql
- Apply each as its own migration. If any statement errors (this is the first real execution), READ the
  error, fix the SQL in the file at the root cause, and re-apply. Common things to watch:
  enum/type creation order, security-definer function ownership, REVOKE/GRANT column lists on
  questionnaire_responses, and the can_access_learner_identity() / has_open_escalation() helpers existing
  before 0002 references them.

STEP 4 — VERIFY THE GUARANTEES (run read-only SQL):
  a) RLS is enabled on every table (pg_tables / pg_class.relrowsecurity).
  b) `authenticated` has NO update grant on questionnaire_responses.computed_module_code /
     computed_a_code / computed_b_code / confidence (information_schema.column_privileges).
  c) The trigger trg_qresponses_classification_immutable exists.
  d) audit_logs has no INSERT/UPDATE/DELETE policy (append-only; writes only via write_audit_log()).
  e) Seed present: program_config row + questionnaire_template v1 with category-tagged questions.
- Report what passed/failed. Do not create any users yet — I'll do the runtime smoke test next.
```

---

## Apply order (quick reference)

| Order | File | Why |
|-------|------|-----|
| 1 | `0001_init.sql` | tables, enums, base triggers |
| 2 | `0003_functions.sql` | `can_access_learner_identity()`, `has_open_escalation()`, `write_audit_log()`, role helpers |
| 3 | `0002_rls.sql` | RLS policies + the classification-immutable trigger + column GRANT/REVOKE — **references the functions above** |
| 4 | `0004_seed.sql` | `program_config` + questionnaire template v1 |

## Post-apply verification checklist
- [ ] RLS enabled on every table
- [ ] `authenticated` cannot UPDATE the engine-computed classification columns (the Workflow-2 fix)
- [ ] `trg_qresponses_classification_immutable` trigger present
- [ ] `audit_logs` append-only (no write policy; only `write_audit_log()` SECURITY DEFINER)
- [ ] seed rows present

> Next step after a clean dry-run: the **runtime smoke test** — seed one user per role and walk every
> dashboard + the alias/safeguarding flows end-to-end.
