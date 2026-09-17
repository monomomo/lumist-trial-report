import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { NextResponse } from 'next/server';
import { getAuthResult, AUTH_STATUS } from '@/lib/auth/current-user';
import { SUBJECT_CODES, resolveSubject } from '@/lib/subjects/catalog';
import { extractCoursePlanText } from '@/lib/course-plan-upload/extract';
import { buildCoursePlanExtractionInput, buildCoursePlanExtractionPrompt } from '@/lib/course-plan-upload/prompt';
import { buildLockedPlan, getUploadedPlanWarnings, uploadedPlanExtractionSchema } from '@/lib/course-plan-upload/schema';
import { parseModelResponse } from '@/lib/reports/model-response';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const auth = await getAuthResult();
    if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) return NextResponse.json({ error: 'SYSTEM_NOT_CONFIGURED' }, { status: 503 });
    if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'AI_SERVICE_NOT_CONFIGURED' }, { status: 503 });
    const form = await request.formData();
    const file = form.get('file');
    const subjectCode = String(form.get('subjectCode') ?? '');
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_BYTES || !SUBJECT_CODES.includes(subjectCode as never)) {
      return NextResponse.json({ error: 'INVALID_UPLOAD' }, { status: 400 });
    }
    const subject = resolveSubject(subjectCode);
    const extractedText = await extractCoursePlanText(file);
    const isDeepSeek = process.env.OPENAI_BASE_URL?.includes('api.deepseek.com') === true;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL, timeout: 240000, maxRetries: 0 });
    const payload = {
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: [
        { role: 'system' as const, content: buildCoursePlanExtractionPrompt(subject.displayName) },
        { role: 'user' as const, content: buildCoursePlanExtractionInput(file.name, extractedText) },
      ],
      text: { format: zodTextFormat(uploadedPlanExtractionSchema, 'uploaded_course_plan') },
      reasoning: { effort: isDeepSeek ? 'none' as const : 'low' as const },
      max_output_tokens: 32000,
    };
    const response = isDeepSeek ? await client.responses.create(payload) : await client.responses.parse(payload);
    const extraction = parseModelResponse(response, (value) => {
      const result = uploadedPlanExtractionSchema.safeParse(value);
      return result.success ? result.data : null;
    });
    if (!extraction) return NextResponse.json({ error: 'COURSE_PLAN_PARSE_FAILED' }, { status: 502 });
    const warnings = getUploadedPlanWarnings(extraction);
    let lockedPlan = null;
    try {
      lockedPlan = buildLockedPlan(extraction);
    } catch {
      warnings.push('存在缺失或不支持的课时时长，请老师修改后再确认');
    }
    return NextResponse.json({ parsed: true, fileName: file.name, extraction, lockedPlan, warnings: [...new Set(warnings)] });
  } catch (error) {
    const code = error instanceof RangeError ? error.message : 'COURSE_PLAN_PARSE_FAILED';
    return NextResponse.json({ error: code }, { status: code === 'COURSE_PLAN_PARSE_FAILED' ? 502 : 400 });
  }
}
