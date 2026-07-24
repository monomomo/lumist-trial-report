import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSubject } from '@/lib/subjects/catalog';
import { buildSystemPrompt, buildUserInput } from '@/lib/subjects/prompt';
import { getAuthResult, AUTH_STATUS } from '@/lib/auth/current-user';

export const runtime = 'nodejs';
export const maxDuration = 300;

const lessonSchema = z.object({
  duration: z.number().min(0.5).max(2).multipleOf(0.5),
  theme: z.string().min(2).max(40),
  content: z.string().min(8).max(160),
  difficulty: z.string().min(8).max(160),
  goal: z.string().min(8).max(120)
});

const reportSchema = z.object({
  overview: z.string().min(40).max(500),
  classroomStatus: z.string().min(10).max(160),
  strength: z.string().min(8).max(160),
  currentFocus: z.string().min(8).max(180),
  lessonTitle: z.string().min(5).max(80),
  lessonSummary: z.string().min(20).max(400),
  performance: z.string().min(20).max(300),
  outcomes: z.array(z.string().min(6).max(120)).min(3).max(5),
  priorityAreas: z.array(z.string().min(2).max(40)).min(2).max(6),
  coursePlan: z.object({
    rationale: z.string().min(20).max(300),
    stages: z.array(z.object({
      title: z.string().min(4).max(50),
      description: z.string().min(10).max(160),
      lessons: z.array(lessonSchema).min(2).max(12)
    })).min(2).max(6)
  }),
  salesFollowUp: z.object({
    positive: z.string().min(15).max(240),
    urgent: z.string().min(20).max(320),
    angle: z.string().min(20).max(260),
    script: z.string().min(80).max(800)
  })
});

const requestSchema = z.object({
  studentName: z.string().trim().min(1).max(30),
  currentScore: z.string().trim().max(30).optional().default(''),
  targetScore: z.string().trim().max(30).optional().default(''),
  examDate: z.string().trim().max(50).optional().default(''),
  teacherNotes: z.string().trim().min(20).max(6000),
  subjectCode: z.string().trim().max(40).optional().default('sat_math')
});

function normalizePlanTitle(value: string) {
  let normalized = value.trim().replace(/[、，,/]+$/g, '').trim();
  const openingCount = (normalized.match(/[（(]/g) || []).length;
  const closingCount = (normalized.match(/[）)]/g) || []).length;
  if (openingCount > closingCount) normalized = normalized.replace(/[（(][^）)]*$/g, '').trim();
  return normalized || '专项训练';
}

function normalizeRationale(value: string) {
  const normalized = value.replace(/[^。；]*\d+(?:\.\d+)?\s*(?:小时|h)[^。；]*[。；]?/gi, '').trim();
  return normalized || '后续课时将依据诊断测试、课堂掌握情况、错题类型与每题用时动态调整。';
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI_SERVICE_NOT_CONFIGURED' }, { status: 503 });
  }

  const auth = await getAuthResult();
  if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) {
    return NextResponse.json({ error: 'SYSTEM_NOT_CONFIGURED' }, { status: 503 });
  }
  if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const subject = resolveSubject(parsed.data.subjectCode);

    const client = new OpenAI({
      apiKey,
      timeout: 240000,
      maxRetries: 0
    });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: [
        { role: 'system', content: buildSystemPrompt(subject) },
        { role: 'user', content: buildUserInput(subject, parsed.data) }
      ],
      text: { format: zodTextFormat(reportSchema, 'trial_report') },
      reasoning: { effort: 'low' },
      max_output_tokens: 8000
    });

    if (!response.output_parsed) {
      return NextResponse.json({ error: 'EMPTY_MODEL_OUTPUT' }, { status: 502 });
    }

    const stages = response.output_parsed.coursePlan.stages.map((stage) => ({
      ...stage,
      title: normalizePlanTitle(stage.title),
      lessons: stage.lessons.map((lesson) => ({ ...lesson, theme: normalizePlanTitle(lesson.theme) }))
    }));
    const totalHours = stages.reduce((sum, stage) => sum + stage.lessons.reduce((stageSum, lesson) => stageSum + lesson.duration, 0), 0);

    return NextResponse.json({
      generated: true,
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      report: {
        ...response.output_parsed,
        coursePlan: {
          ...response.output_parsed.coursePlan,
          rationale: normalizeRationale(response.output_parsed.coursePlan.rationale),
          stages,
          totalHours
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    console.error('Report generation failed', message);
    return NextResponse.json({ error: 'AI_GENERATION_FAILED' }, { status: 502 });
  }
}
