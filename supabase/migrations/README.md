# Mission ON — Database Migrations

Versioned SQL for the Mission ON Postgres/Supabase backend. **Nothing here is
auto-applied.** These are migration *files* only — no migration in this folder is
ever run against the live database automatically by this repo. Apply them
deliberately (Supabase SQL editor, `supabase db push`, or your migration runner)
against a target you control.

> Project ref: `nczimxvcbhbpmvzwcago`. Do **not** apply to the live DB unless that
> is explicitly your intent.

## Apply order (IMPORTANT — not strictly numeric)

The RLS policies in `0002` depend on the helper functions in `0003`. Apply in
this order:

1. `0001_init.sql` — extensions, enums, tables, indexes, `updated_at` triggers.
2. `0003_functions.sql` — `current_user_role()`, `is_admin_role()`,
   `is_super_admin()`, `can_access_learner_identity()`, `has_open_escalation()`,
   `classification_distance()`, and the `write_audit_log()` audit RPC.
   **Run this before `0002`** — the policies reference these functions.
3. `0002_rls.sql` — enables RLS (default deny) on every table and adds the
   explicit policies implementing the PRD §11 matrix, plus the column-restricted
   coordinator views (`questionnaire_responses_coordinator`, `sessions_coordinator`).
4. `0004_seed.sql` — `program_config` singleton + questionnaire template v1.
   Idempotent (`on conflict`).

If you run a tool that applies files in filename order, apply `0003` manually
first, or temporarily renumber — the functions must exist before the policies.

## Security model recap

- **Two-table identity split.** Real identity lives in `mentor_profiles` /
  `learner_profiles`; aliases in `mentor_public` / `learner_public`. RLS masks
  rows, not columns, so the split is structural. Learner FKs point at
  `mentor_public` (alias) only.
- **Reveal-on-safeguarding.** A mentor reads a learner's real identity only when
  `can_access_learner_identity()` returns true (active, non-resolved escalation
  linking that mentor + learner).
- **Classification hiding.** Coordinators reach `questionnaire_responses` and
  `sessions` only through column-restricted views that omit the module
  classification; the base tables grant them no direct SELECT to classification.
- **Audit append-only.** `audit_logs` has no client INSERT policy; entries are
  written solely through the `write_audit_log()` SECURITY DEFINER RPC, which is
  granted to `service_role` only. SELECT is `super_admin` only.
- **Anonymous chat.** `anonymous_posts` stores no `user_id`. Moderation is by
  content (`is_hidden`) only.

RLS is the data-layer backstop. The application DAL (`lib/dal/*`) is the primary
enforcement point with allow-listed DTO columns; RLS guarantees safety even
against a direct API call that bypasses the DAL.
