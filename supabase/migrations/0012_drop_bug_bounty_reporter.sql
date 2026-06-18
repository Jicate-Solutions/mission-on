-- =============================================================================
-- Mission ON — Smart Choices
-- 0012_drop_bug_bounty_reporter.sql — REVERTS 0011.
--
-- The self-hosted Bug Bounty reporter (bounty_* tables + /bug-bounty UI) was
-- superseded by the CENTRALIZED JKKN Bug Reporter SDK
-- (@boobalan_jkkn/bug-reporter-sdk), which posts reports directly to the
-- external Bug Boundary platform. So this app no longer stores bug reports
-- itself — these objects are removed. The existing Bug Agent system
-- (bug_reports, from 0008) is UNRELATED and left intact.
-- =============================================================================

-- Tables (CASCADE drops their indexes, triggers, policies, and the FK children).
drop view if exists public.bounty_reports_with_details;
drop table if exists public.bounty_report_messages   cascade;
drop table if exists public.bounty_report_participants cascade;
drop table if exists public.bounty_reports            cascade;

-- Standalone sequence + trigger functions.
drop sequence if exists public.bounty_report_display_seq;
drop function if exists public.set_bounty_display_id();
drop function if exists public.set_bounty_resolved_at();

-- Storage: drop the upload policy here. The 'bug-bounty' bucket itself CANNOT be
-- removed via SQL (Supabase's storage.protect_delete trigger blocks it) — it is
-- deleted out-of-band via the Storage API (it is empty; no uploads occurred).
drop policy if exists bounty_storage_insert on storage.objects;
