-- =============================================================================
-- Mission ON — Smart Choices
-- 0014_access_codes.sql — Access-code login (doc/update.md §2-4).
--
-- Every non-super-admin role (admin, coordinator, mentor, learner) now signs in
-- with a personal, permanent access code instead of email+password. The code IS
-- the person's Supabase Auth password under a system-generated synthetic email
-- (never shown to any client) — auth.uid(), every existing RLS policy, and
-- verifySession() all keep working completely unchanged; there is no parallel
-- session mechanism. This migration only adds the code -> user -> role lookup
-- table; account creation itself happens via the GoTrue Admin API (no SQL
-- function can create an auth.users row), orchestrated from
-- app/(app)/super-admin/access-codes/_lib/actions.ts.
--
-- Codes are SHOW-ONCE: code_hash is a one-way sha256 lookup hash (independent of
-- Supabase's own bcrypt hash of the same string as the account password) — the
-- plaintext is never stored here and is only ever returned once, at generation.
--
-- Access-code management is Super Admin-EXCLUSIVE (not shared with plain admin),
-- per doc/update.md's literal wording — mirrors user_roles_super_admin_write
-- exactly. Deliberately no self-select policy: a code holder never reads this
-- table, they hold the physical code.
-- =============================================================================

create type access_code_status as enum ('active', 'revoked');

create table if not exists access_codes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  role            user_role not null,
  display_name    text not null,
  school_id       uuid references schools(id) on delete set null,
  code_hash       text not null unique,
  synthetic_email text not null unique,
  status          access_code_status not null default 'active',
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users(id) on delete set null,
  last_used_at    timestamptz
);
create index if not exists idx_access_codes_status on access_codes(status);
create index if not exists idx_access_codes_role   on access_codes(role);

create trigger trg_access_codes_updated
  before update on access_codes
  for each row execute function set_updated_at();

alter table access_codes enable row level security;

-- Super admin only — no admin policy, no self-select policy (see header).
drop policy if exists access_codes_super_admin_all on access_codes;
create policy access_codes_super_admin_all on access_codes
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());
