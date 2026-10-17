import { NextResponse } from 'next/server';
import { AUTH_STATUS, getAuthResult } from '@/lib/auth/current-user';
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

function jsonError(error: string, status: number, reason: string) {
  return NextResponse.json({ error, reason, suggestion: '请重试当前生成步骤；如果反复失败，请把发生时间发给管理员。' }, { status });
}

export async function POST(request: Request) {
  const auth = await getAuthResult();
  if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) return jsonError('SYSTEM_NOT_CONFIGURED', 503, '登录服务尚未配置。');
  if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) return jsonError('UNAUTHORIZED', 401, '登录已过期。');
  if (auth.user?.role === 'management') return jsonError('FORBIDDEN', 403, '师资管理账号不能生成报告。');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_INPUT', 400, '请求内容无法读取。');
  }
  const operation = body && typeof body === 'object' && 'operation' in body ? String(body.operation) : '';
  const parsed = operation === 'outline' ? outlineGenerationRequestSchema.safeParse(body) : stageGenerationRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_INPUT', 400, '生成参数不完整或不符合要求。');
  try {
    if (parsed.data.operation === 'outline') {
      return NextResponse.json(await generateReportOutline(parsed.data));
    }
    return NextResponse.json(await generateReportStage(parsed.data));
  } catch (error) {
    if (error instanceof GenerationRequestError) {
      return NextResponse.json({ error: error.code, reason: error.reason, suggestion: error.suggestion }, { status: error.status });
    }
    return jsonError('AI_GENERATION_FAILED', 502, 'AI 服务本次没有完成生成。');
  }
}
