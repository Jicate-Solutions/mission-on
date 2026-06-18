-- =============================================================================
-- Mission ON — Smart Choices
-- 0008_bug_agent_integration.sql — Bug Agent pipeline integration (PRD §7.10).
--
-- Adds the metadata the Bug Agent skill's exported-markdown format requires
-- (display_id BUG-XXXXXX, module/sub_module, severity, console_logs,
-- screenshot_url, similar_count, resolved_at), an auto display-id sequence +
-- trigger, an auto resolved_at trigger, and a bug_report_messages thread the
-- skill's status-updater can post resolution notes to.
--
-- Sequence note: the display-id trigger runs as the INVOKING role
-- (authenticated), so authenticated needs USAGE on the sequence or inserts fail
-- with "permission denied for sequence".
-- =============================================================================

alter table bug_reports
  add column if not exists display_id     text unique,
  add column if not exists module         text,
  add column if not exists sub_module     text,
  add column if not exists severity       text,
  add column if not exists console_logs   text,
  add column if not exists screenshot_url text,
  add column if not exists similar_count  int not null default 1,
  add column if not exists resolved_at    timestamptz;

alter table bug_reports drop constraint if exists bug_severity_chk;
alter table bug_reports add constraint bug_severity_chk
  check (severity is null or severity in ('P0','P1','P2','P3'));

create sequence if not exists bug_reports_display_seq;
grant usage, select on sequence bug_reports_display_seq to authenticated;

create or replace function set_bug_display_id()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.display_id is null then
    new.display_id := 'BUG-' || lpad(nextval('public.bug_reports_display_seq')::text, 6, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_bug_display_id on bug_reports;
create trigger trg_bug_display_id before insert on bug_reports
  for each row execute function set_bug_display_id();

create or replace function set_bug_resolved_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'resolved' and (old.status is distinct from 'resolved') then
    new.resolved_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_bug_resolved_at on bug_reports;
create trigger trg_bug_resolved_at before update on bug_reports
  for each row execute function set_bug_resolved_at();

update bug_reports
set display_id = 'BUG-' || lpad(nextval('public.bug_reports_display_seq')::text, 6, '0')
where display_id is null;

create table if not exists bug_report_messages (
  id             uuid primary key default gen_random_uuid(),
  bug_report_id  uuid not null references bug_reports(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  message_text   text not null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_bug_msg_report on bug_report_messages(bug_report_id);
alter table bug_report_messages enable row level security;

drop policy if exists bug_msg_select on bug_report_messages;
create policy bug_msg_select on bug_report_messages for select to authenticated using (
  is_admin_role()
  or exists (select 1 from bug_reports b where b.id = bug_report_messages.bug_report_id and b.reporter_id = auth.uid())
);
drop policy if exists bug_msg_insert on bug_report_messages;
create policy bug_msg_insert on bug_report_messages for insert to authenticated with check (
  sender_user_id = auth.uid()
  and (is_admin_role() or exists (select 1 from bug_reports b where b.id = bug_report_messages.bug_report_id and b.reporter_id = auth.uid()))
);
