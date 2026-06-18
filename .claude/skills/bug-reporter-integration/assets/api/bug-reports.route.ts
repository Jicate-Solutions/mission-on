// Copy to your app as `app/api/bug-reports/route.ts`.
//
// Two endpoints:
//   POST -> create a report, then return SIGNED UPLOAD URLs so the browser
//           uploads screenshots DIRECTLY to Storage (never through this body).
//           This avoids server-side ECONNRESET / Vercel's 4.5MB body limit on
//           large binary writes.
//   GET  -> filtered, paginated triage list read from bug_reports_with_details,
//           with a computed `similar_count` (reports sharing a console-error
//           signature are grouped).
//
// Requires: `lib/supabase/server` exporting createServerSupabaseClient() — the
// standard @supabase/ssr cookie-bound server client.

export const dynamic = 'force-dynamic';

import { NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/enhanced-logger';

const BUG_REPORTS_BUCKET = 'bug-reports';

// Normalize a console error into a stable signature for dedup. Strips dynamic
// parts (UUIDs, line:col, hex addresses) so near-identical errors group.
function extractErrorSignature(consoleLogs: any[] | null): string | null {
  if (!Array.isArray(consoleLogs) || consoleLogs.length === 0) return null;
  for (const log of consoleLogs) {
    const level = log.level ?? log.type ?? '';
    if (!['error', 'Error'].includes(level)) continue;
    const msg: string =
      typeof log.message === 'string' ? log.message : JSON.stringify(log.message ?? '');
    const normalized = msg
      .split('\n')[0]
      .replace(/\b[0-9a-f]{8}-[0-9a-f-]+\b/gi, 'UUID')
      .replace(/:\d+:\d+/g, ':L:C')
      .replace(/0x[0-9a-f]+/gi, '0xADDR')
      .trim()
      .slice(0, 200);
    if (normalized.length > 10) return normalized;
  }
  return null;
}

const createReportSchema = z.object({
  page_url: z.string().url({ message: 'A valid page URL is required.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters long.' }),
  category: z
    .enum(['bug', 'feature_request', 'ui_design', 'performance', 'security', 'other', 'question'])
    .optional()
    .default('bug'),
  // Screenshots are uploaded browser-direct via signed URLs, NOT in this body.
  wants_screenshot: z.boolean().optional().default(false),
  screenshot_format: z.enum(['jpg', 'png']).optional().default('jpg'),
  additional_image_count: z.number().int().min(0).max(5).optional().default(0),
  additional_image_formats: z.array(z.enum(['jpg', 'png'])).max(5).optional().default([]),
  console_logs: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  log_summary: z.any().optional(),
});

export async function POST(request: Request) {
  await connection();
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed', errorCode: 'NO_USER' },
        { status: 401 }
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', errorCode: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    let data: z.infer<typeof createReportSchema>;
    try {
      data = createReportSchema.parse(json);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: e.errors.map((x) => x.message).join(', '),
            errorCode: 'VALIDATION_ERROR',
          },
          { status: 400 }
        );
      }
      throw e;
    }

    // OPTIONAL org routing — delete this block if you dropped institution/department.
    let institutionId: string | null = null;
    let departmentId: string | null = null;
    {
      const { data: profile } = await supabase
        .from('profiles')
        .select('institution_id, department_id')
        .eq('id', user.id)
        .single();
      if (profile) {
        institutionId = (profile as any).institution_id ?? null;
        departmentId = (profile as any).department_id ?? null;
      }
    }

    const initialReport = {
      reporter_user_id: user.id,
      page_url: data.page_url,
      description: data.description,
      category: data.category,
      console_logs: data.console_logs,
      metadata: data.metadata,
      institution_id: institutionId,
      department_id: departmentId,
    };

    // Retry on the unique display_id collision (sequence makes this rare, but
    // keep belt-and-suspenders for the trigger's BEFORE-INSERT window).
    let newReport: any = null;
    let insertError: any = null;
    for (let attempt = 1; attempt <= 3 && !newReport; attempt++) {
      const res = await supabase.from('bug_reports').insert(initialReport).select().single();
      if (res.error) {
        insertError = res.error;
        if (res.error.message.includes('bug_reports_display_id_key') && attempt < 3) {
          await new Promise((r) => setTimeout(r, 100 * attempt));
          continue;
        }
        break;
      }
      newReport = res.data;
      insertError = null;
    }

    if (insertError || !newReport) {
      return NextResponse.json(
        { success: false, error: 'Failed to create bug report', details: insertError?.message, errorCode: 'INSERT_ERROR' },
        { status: 500 }
      );
    }

    // Reporter becomes a participant on the thread.
    const { error: participantError } = await supabase.from('bug_report_participants').insert({
      bug_report_id: newReport.id,
      user_id: user.id,
      role: 'reporter',
      can_view_internal: false,
      is_active: true,
      joined_at: new Date().toISOString(),
    });
    if (participantError && !participantError.message.includes('duplicate')) {
      logger.warn('bug-reports/api', 'Could not add participant', participantError);
    }

    // Generate signed upload URLs. Paths are deterministic, so the public URL is
    // valid the instant the browser finishes uploading — pre-store it on the row.
    let screenshotSignedData: { path: string; signedUrl: string; token: string } | null = null;
    const additionalSignedData: Array<{ path: string; signedUrl: string; token: string }> = [];
    const urlUpdate: { screenshot_url?: string; attachment_urls?: string[] } = {};

    if (data.wants_screenshot) {
      const ext = data.screenshot_format ?? 'jpg';
      const path = `${newReport.id}/screenshot.${ext}`;
      const { data: signed } = await supabase.storage
        .from(BUG_REPORTS_BUCKET)
        .createSignedUploadUrl(path, { upsert: false });
      if (signed) {
        screenshotSignedData = { path, ...signed };
        urlUpdate.screenshot_url = supabase.storage.from(BUG_REPORTS_BUCKET).getPublicUrl(path).data.publicUrl;
      }
    }

    const count = data.additional_image_count ?? 0;
    const formats = data.additional_image_formats ?? [];
    if (count > 0) {
      const publicUrls: string[] = [];
      for (let i = 0; i < count; i++) {
        const ext = formats[i] ?? 'jpg';
        const path = `${newReport.id}/additional-${i + 1}.${ext}`;
        const { data: signed } = await supabase.storage
          .from(BUG_REPORTS_BUCKET)
          .createSignedUploadUrl(path, { upsert: false });
        if (signed) {
          additionalSignedData.push({ path, ...signed });
          publicUrls.push(supabase.storage.from(BUG_REPORTS_BUCKET).getPublicUrl(path).data.publicUrl);
        }
      }
      if (publicUrls.length) urlUpdate.attachment_urls = publicUrls;
    }

    let finalReport = newReport;
    if (Object.keys(urlUpdate).length > 0) {
      const { data: updated } = await supabase
        .from('bug_reports')
        .update(urlUpdate)
        .eq('id', newReport.id)
        .select()
        .single();
      if (updated) finalReport = updated;
    }

    return NextResponse.json(
      {
        success: true,
        data: finalReport,
        signedUploadUrl: screenshotSignedData,
        additionalSignedUrls: additionalSignedData,
        message: 'Bug report created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('bug-reports/api', 'Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', errorCode: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  await connection();
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const reporter_user_id = searchParams.get('reporter_user_id');
    const module_name = searchParams.get('module_name');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = supabase.from('bug_reports_with_details').select('*', { count: 'exact' });
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (reporter_user_id) query = query.eq('reporter_user_id', reporter_user_id);
    if (module_name) query = query.eq('module_name', module_name);
    if (search) {
      const term = `%${search.trim()}%`;
      query = query.or(`reporter_name.ilike.${term},reporter_email.ilike.${term}`);
    }
    query = query.range((page - 1) * limit, page * limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;

    const withReporter = (data ?? []).map((r: any) => ({
      ...r,
      reporter: r.reporter_name
        ? { id: r.reporter_user_id, full_name: r.reporter_name, email: r.reporter_email }
        : null,
    }));

    // similar_count: how many OTHER reports share this one's error signature.
    const sigCount: Record<string, number> = {};
    const tagged = withReporter.map((b: any) => ({ ...b, _sig: extractErrorSignature(b.console_logs) }));
    for (const b of tagged) if (b._sig) sigCount[b._sig] = (sigCount[b._sig] ?? 0) + 1;
    const processed = tagged.map(({ _sig, ...b }: any) => ({
      ...b,
      similar_count: _sig ? Math.max(0, (sigCount[_sig] ?? 1) - 1) : 0,
    }));

    return NextResponse.json({
      data: processed,
      metadata: { total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 },
    });
  } catch (error) {
    logger.error('bug-reports/api', 'Failed to fetch bug reports', error);
    return NextResponse.json({ error: 'Failed to fetch bug reports.' }, { status: 500 });
  }
}
