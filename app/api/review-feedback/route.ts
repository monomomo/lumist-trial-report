import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_STATUS, getAuthResult } from '@/lib/auth/current-user';
import { GenerationRequestError, reviewTeacherFeedback } from '@/lib/reports/batch-generation';

export const maxDuration = 300;

const inputSchema = z.object({
  internal: z.string().trim().max(6000),
  family: z.string().trim().max(6000),
  subject: z.string().max(100),
}).refine(({ internal, family }) => internal.length + family.length >= 20);

export async function POST(request: Request) {
  const auth = await getAuthResult();
  if (auth.status !== AUTH_STATUS.AUTHENTICATED) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (auth.user?.role === 'management') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  try {
    return NextResponse.json(await reviewTeacherFeedback(input.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof GenerationRequestError ? error.code : 'AI_GENERATION_FAILED' }, { status: error instanceof GenerationRequestError ? error.status : 502 });
  }
}
