-- =============================================================================
-- Mission ON — Smart Choices
-- 0001_init.sql — Enums, tables, indexes (NO RLS policies here; see 0002).
-- =============================================================================
-- Safeguarding-sensitive platform. End-users are minors. The TWO-TABLE identity
-- split (profiles vs public alias) is structural: RLS masks ROWS, not COLUMNS,
-- so real identity lives in a separate table that has its own, stricter policies.
-- Nothing in this file is auto-applied. See README.md for apply order.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------

create type user_role as enum (
  'super_admin',
  'admin',
  'coordinator',
  'mentor',
  'learner'
);

-- Optional sub-role flag carried on user_roles (e.g. a mentor who is also the
-- designated JKKN counsellor in the safeguarding workflow).
create type user_sub_role as enum (
  'jkkn_counsellor'
);

create type school_type as enum (
  'private',
  'government'
);

-- Fee bracket drives Category A demographic classification (A1/A2/A3).
--   A1 = private, fees above ₹1,00,000/yr  -> fee_above_1l
--   A2 = private, fees below ₹1,00,000/yr  -> fee_below_1l
--   A3 = government (fee bracket not applicable) -> govt
create type fee_bracket as enum (
  'fee_above_1l',
  'fee_below_1l',
  'govt'
);

-- Category A demographic codes.
create type category_a_code as enum ('A1', 'A2', 'A3');

-- Category B behaviour codes.
create type category_b_code as enum ('B1', 'B2', 'B3');

-- The nine intervention modules (3x3 matrix).
create type module_code as enum (
  'A1-B1', 'A1-B2', 'A1-B3',
  'A2-B1', 'A2-B2', 'A2-B3',
  'A3-B1', 'A3-B2', 'A3-B3'
);

-- Questionnaire question category tags (used inside the template jsonb but also
-- exposed as an enum for any typed helper that needs it).
create type question_category as enum (
  'A_demographic',
  'A_behaviour',
  'B'
);

-- Coordinator pipeline stages (PRD §9.3 / Appendix A).
create type pipeline_stage as enum (
  'approach',
  'questionnaire',
  'session_fixing',
  'delivery',
  'follow_up'
);

-- Per-stage statuses (superset across stages; the app constrains by stage).
create type school_status as enum (
  -- Approach
  'not_started', 'contacted', 'awaiting_response', 'declined', 'approved_to_proceed',
  -- Questionnaire
  'issued', 'partially_filled', 'completed', 'overdue',
  -- Session fixing
  'proposed', 'confirmed', 'rescheduled', 'cancelled',
  -- Delivery
  'scheduled', 'delivered', 'postponed',
  -- Follow-up
  'in_progress', 'completed_follow_up'
);

create type questionnaire_status as enum (
  'draft',
  'issued',
  'partially_filled',
  'completed',
  'confirmed'
);

create type session_status as enum (
  'proposed',
  'confirmed',
  'rescheduled',
  'cancelled',
  'scheduled',
  'delivered',
  'postponed'
);

create type mentor_change_status as enum (
  'open',
  'approved',
  'rejected'
);

create type learner_assignment_status as enum (
  'active',
  'pending_change',
  'reassigned',
  'ended'
);

create type escalation_status as enum (
  'open',
  'acknowledged',
  'resolved'
);

create type bug_status as enum (
  'open',
  'triaged',
  'assigned',
  'resolved',
  'closed'
);

create type notification_status as enum (
  'unread',
  'read'
);

-- -----------------------------------------------------------------------------
-- UTILITY: updated_at trigger
-- -----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- user_roles — maps auth.users -> role. The single source of truth for RBAC.
-- One active role per user (PK on user_id). school_id scopes a coordinator to
-- their owned schools. sub_role flags special capabilities (jkkn_counsellor).
-- -----------------------------------------------------------------------------
create table user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       user_role not null,
  school_id  uuid,                       -- nullable; FK added after schools exists
  sub_role   user_sub_role,              -- nullable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_user_roles_role on user_roles(role);
create index idx_user_roles_school on user_roles(school_id);

create trigger trg_user_roles_updated
  before update on user_roles
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- schools — pipeline entity. Coordinator owns it; classification lives in the
-- questionnaire_responses table (NOT here) so RLS can hide it from coordinators.
-- -----------------------------------------------------------------------------
create table schools (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  type            school_type not null,
  fee_bracket     fee_bracket not null,
  coordinator_id  uuid references auth.users(id) on delete set null,
  pipeline_stage  pipeline_stage not null default 'approach',
  status          school_status not null default 'not_started',
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_schools_coordinator on schools(coordinator_id);
create index idx_schools_stage on schools(pipeline_stage);

create trigger trg_schools_updated
  before update on schools
  for each row execute function set_updated_at();

-- Now that schools exists, wire the user_roles.school_id FK.
alter table user_roles
  add constraint fk_user_roles_school
  foreign key (school_id) references schools(id) on delete set null;

-- -----------------------------------------------------------------------------
-- questionnaire_templates — the fixed pre-session form (versioned).
-- `questions` jsonb is an array; each item carries: id, category
-- (A_demographic|A_behaviour|B), text, options[] with per-option weight and
-- (for behaviour) the code it nudges toward.
-- -----------------------------------------------------------------------------
create table questionnaire_templates (
  id          uuid primary key default gen_random_uuid(),
  version     int not null,
  title       text not null,
  questions   jsonb not null,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (version)
);

create trigger trg_qtemplates_updated
  before update on questionnaire_templates
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- questionnaire_responses — a school's answered form + the CLASSIFICATION.
-- computed_module_code / confirmed_module_code are Admin/Super-Admin ONLY.
-- A coordinator may own the row's lifecycle (issue/track completion) but RLS
-- (0002) returns a column-restricted view only — classification is never theirs.
-- -----------------------------------------------------------------------------
create table questionnaire_responses (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references schools(id) on delete cascade,
  template_id           uuid not null references questionnaire_templates(id),
  answers               jsonb not null default '{}'::jsonb,
  status                questionnaire_status not null default 'draft',
  -- Classification outputs (RESTRICTED to admin/super_admin):
  computed_a_code       category_a_code,
  computed_b_code       category_b_code,
  computed_module_code  module_code,
  confirmed_module_code module_code,
  divergence_flag       boolean not null default false,
  confidence            numeric(4,3),       -- 0.000..1.000
  confirmed_by          uuid references auth.users(id) on delete set null,
  confirmed_at          timestamptz,
  issued_at             timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (school_id, template_id)
);
create index idx_qresponses_school on questionnaire_responses(school_id);

create trigger trg_qresponses_updated
  before update on questionnaire_responses
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- sessions — scheduled awareness/delivery session for a school.
-- module_code here is the planning anchor (admin-designed); coordinators can
-- see logistics but RLS hides module_code from them via a restricted view.
-- -----------------------------------------------------------------------------
create table sessions (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references schools(id) on delete cascade,
  grade             text not null,
  session_date      date,
  day_of_week       text,
  start_time        time,
  expected_strength int,
  module_code       module_code,
  status            session_status not null default 'proposed',
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_sessions_school on sessions(school_id);

create trigger trg_sessions_updated
  before update on sessions
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- MENTOR identity split.
-- mentor_profiles  = REAL data (admin/super_admin + self only).
-- mentor_public    = alias data (all authenticated). Learners FK to THIS table.
-- -----------------------------------------------------------------------------
create table mentor_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  real_name   text not null,
  phone       text,
  college     text,
  course      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_mentor_profiles_user on mentor_profiles(user_id);

create trigger trg_mentor_profiles_updated
  before update on mentor_profiles
  for each row execute function set_updated_at();

create table mentor_public (
  id                 uuid primary key default gen_random_uuid(),
  mentor_profile_id  uuid not null unique references mentor_profiles(id) on delete cascade,
  alias              text not null unique,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_mentor_public_active on mentor_public(is_active);

create trigger trg_mentor_public_updated
  before update on mentor_public
  for each row execute function set_updated_at();

-- Mentor availability calendar (feeds allocation).
create table mentor_availability (
  id                 uuid primary key default gen_random_uuid(),
  mentor_profile_id  uuid not null references mentor_profiles(id) on delete cascade,
  available_date     date not null,
  start_time         time,
  end_time           time,
  created_at         timestamptz not null default now(),
  unique (mentor_profile_id, available_date, start_time)
);
create index idx_mentor_avail_profile on mentor_availability(mentor_profile_id);

-- Mentor -> school allocations (done by admins).
create table mentor_school_allocations (
  id                 uuid primary key default gen_random_uuid(),
  mentor_profile_id  uuid not null references mentor_profiles(id) on delete cascade,
  school_id          uuid not null references schools(id) on delete cascade,
  allocated_by       uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (mentor_profile_id, school_id)
);
create index idx_mentor_alloc_school on mentor_school_allocations(school_id);
create index idx_mentor_alloc_profile on mentor_school_allocations(mentor_profile_id);

-- -----------------------------------------------------------------------------
-- LEARNER identity split (minor data — highest sensitivity).
-- learner_profiles = REAL data (admin/super_admin always; mentor ONLY under an
--   active safeguarding escalation via can_access_learner_identity()).
-- learner_public   = alias data.
-- -----------------------------------------------------------------------------
create table learner_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  real_name       text not null,
  contact_number  text,
  school_id       uuid references schools(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_learner_profiles_user on learner_profiles(user_id);
create index idx_learner_profiles_school on learner_profiles(school_id);

create trigger trg_learner_profiles_updated
  before update on learner_profiles
  for each row execute function set_updated_at();

create table learner_public (
  id                  uuid primary key default gen_random_uuid(),
  learner_profile_id  uuid not null unique references learner_profiles(id) on delete cascade,
  alias               text not null unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_learner_public_updated
  before update on learner_public
  for each row execute function set_updated_at();

-- Learner -> Mentor assignment. Learner browses/chooses by alias, so the FK
-- targets mentor_public (alias table), NEVER mentor_profiles.
create table learner_mentor_assignments (
  id                uuid primary key default gen_random_uuid(),
  learner_public_id uuid not null references learner_public(id) on delete cascade,
  mentor_public_id  uuid not null references mentor_public(id) on delete cascade,
  status            learner_assignment_status not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_lma_learner on learner_mentor_assignments(learner_public_id);
create index idx_lma_mentor on learner_mentor_assignments(mentor_public_id);
-- At most one active assignment per learner.
create unique index uniq_active_assignment_per_learner
  on learner_mentor_assignments(learner_public_id)
  where status = 'active';

create trigger trg_lma_updated
  before update on learner_mentor_assignments
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- mentor_change_requests — learner raises; admin approves/rejects.
-- -----------------------------------------------------------------------------
create table mentor_change_requests (
  id                       uuid primary key default gen_random_uuid(),
  learner_public_id        uuid not null references learner_public(id) on delete cascade,
  current_mentor_public_id uuid references mentor_public(id) on delete set null,
  reason                   text,
  status                   mentor_change_status not null default 'open',
  resolved_by              uuid references auth.users(id) on delete set null,
  resolved_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index idx_mcr_learner on mentor_change_requests(learner_public_id);
create index idx_mcr_status on mentor_change_requests(status);

create trigger trg_mcr_updated
  before update on mentor_change_requests
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- follow_through_logs — Ring-1 confidential mentor notes (PRD §12).
-- Confidential to the authoring mentor. Admin/Super Admin can read a log ONLY
-- when it is safeguarding_escalated AND an open escalation exists (0002).
-- NOTE: learner_id references learner_profiles (real learner) because the
-- safeguarding reveal path is keyed on the real learner; school has NO path.
-- -----------------------------------------------------------------------------
create table follow_through_logs (
  id                    uuid primary key default gen_random_uuid(),
  learner_id            uuid not null references learner_profiles(id) on delete cascade,
  mentor_id             uuid not null references mentor_profiles(id) on delete cascade,
  notes                 text,
  flags                 text[] not null default '{}',
  safeguarding_escalated boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_ftl_mentor on follow_through_logs(mentor_id);
create index idx_ftl_learner on follow_through_logs(learner_id);
create index idx_ftl_escalated on follow_through_logs(safeguarding_escalated)
  where safeguarding_escalated = true;

create trigger trg_ftl_updated
  before update on follow_through_logs
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- safeguarding_escalations — controlled escalation path (PRD §12).
-- Links a flagged follow-through log to the safeguarding lead. While status is
-- 'open' or 'acknowledged' (i.e. NOT resolved), it authorises the escalated-to
-- mentor (and admins) to read the learner's real identity.
-- -----------------------------------------------------------------------------
create table safeguarding_escalations (
  id                    uuid primary key default gen_random_uuid(),
  follow_through_log_id uuid not null references follow_through_logs(id) on delete cascade,
  escalated_by          uuid not null references auth.users(id) on delete set null,
  escalated_to          uuid references auth.users(id) on delete set null,
  reason                text not null,
  status                escalation_status not null default 'open',
  audit_notes           text,
  acknowledged_at       timestamptz,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_safeguard_log on safeguarding_escalations(follow_through_log_id);
create index idx_safeguard_status on safeguarding_escalations(status);

create trigger trg_safeguard_updated
  before update on safeguarding_escalations
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- feedback_responses — learner feedback/assessment. Mentor sees own learners'.
-- -----------------------------------------------------------------------------
create table feedback_responses (
  id                uuid primary key default gen_random_uuid(),
  learner_public_id uuid not null references learner_public(id) on delete cascade,
  session_id        uuid references sessions(id) on delete set null,
  mentor_public_id  uuid references mentor_public(id) on delete set null,
  responses         jsonb not null default '{}'::jsonb,
  is_anonymous      boolean not null default false,
  created_at        timestamptz not null default now()
);
create index idx_feedback_learner on feedback_responses(learner_public_id);
create index idx_feedback_mentor on feedback_responses(mentor_public_id);

-- -----------------------------------------------------------------------------
-- anonymous_posts — NO user_id, ever. Moderation is by CONTENT only.
-- session_token_hash is a one-way, peppered hash of the session user id, used
-- ONLY to rate-limit how many posts one poster can create in a window. It is NOT
-- an identity: it cannot be reversed to a user (see anon-dal.ts deriveSessionHash).
-- Posts are never deleted, only hidden — there is no DELETE policy.
-- -----------------------------------------------------------------------------
create table anonymous_posts (
  id                 uuid primary key default gen_random_uuid(),
  body               text not null,
  session_token_hash text,           -- one-way hash; NOT an identity
  is_hidden          boolean not null default false,
  hidden_by          uuid references auth.users(id) on delete set null,
  hidden_at          timestamptz,
  created_at         timestamptz not null default now()
);
create index idx_anon_hidden on anonymous_posts(is_hidden);
create index idx_anon_created on anonymous_posts(created_at desc);

-- -----------------------------------------------------------------------------
-- bug_reports — any role raises; admin/super_admin triage->resolve->close.
-- -----------------------------------------------------------------------------
create table bug_reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references auth.users(id) on delete cascade,
  reporter_role user_role not null,
  description   text not null,
  status        bug_status not null default 'open',
  assignee_id   uuid references auth.users(id) on delete set null,
  resolution    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_bug_reporter on bug_reports(reporter_id);
create index idx_bug_status on bug_reports(status);

create trigger trg_bug_updated
  before update on bug_reports
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- audit_logs — append-only. Written ONLY via write_audit_log() SECURITY DEFINER
-- RPC (service role). SELECT only super_admin (0002). Clients cannot forge.
-- -----------------------------------------------------------------------------
create table audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  action       text not null,           -- e.g. 'classification.read', 'role.change', 'safeguarding.escalate'
  entity_type  text,
  entity_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index idx_audit_actor on audit_logs(actor_id);
create index idx_audit_action on audit_logs(action);
create index idx_audit_created on audit_logs(created_at desc);

-- -----------------------------------------------------------------------------
-- notifications — role-appropriate alerts.
-- -----------------------------------------------------------------------------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  status      notification_status not null default 'unread',
  created_at  timestamptz not null default now()
);
create index idx_notif_user on notifications(user_id, status);

-- -----------------------------------------------------------------------------
-- program_config — single-row program-wide settings (consent model, retention,
-- safeguarding contacts/timelines, active questionnaire version, etc.).
-- -----------------------------------------------------------------------------
create table program_config (
  id                       int primary key default 1,
  program_name             text not null default 'Mission ON — Smart Choices',
  active_template_version  int,
  fee_threshold_inr        int not null default 100000,
  follow_up_window_days    int not null default 10,
  data_retention_days      int,
  safeguarding_contacts    jsonb not null default '[]'::jsonb,
  settings                 jsonb not null default '{}'::jsonb,
  updated_at               timestamptz not null default now(),
  constraint program_config_singleton check (id = 1)
);

create trigger trg_program_config_updated
  before update on program_config
  for each row execute function set_updated_at();
