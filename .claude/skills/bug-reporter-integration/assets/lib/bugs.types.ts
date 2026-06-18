// Shared types for the bug capture + triage core.
// Copy to your app as `types/bugs.ts` (the assets here import it from '@/types/bugs').

export type BugReportStatus =
  | 'new'
  | 'seen'
  | 'in_progress'
  | 'resolved'
  | 'wont_fix';

export type BugReportCategory =
  | 'bug'
  | 'feature_request'
  | 'ui_design'
  | 'performance'
  | 'security'
  | 'other'
  | 'question';

export interface BugReport {
  id: string;
  display_id: string; // BUG-NNNNNN
  created_at: string;
  reporter_user_id: string;
  page_url: string;
  description: string;
  category?: BugReportCategory | null;
  status: BugReportStatus;
  screenshot_url?: string | null;
  attachment_urls?: string[] | null;
  console_logs?: any[] | null;
  metadata?: Record<string, any> | null;
  resolved_at?: string | null;
  similar_count?: number; // computed in the GET route, not stored
  // Optional org-routing columns — remove if you dropped them from the schema.
  module_name?: string | null;
  sub_module_name?: string | null;
  institution_id?: string | null;
  department_id?: string | null;
  // Joined from the bug_reports_with_details view.
  reporter?: {
    id: string;
    full_name: string | null;
    email: string | null;
    role?: string | null;
  } | null;
}

export interface DetailedBugReport extends BugReport {
  reporter: {
    id: string;
    full_name: string | null;
    email: string | null;
    role?: string | null;
  } | null;
}

export interface BugReportMessage {
  id: string;
  bug_report_id: string;
  sender_user_id: string;
  message_text: string;
  message_type?: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  is_internal?: boolean;
  reply_to_message_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean;
  sender?: {
    id: string;
    full_name: string | null;
    email: string | null;
    role?: string | null;
  } | null;
}

export interface BugReportParticipant {
  id: string;
  bug_report_id: string;
  user_id: string;
  role?: string;
  can_view_internal?: boolean;
  joined_at?: string | null;
  last_read_at?: string | null;
  is_active?: boolean;
  user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    role?: string | null;
  } | null;
}

export interface BugReportFilters {
  status?: BugReportStatus;
  category?: BugReportCategory;
  reporter_user_id?: string;
  module_name?: string;
  sub_module_name?: string;
  institution_id?: string;
  department_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}
