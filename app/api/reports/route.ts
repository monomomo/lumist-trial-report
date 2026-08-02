import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { authEmailToUsername } from '@/lib/auth/username';
import { getTeacherProfileSnapshot } from '@/lib/teachers/public-profile';
import {
  reportCreateSchema,
  reportUpdateSchema,
  type ReportCreateInput,
  type ReportUpdateInput,
} from '@/lib/reports/schema';

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ reports: [], demo: true });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reportId = new URL(request.url).searchParams.get('id');
  if (reportId) {
    const { data, error } = await supabase
      .from('reports')
      .select('id,student_name,subject,current_score,target_score,exam_date_text,original_notes,report_data,course_plan,sales_follow_up,teacher_snapshot,status,created_at,updated_at')
      .eq('id', reportId)
      .eq('teacher_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'REPORT_NOT_FOUND' }, { status: error?.code === 'PGRST116' ? 404 : 500 });
    }

    return NextResponse.json({ report: data });
  }

  const { data, error } = await supabase
    .from('reports')
    .select('id,student_name,subject,status,created_at,updated_at')
    .eq('teacher_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: data });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ saved: false, demo: true });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = reportCreateSchema.safeParse(await readRequestBody(request));
  if (!parsed.success) {
    return invalidReportDataResponse(parsed.error.issues);
  }

  const body = parsed.data;
  const teacherSnapshot = await getTeacherProfileSnapshot(user.id, authEmailToUsername(user.email ?? ''));
  const payload = {
    teacher_id: user.id,
    ...buildMutableReportPayload(body),
    teacher_snapshot: teacherSnapshot || {},
  };

  let { data, error } = await supabase.from('reports').insert(payload).select('id').single();
  if (error?.message.includes('teacher_snapshot')) {
    const { teacher_snapshot, ...legacyPayload } = payload;
    const fallbackResult = await supabase.from('reports').insert(legacyPayload).select('id').single();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'REPORT_SAVE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ saved: true, id: data.id });
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ saved: false, demo: true });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = reportUpdateSchema.safeParse(await readRequestBody(request));
  if (!parsed.success) {
    return invalidReportDataResponse(parsed.error.issues);
  }

  const body = parsed.data;

  const { data, error } = await supabase
    .from('reports')
    .update(buildMutableReportPayload(body))
    .eq('id', body.id)
    .eq('teacher_id', user.id)
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'REPORT_SAVE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ saved: true, id: data.id });
}

async function readRequestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function invalidReportDataResponse(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return NextResponse.json({
    error: 'INVALID_REPORT_DATA',
    issues: issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
  }, { status: 400 });
}

function buildMutableReportPayload(body: ReportCreateInput | ReportUpdateInput) {
  return {
    student_name: body.studentName,
    subject: body.subject || 'SAT 数学',
    current_score: body.currentScore || null,
    target_score: body.targetScore || null,
    exam_date_text: body.examDate || null,
    original_notes: body.teacherNotes,
    report_data: body.reportData || {},
    course_plan: body.coursePlan || {},
    sales_follow_up: body.salesFollowUp || {},
    status: 'completed',
  };
}
