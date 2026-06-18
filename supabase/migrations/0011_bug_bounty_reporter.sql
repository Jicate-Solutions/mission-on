-- =============================================================================
-- Mission ON — Smart Choices
-- 0011_bug_bounty_reporter.sql — In-app "Bug Bounty" reporter (capture + triage).
--
-- Ported from the bug-reporter-integration skill, but NAMESPACED as bounty_* so
-- it sits ALONGSIDE the existing Bug Agent system (bug_reports /
-- bug_report_messages from 0008) WITHOUT colliding on table names, the
-- set_bug_display_id() function, or the bug_reports_display_seq sequence.
--
-- IDENTITY MODEL (why this differs from the skill's reference schema):
--   This app has NO public.profiles table and deliberately splits real identity
--   behind guarded tables (mentor_profiles / learner_profiles) for safeguarding.
--   So we do NOT join reporter names/emails. We store reporter_user_id plus
--   reporter_role (captured SERVER-SIDE from the verified session, never from
--   client input) and the triage view exposes only the role. "Triager" =
--   admin/super_admin via the existing is_admin_role() SECURITY DEFINER helper
--   (0003_functions.sql) — the same test the bug_reports policies use.
--
-- Sequence note (mirrors 0008): the display-id trigger runs as the INVOKING role
-- (authenticated), so authenticated needs USAGE on the sequence or inserts fail
-- with "permission denied for sequence".
-- =============================================================================

-- ---------------------------------------------------------------------
-- 1. Core report table
-- ---------------------------------------------------------------------
create table if not exists public.bounty_reports (
  id                uuid primary key default gen_random_uuid(),
  display_id        text unique,                          -- BB-NNNNNN, set by trigger
  created_at        timestamptz not null default now(),
  reporter_user_id  uuid not null references auth.users (id) on delete cascade,
  reporter_role     text not null,                        -- captured from verified session
  page_url          text not null,
  description       text not null,
  category          text not null default 'bug'
                      check (category in ('bug','feature_request','question')),
  status            text not null default 'new'
                      check (status in ('new','seen','in_progress','resolved','wont_fix')),
  screenshot_url    text,
  attachment_urls   text[],
  console_logs      jsonb,
  metadata          jsonb,
  resolved_at       timestamptz
);

create index if not exists idx_bounty_reports_reporter on public.bounty_reports (reporter_user_id);
create index if not exists idx_bounty_reports_status   on public.bounty_reports (status);
create index if not exists idx_bounty_reports_created  on public.bounty_reports (created_at desc);

-- ---------------------------------------------------------------------
-- 2. display_id (BB-NNNNNN) — atomic SEQUENCE, never SELECT MAX()+1.
-- ---------------------------------------------------------------------
create sequence if not exists public.bounty_report_display_seq;
grant usage, select on sequence public.bounty_report_display_seq to authenticated;

create or replace function public.set_bounty_display_id()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.display_id is null then
    new.display_id := 'BB-' || lpad(nextval('public.bounty_report_display_seq')::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_bounty_display_id on public.bounty_reports;
create trigger trg_bounty_display_id before insert on public.bounty_reports
  for each row execute function public.set_bounty_display_id();

-- Stamp resolved_at when a triager moves a report to 'resolved'.
create or replace function public.set_bounty_resolved_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'resolved' and (old.status is distinct from 'resolved') then
    new.resolved_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_bounty_resolved_at on public.bounty_reports;
create trigger trg_bounty_resolved_at before update on public.bounty_reports
  for each row execute function public.set_bounty_resolved_at();

-- ---------------------------------------------------------------------
-- 3. Threaded conversation (reporter + triagers). is_internal = triager-only.
-- ---------------------------------------------------------------------
create table if not exists public.bounty_report_messages (
  id               uuid primary key default gen_random_uuid(),
  bounty_report_id uuid not null references public.bounty_reports (id) on delete cascade,
  sender_user_id   uuid references auth.users (id) on delete set null,
  message_text     text not null,
  is_internal      boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists idx_bounty_msg_report on public.bounty_report_messages (bounty_report_id);

-- ---------------------------------------------------------------------
-- 4. Participants on each report's thread.
-- ---------------------------------------------------------------------
create table if not exists public.bounty_report_participants (
  id               uuid primary key default gen_random_uuid(),
  bounty_report_id uuid not null references public.bounty_reports (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null default 'participant',   -- 'reporter' | 'participant' | 'triager'
  joined_at        timestamptz not null default now(),
  unique (bounty_report_id, user_id)
);
create index if not exists idx_bounty_part_report on public.bounty_report_participants (bounty_report_id);

-- ---------------------------------------------------------------------
-- 5. Triage read view. security_invoker = true so the querying user's RLS
--    applies THROUGH the view (a default Supabase view would bypass RLS and
--    leak every report to any reporter). No PII is joined — role lives on the
--    row already.
-- ---------------------------------------------------------------------
create or replace view public.bounty_reports_with_details
  with (security_invoker = true) as
select b.*
from public.bounty_reports b;

-- ---------------------------------------------------------------------
-- 6. Storage bucket for screenshots + attachments (public read; the row stores
--    getPublicUrl() values). allowed_mime_types is the server-side guard — keep
--    it in sync with the widget's accepted types.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'bug-bounty', 'bug-bounty', true,
  array[
    'image/png','image/jpeg','image/jpg','image/gif','image/webp','image/svg+xml',
    'application/pdf','text/csv','text/plain','application/json',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update set allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
--    Reporter: insert + read OWN reports. Triager (is_admin_role): read all +
--    update (triage). is_internal thread notes are hidden from reporters at the
--    DB level (not just the UI) — the safer default for a safeguarding app.
-- ---------------------------------------------------------------------
alter table public.bounty_reports            enable row level security;
alter table public.bounty_report_messages    enable row level security;
alter table public.bounty_report_participants enable row level security;

-- reports ----------------------------------------------------------------
drop policy if exists bounty_reports_insert_own on public.bounty_reports;
create policy bounty_reports_insert_own on public.bounty_reports
  for insert to authenticated
  with check (reporter_user_id = auth.uid());

drop policy if exists bounty_reports_select on public.bounty_reports;
create policy bounty_reports_select on public.bounty_reports
  for select to authenticated
  using (reporter_user_id = auth.uid() or is_admin_role());

drop policy if exists bounty_reports_admin_update on public.bounty_reports;
create policy bounty_reports_admin_update on public.bounty_reports
  for update to authenticated
  using (is_admin_role())
  with check (is_admin_role());

-- messages ---------------------------------------------------------------
drop policy if exists bounty_msg_select on public.bounty_report_messages;
create policy bounty_msg_select on public.bounty_report_messages
  for select to authenticated
  using (
    is_admin_role()
    or (
      is_internal = false
      and exists (
        select 1 from public.bounty_reports b
        where b.id = bounty_report_messages.bounty_report_id
          and b.reporter_user_id = auth.uid()
      )
    )
  );

drop policy if exists bounty_msg_insert on public.bounty_report_messages;
create policy bounty_msg_insert on public.bounty_report_messages
  for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and (
      is_admin_role()
      or (
        is_internal = false
        and exists (
          select 1 from public.bounty_reports b
          where b.id = bounty_report_messages.bounty_report_id
            and b.reporter_user_id = auth.uid()
        )
      )
    )
  );

-- participants -----------------------------------------------------------
drop policy if exists bounty_part_select on public.bounty_report_participants;
create policy bounty_part_select on public.bounty_report_participants
  for select to authenticated
  using (user_id = auth.uid() or is_admin_role());

drop policy if exists bounty_part_insert on public.bounty_report_participants;
create policy bounty_part_insert on public.bounty_report_participants
  for insert to authenticated
  with check (user_id = auth.uid() or is_admin_role());

-- storage: any authenticated user may upload into the bug-bounty bucket (the
-- browser-direct signed-URL upload path). Public read is served by the public
-- bucket, so no SELECT policy is required.
drop policy if exists bounty_storage_insert on storage.objects;
create policy bounty_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bug-bounty');
