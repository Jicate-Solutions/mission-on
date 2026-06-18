-- =====================================================================
-- Bug Reporter Integration — capture + triage core schema
-- Target: Next.js + Supabase (Postgres + Storage)
--
-- Creates: bug_reports, bug_report_messages, bug_report_participants,
--          the bug_reports_with_details view, the BUG-NNNNNN display_id
--          sequence/trigger, and the bug-reports storage bucket.
--
-- Apply with: supabase migration new bug_reporter_schema  (paste this in)
--             then `supabase db push`  — OR run via mcp apply_migration.
--
-- Assumes a `public.profiles` table keyed by auth.users.id with
-- (id uuid, full_name text, email text, role text). If your app names this
-- differently, fix the references in the view + message/participant joins.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Core report table
-- ---------------------------------------------------------------------
create table if not exists public.bug_reports (
  id                uuid primary key default gen_random_uuid(),
  display_id        text unique,                       -- BUG-NNNNNN, set by trigger below
  created_at        timestamptz not null default now(),
  reporter_user_id  uuid not null references auth.users (id) on delete cascade,
  page_url          text not null,
  description       text not null,
  category          text not null default 'bug'
                      check (category in ('bug','feature_request','ui_design',
                                          'performance','security','other','question')),
  status            text not null default 'new'
                      check (status in ('new','seen','in_progress','resolved','wont_fix')),
  screenshot_url    text,
  attachment_urls   text[],                            -- additional images/docs
  console_logs      jsonb,                             -- captured browser logs
  metadata          jsonb,                             -- userAgent, viewport, log stats, etc.
  resolved_at       timestamptz,
  -- Optional triage routing — DROP these if your app has no org hierarchy.
  module_name       text,
  sub_module_name   text,
  institution_id    uuid,
  department_id     uuid
);

create index if not exists idx_bug_reports_reporter on public.bug_reports (reporter_user_id);
create index if not exists idx_bug_reports_status   on public.bug_reports (status);
create index if not exists idx_bug_reports_created  on public.bug_reports (created_at desc);

-- ---------------------------------------------------------------------
-- 2. display_id generation — SEQUENCE, never SELECT MAX()+1.
--    MAX()+1 had an ~87% failure rate under concurrent submits in prod.
--    A sequence is atomic and race-free.
-- ---------------------------------------------------------------------
create sequence if not exists bug_reports_display_id_seq start with 1 increment by 1;

create or replace function public.generate_bug_display_id()
returns text language plpgsql security invoker as $$
begin
  return 'BUG-' || lpad(nextval('bug_reports_display_id_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_bug_display_id()
returns trigger language plpgsql as $$
begin
  if new.display_id is null then
    new.display_id := generate_bug_display_id();
  end if;
  return new;
end;
$$;

drop trigger if exists set_bug_display_id on public.bug_reports;
create trigger set_bug_display_id
  before insert on public.bug_reports
  for each row execute function public.set_bug_display_id();

-- ---------------------------------------------------------------------
-- 3. Threaded conversation between reporter + triagers
-- ---------------------------------------------------------------------
create table if not exists public.bug_report_messages (
  id                  uuid primary key default gen_random_uuid(),
  bug_report_id       uuid not null references public.bug_reports (id) on delete cascade,
  sender_user_id      uuid not null references auth.users (id) on delete cascade,
  message_text        text not null,
  message_type        text default 'text',
  attachment_url      text,
  attachment_type     text,
  is_internal         boolean default false,           -- triager-only notes, hidden from reporter
  reply_to_message_id uuid references public.bug_report_messages (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz,
  edited_at           timestamptz,
  is_deleted          boolean default false
);
create index if not exists idx_bug_messages_report on public.bug_report_messages (bug_report_id);

-- ---------------------------------------------------------------------
-- 4. Who is on each report's thread (drives notifications + read receipts)
-- ---------------------------------------------------------------------
create table if not exists public.bug_report_participants (
  id               uuid primary key default gen_random_uuid(),
  bug_report_id    uuid not null references public.bug_reports (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text default 'participant',         -- 'reporter' | 'participant' | 'triager'
  can_view_internal boolean default false,
  joined_at        timestamptz default now(),
  last_read_at     timestamptz,
  is_active        boolean default true,
  unique (bug_report_id, user_id)
);
create index if not exists idx_bug_participants_report on public.bug_report_participants (bug_report_id);

-- ---------------------------------------------------------------------
-- 5. Denormalized read view — the admin/triage list + detail read FROM this,
--    so the client never has to join reporter identity itself.
--    Add institution/department joins back if you kept those columns.
-- ---------------------------------------------------------------------
create or replace view public.bug_reports_with_details as
select
  b.*,
  p.full_name as reporter_name,
  p.email     as reporter_email
from public.bug_reports b
left join public.profiles p on p.id = b.reporter_user_id;

-- ---------------------------------------------------------------------
-- 6. Storage bucket for screenshots + attachments.
--    Public bucket: the app stores getPublicUrl() values on the row.
--    allowed_mime_types is the server-side guard — keep it in sync with the
--    widget's accepted file types (see assets/components/bug-reporter-widget.tsx).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'bug-reports', 'bug-reports', true,
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
-- 7. ACCESS CONTROL — YOUR DECISION. See SKILL.md "Define access control".
--    RLS is enabled below; the policies are intentionally left for you to
--    author because "who may read/triage bug reports" is app-specific.
--    Until you add policies, only the service-role key can read/write.
-- ---------------------------------------------------------------------
alter table public.bug_reports            enable row level security;
alter table public.bug_report_messages    enable row level security;
alter table public.bug_report_participants enable row level security;

-- TODO(you): add policies. A common starting point:
--   * reporters can INSERT their own report and SELECT/comment on their own;
--   * triagers (some role/claim) can SELECT/UPDATE all.
-- create policy "reporter inserts own" on public.bug_reports
--   for insert to authenticated with check (reporter_user_id = auth.uid());
-- create policy "reporter reads own" on public.bug_reports
--   for select to authenticated using (reporter_user_id = auth.uid());
