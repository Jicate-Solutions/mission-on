// Copy to your app as `lib/services/bug-reports/bug-report-service.ts`.
//
// Typed data-access for triage screens. Methods marked `admin = true` use a
// service-role client so triagers can read across all reporters; reporter-facing
// methods use the normal RLS-bound client.
//
// Requires `lib/supabase/client` exporting getSupabaseClient({ admin }). `admin`
// must select a SERVICE-ROLE client on the server only — never expose that key
// to the browser. For client components, call the API routes instead of this.

import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/utils/enhanced-logger';
import {
  BugReport,
  BugReportStatus,
  DetailedBugReport,
  BugReportMessage,
  BugReportParticipant,
  BugReportFilters,
} from '@/types/bugs';

export class BugReportService {
  private static client(admin = false) {
    return getSupabaseClient({ admin });
  }

  /** Single report with reporter identity, from the details view. */
  static async getBugReportById(reportId: string): Promise<DetailedBugReport | null> {
    const supabase = this.client(true);
    const { data, error } = await (supabase as any)
      .from('bug_reports_with_details')
      .select('*')
      .eq('id', reportId)
      .single();
    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      reporter: data.reporter_name
        ? { id: data.reporter_user_id, full_name: data.reporter_name, email: data.reporter_email }
        : null,
    };
  }

  /** The signed-in user's own reports (reporter view). */
  static async getMyBugReports(): Promise<BugReport[]> {
    const supabase = this.client();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await (supabase as any)
      .from('bug_reports')
      .select('*')
      .eq('reporter_user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Paginated triage list (admin). */
  static async getBugReports(filters: BugReportFilters): Promise<{ data: BugReport[]; count: number }> {
    const supabase = this.client(true);
    let query = (supabase as any).from('bug_reports_with_details').select('*', { count: 'exact' });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.reporter_user_id) query = query.eq('reporter_user_id', filters.reporter_user_id);
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    query = query.range((page - 1) * limit, page * limit - 1).order('created_at', { ascending: false });
    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data ?? [], count: count ?? 0 };
  }

  /** Advance triage status; stamps resolved_at on resolution. */
  static async updateBugReportStatus(reportId: string, status: BugReportStatus): Promise<BugReport> {
    const supabase = this.client(true);
    const update: Partial<BugReport> = { status };
    if (status === 'resolved') update.resolved_at = new Date().toISOString();
    const { data, error } = await (supabase as any)
      .from('bug_reports')
      .update(update)
      .eq('id', reportId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ---- Thread (chat) ----

  static async getBugReportMessages(reportId: string): Promise<BugReportMessage[]> {
    const supabase = this.client(true);
    const { data, error } = await (supabase as any)
      .from('bug_report_messages')
      .select('*, sender:profiles!sender_user_id (id, full_name, email, role)')
      .eq('bug_report_id', reportId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  static async sendBugReportMessage(payload: {
    bug_report_id: string;
    message_text: string;
    is_internal?: boolean;
    reply_to_message_id?: string;
  }): Promise<BugReportMessage> {
    const supabase = this.client();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User must be authenticated to send a message.');

    const { data, error } = await (supabase as any)
      .from('bug_report_messages')
      .insert({ ...payload, sender_user_id: user.id })
      .select('*, sender:profiles!sender_user_id (id, full_name, email, role)')
      .single();
    if (error) throw error;

    await this.addBugReportParticipant(payload.bug_report_id, user.id);
    return data;
  }

  // ---- Participants ----

  static async getBugReportParticipants(reportId: string): Promise<BugReportParticipant[]> {
    const supabase = this.client(true);
    const { data, error } = await (supabase as any)
      .from('bug_report_participants')
      .select('*, user:profiles!user_id (id, full_name, email, role)')
      .eq('bug_report_id', reportId)
      .eq('is_active', true);
    if (error) throw error;
    return data ?? [];
  }

  static async addBugReportParticipant(reportId: string, userId: string, role = 'participant'): Promise<void> {
    const supabase = this.client(true);
    const { data: existing } = await (supabase as any)
      .from('bug_report_participants')
      .select('id')
      .eq('bug_report_id', reportId)
      .eq('user_id', userId)
      .single();
    if (existing) return;
    const { error } = await (supabase as any).from('bug_report_participants').insert({
      bug_report_id: reportId,
      user_id: userId,
      role,
      can_view_internal: false,
      is_active: true,
      joined_at: new Date().toISOString(),
    });
    if (error) logger.warn('bug-reports', 'Could not add participant', error);
  }
}
