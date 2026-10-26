import { NextResponse } from 'next/server';
import { AUTH_STATUS, getAuthResult } from '@/lib/auth/current-user';
import { createGenerationDiagnostics, type GenerationStage } from '@/lib/reports/generation-diagnostics';
import {
  GenerationRequestError,
  generateReportOutline,
  generateReportStage,
  outlineGenerationRequestSchema,
  stageGenerationRequestSchema,
} from '@/lib/reports/batch-generation';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const diagnostics = createGenerationDiagnostics();
  let stage: GenerationStage = 'authentication';
  const fail = (error: string, status: number, reason: string, issues: unknown[] = [], suggestion = '请重试；若仍失败，请把参考编号发给管理员。') => {
    diagnostics.record('failed', { stage, errorCode: error, issueCount: issues.length });
    return NextResponse.json({ error, reason, suggestion, issues, requestId: diagnostics.requestId }, {
      status, headers: { 'x-request-id': diagnostics.requestId },
    });
  };
  diagnostics.record('started', { stage });
  try {
    const auth = await getAuthResult();
    if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) return fail('SYSTEM_NOT_CONFIGURED', 503, '登录服务暂时不可用。');
    if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) return fail('UNAUTHORIZED', 401, '登录已过期。');
    if (!auth.user || auth.user.role === 'management') return fail('FORBIDDEN', 403, '当前账号不能生成报告。');
    stage = 'request_validation';
    const body = await request.json().catch(() => null);
    const operation = body && typeof body === 'object' && 'operation' in body ? String(body.operation) : '';
    const parsed = operation === 'outline' ? outlineGenerationRequestSchema.safeParse(body) : stageGenerationRequestSchema.safeParse(body);
    if (!parsed.success) return fail('INVALID_INPUT', 400, '填写信息未通过检查。', parsed.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), code: issue.code })));
    stage = 'model_generation';
    const result = parsed.data.operation === 'outline' ? await generateReportOutline(parsed.data) : await generateReportStage(parsed.data);
    stage = 'response_assembly';
    diagnostics.record('succeeded', { stage, subjectCode: parsed.data.subjectCode, lessonCount: parsed.data.lessonCount });
    return NextResponse.json({ ...result, requestId: diagnostics.requestId }, { headers: { 'x-request-id': diagnostics.requestId } });
  } catch (error) {
    if (error instanceof GenerationRequestError) return fail(error.code, error.status, error.reason, [], error.suggestion);
    return fail('AI_GENERATION_FAILED', 502, '本次生成未完成。');
  }
}
