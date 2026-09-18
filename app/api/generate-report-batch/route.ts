import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_STATUS, getAuthResult } from '@/lib/auth/current-user';
import { PLANNING_FOCUS_AREA_CODES, PLANNING_SCENARIO_CODES, normalizePlanningFocusAreas } from '@/lib/reports/planning-context';
import { SUBJECT_CODES, resolveSubject, validateSubjectScores } from '@/lib/subjects/catalog';
import { buildApFrameworkPrompt } from '@/lib/subjects/ap-framework';
import { buildCalculusSyllabusPrompt } from '@/lib/subjects/ap-calculus-syllabus.js';
import { buildSystemPrompt, buildUserInput } from '@/lib/subjects/prompt';
import { buildLessonDurationSlots } from '@/lib/subjects/lesson-slots';
import { parseModelResponse } from '@/lib/reports/model-response';
import { applyClassroomFactGuard } from '@/lib/reports/classroom-fact-guard';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const baseRequestSchema = z.object({
  studentName: z.string().trim().min(1).max(30),
  currentScore: z.string().trim().max(30).optional().default(''),
  targetScore: z.string().trim().max(30).optional().default(''),
  examDate: z.string().trim().max(50).optional().default(''),
  totalHours: z.coerce.number().min(2).max(60).multipleOf(0.5),
  lessonCount: z.coerce.number().int().min(1).max(60),
  planningScenario: z.enum(PLANNING_SCENARIO_CODES as [string, ...string[]]),
  planningFocusAreas: z.array(z.enum(PLANNING_FOCUS_AREA_CODES as [string, ...string[]])).max(3).optional().default([]),
  includeExamTraining: z.boolean().optional().default(false),
  teacherNotes: z.string().trim().min(20).max(6000),
  subjectCode: z.enum(SUBJECT_CODES as [string, ...string[]]),
});

const outlineStageSchema = z.object({
  title: z.string().min(2).max(50),
  description: z.string().min(8).max(100),
  lessonCount: z.number().int().min(1).max(10),
});

const outlineSchema = z.object({
  overview: z.string().min(8).max(500),
  classroomStatus: z.string().min(8).max(160),
  strength: z.string().min(8).max(160),
  currentFocus: z.string().min(8).max(180),
  lessonTitle: z.string().min(5).max(80),
  lessonSummary: z.string().min(8).max(400),
  performance: z.string().min(8).max(300),
  outcomes: z.array(z.string().min(6).max(120)).min(1).max(5),
  priorityAreas: z.array(z.string().min(2).max(80)).min(2).max(6),
  rationale: z.string().min(20).max(180),
  stages: z.array(outlineStageSchema).min(1).max(8),
});

const lessonSchema = z.object({
  theme: z.string().min(2).max(36),
  content: z.string().min(8).max(105),
  difficulty: z.string().min(8).max(105),
  goal: z.string().min(8).max(80),
  unitCodes: z.array(z.string().min(1).max(30)).max(10),
});

const stageResultSchema = z.object({
  lessons: z.array(lessonSchema).min(1).max(10),
});

const outlineRequestSchema = baseRequestSchema.extend({
  operation: z.literal('outline'),
});

const stageRequestSchema = baseRequestSchema.extend({
  operation: z.literal('stage'),
  stage: outlineStageSchema,
  stageIndex: z.number().int().min(0).max(7),
  stageCount: z.number().int().min(1).max(8),
  startLessonNumber: z.number().int().min(1).max(60),
  durations: z.array(z.number().positive().multipleOf(0.5)).min(1).max(10),
  previousStageTitle: z.string().max(50).optional().default(''),
  nextStageTitle: z.string().max(50).optional().default(''),
});

function createClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
    timeout: 240000,
    maxRetries: 0,
  });
}

async function requestStructuredOutput<T>(
  client: OpenAI,
  schema: z.ZodType<T>,
  schemaName: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number,
) {
  const payload = {
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    input: [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ],
    text: { format: zodTextFormat(schema, schemaName) },
    reasoning: { effort: process.env.OPENAI_BASE_URL?.includes('api.deepseek.com') ? 'none' as const : 'low' as const },
    max_output_tokens: maxOutputTokens,
  };
  const response = process.env.OPENAI_BASE_URL?.includes('api.deepseek.com')
    ? await client.responses.create(payload)
    : await client.responses.parse(payload);
  return parseModelResponse(response, (value) => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
}

function getAllowedUnitCodes(subjectCode: string, planningScenario: string, teacherNotes: string) {
  const syllabus = buildCalculusSyllabusPrompt(subjectCode, planningScenario, teacherNotes)
    || buildApFrameworkPrompt(subjectCode);
  if (!syllabus) return [];
  if ('allowedUnits' in syllabus) return syllabus.allowedUnits.map((unit) => unit.code);
  return syllabus.allowedSections.map((section) => section.code);
}

function createPromptData(data: z.infer<typeof baseRequestSchema>) {
  const subject = resolveSubject(data.subjectCode);
  const targetScore = data.targetScore || (subject.code.startsWith('ap_') ? '5' : '');
  const scoreValidation = validateSubjectScores(subject.code, data.currentScore, targetScore);
  if (!scoreValidation.valid) return null;
  const planningFocusAreas = normalizePlanningFocusAreas(data.planningFocusAreas, subject.code);
  if (planningFocusAreas.length !== data.planningFocusAreas.length) return null;
  let lessonDurations: number[];
  try {
    lessonDurations = buildLessonDurationSlots(data.totalHours, data.lessonCount);
  } catch {
    return null;
  }
  return {
    subject,
    targetScore,
    lessonDurations,
    promptData: {
      ...data,
      targetScore,
      planningFocusAreas,
      lessonDurations,
    },
  };
}

function jsonError(error: string, status: number, reason: string) {
  return NextResponse.json({ error, reason, suggestion: '请重试当前生成步骤；如果反复失败，请把发生时间发给管理员。' }, { status });
}

export async function POST(request: Request) {
  const auth = await getAuthResult();
  if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) return jsonError('SYSTEM_NOT_CONFIGURED', 503, '登录服务尚未配置。');
  if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) return jsonError('UNAUTHORIZED', 401, '登录已过期。');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_INPUT', 400, '请求内容无法读取。');
  }
  const operation = body && typeof body === 'object' && 'operation' in body ? String(body.operation) : '';
  const parsed = operation === 'outline' ? outlineRequestSchema.safeParse(body) : stageRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError('INVALID_INPUT', 400, '生成参数不完整或不符合要求。');
  const context = createPromptData(parsed.data);
  if (!context) return jsonError('INVALID_INPUT', 400, '成绩、课次或课程规划参数不符合要求。');
  const client = createClient();
  if (!client) return jsonError('AI_SERVICE_NOT_CONFIGURED', 503, 'AI 服务尚未配置。');
  try {
    if (parsed.data.operation === 'outline') {
      const systemPrompt = `${buildSystemPrompt(context.subject)}

本次只生成报告摘要与课程阶段骨架，不生成详细 lessons。所有关于学生课堂行为、答题过程、提示前后变化和已掌握内容的陈述，都必须能在 teacherNotes 中找到直接依据；不得把未来课程计划改写成已经发生的课堂事实。每个阶段最多 10 个课次，所有 stage.lessonCount 之和必须严格等于 ${context.lessonDurations.length}。${parsed.data.includeExamTraining ? `老师已勾选考试训练，课程阶段必须安排 MCQ、FRQ、模考、真题讲评、错题订正或考试策略等考试训练，考试训练时长不少于总课时的 20%。` : '老师未勾选考试训练，不要为了凑结构强行安排模考或考试讲评。'}`;
      const userPrompt = `${buildUserInput(context.subject, context.promptData)}

请返回摘要字段、coursePlan.rationale，以及只含 title、description、lessonCount 的阶段数组。`;
      const outline = await requestStructuredOutput(client, outlineSchema, 'trial_report_outline', systemPrompt, userPrompt, 9000);
      if (!outline) return jsonError('EMPTY_MODEL_OUTPUT', 502, 'AI 没有返回可用的阶段规划。');
      const guardedOutline = applyClassroomFactGuard(outline, context.subject.displayName, parsed.data.teacherNotes);
      const plannedCount = guardedOutline.stages.reduce((total, stage) => total + stage.lessonCount, 0);
      if (plannedCount !== context.lessonDurations.length) {
        return jsonError('OUTLINE_LESSON_COUNT_MISMATCH', 422, `阶段规划共 ${plannedCount} 个课次，与要求的 ${context.lessonDurations.length} 个课次不一致。`);
      }
      let durationIndex = 0;
      const stages = guardedOutline.stages.map((stage) => {
        const durations = context.lessonDurations.slice(durationIndex, durationIndex + stage.lessonCount);
        const startLessonNumber = durationIndex + 1;
        durationIndex += stage.lessonCount;
        return { ...stage, durations, startLessonNumber };
      });
      return NextResponse.json({ outline: { ...guardedOutline, stages }, targetScore: context.targetScore });
    }

    if (parsed.data.stage.lessonCount !== parsed.data.durations.length) {
      return jsonError('STAGE_LESSON_COUNT_MISMATCH', 400, '当前阶段的课次和时长数量不一致。');
    }
    const allowedUnitCodes = getAllowedUnitCodes(parsed.data.subjectCode, parsed.data.planningScenario, parsed.data.teacherNotes);
    const endLessonNumber = parsed.data.startLessonNumber + parsed.data.stage.lessonCount - 1;
    const systemPrompt = `${buildSystemPrompt(context.subject)}

本次只生成一个课程阶段的详细课次，不生成报告摘要或其他阶段。必须严格返回 ${parsed.data.stage.lessonCount} 个 lessons，对应完整报告第 ${parsed.data.startLessonNumber}–${endLessonNumber} 课。课程规划可以安排未来教学任务，但不得新增或推断学生已经出现过的具体错误、课堂动作、正确率或提示后表现。${parsed.data.includeExamTraining ? '如果本阶段属于考试训练阶段，明确安排 MCQ、FRQ、模考、真题讲评、错题订正或考试策略；整个规划的考试训练时长需达到总课时的 20%。' : '未勾选考试训练时，按学生同步学习和知识点需要安排课程，不强行加入模考或考试讲评。'}`;
    const userPrompt = `根据老师记录和阶段信息生成这一批课程：
${JSON.stringify({
      subject: context.subject.displayName,
      teacherNotes: parsed.data.teacherNotes,
      planningScenario: parsed.data.planningScenario,
      stageIndex: parsed.data.stageIndex,
      stageCount: parsed.data.stageCount,
      stage: parsed.data.stage,
      previousStageTitle: parsed.data.previousStageTitle || null,
      nextStageTitle: parsed.data.nextStageTitle || null,
      lessonNumberRange: [parsed.data.startLessonNumber, endLessonNumber],
      durations: parsed.data.durations,
      allowedUnitCodes,
    }, null, 2)}

只返回 lessons 数组。每个 lesson 必须包含 theme、content、difficulty、goal、unitCodes，并保持相邻课次内容递进且不重复。`;
    const stageResult = await requestStructuredOutput(client, stageResultSchema, 'trial_report_stage', systemPrompt, userPrompt, 8000);
    if (!stageResult) return jsonError('EMPTY_MODEL_OUTPUT', 502, 'AI 没有返回可用的阶段课次。');
    if (stageResult.lessons.length !== parsed.data.stage.lessonCount) {
      return jsonError('STAGE_LESSON_COUNT_MISMATCH', 422, `当前阶段应生成 ${parsed.data.stage.lessonCount} 个课次，AI 实际返回 ${stageResult.lessons.length} 个。`);
    }
    const invalidUnitCode = stageResult.lessons.flatMap((lesson) => lesson.unitCodes).find((code) => !allowedUnitCodes.includes(code));
    if (invalidUnitCode || (context.subject.code.startsWith('ap_') && stageResult.lessons.some((lesson) => lesson.unitCodes.length === 0))) {
      return jsonError('INVALID_UNIT_CODE', 422, '当前阶段包含无效或缺失的 AP Unit 编码。');
    }
    const durations = parsed.data.durations;
    const lessons = stageResult.lessons.map((lesson, index) => ({ ...lesson, duration: durations[index] }));
    return NextResponse.json({ lessons });
  } catch (error) {
    return jsonError('AI_GENERATION_FAILED', 502, error instanceof Error && error.name === 'APIConnectionTimeoutError' ? 'AI 服务本次响应超时。' : 'AI 服务本次没有完成生成。');
  }
}
