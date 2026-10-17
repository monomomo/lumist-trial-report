import { NextResponse } from 'next/server';
import { AUTH_STATUS, getAuthResult } from '@/lib/auth/current-user';
import { createClient } from '@/lib/supabase/server';
import { generationSnapshotSchema } from '@/lib/reports/generation-snapshot';
import { lockedCoursePlanSchema } from '@/lib/course-plan-upload/schema';
import { resolveSubject } from '@/lib/subjects/catalog';
import { getGenerationAction, sameCoursePlan } from '@/public/report/generation-policy.js';

export const dynamic = 'force-dynamic';

const requestSchema = generationSnapshotSchema.extend({
  lockedCoursePlan: lockedCoursePlanSchema.optional(),
});

export async function POST(request: Request) {
  const auth = await getAuthResult();
  if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (auth.status !== AUTH_STATUS.AUTHENTICATED || !auth.user || auth.user.role === 'management') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  const input = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from('reports')
    .select('id,report_data,course_plan')
    .eq('teacher_id', auth.user.id)
    .eq('student_name', input.studentName)
    .eq('subject', resolveSubject(input.subjectCode).displayName)
    .eq('original_notes', input.teacherNotes)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: 'REPORT_LOOKUP_FAILED' }, { status: 500 });
  const match = data?.find((record) => {
    if (getGenerationAction(record.report_data?.generationInput, input) !== 'reuse') return false;
    return input.source !== 'upload' || sameCoursePlan(record.course_plan, input.lockedCoursePlan);
  });
  return NextResponse.json({ id: match?.id || null });
}
