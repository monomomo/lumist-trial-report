import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { PLANNING_FOCUS_AREA_CODES, PLANNING_SCENARIO_CODES, normalizePlanningFocusAreas } from '@/lib/reports/planning-context';
import { SUBJECT_CODES, resolveSubject, validateSubjectScores } from '@/lib/subjects/catalog';
import { buildApFrameworkPrompt } from '@/lib/subjects/ap-framework';
import { buildCalculusSyllabusPrompt } from '@/lib/subjects/ap-calculus-syllabus.js';
import { buildSystemPrompt, buildUserInput } from '@/lib/subjects/prompt';
import { buildLessonDurationSlots } from '@/lib/subjects/lesson-slots';
import { parseModelResponse } from '@/lib/reports/model-response';
import { applyClassroomFactGuard } from '@/lib/reports/classroom-fact-guard';
import { normalizeOutlineResult, normalizeStageResult } from '@/lib/reports/batch-model-output';
import { buildSatMathLessonAllocations } from '@/lib/reports/sat-context';
import { satSubjectContextShape, validateSatSubjectContext } from '@/lib/reports/sat-context-validation.js';

const generationInputBaseSchema = z.object({
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
  ...satSubjectContextShape,
});

export const generationInputSchema = generationInputBaseSchema.superRefine(validateSatSubjectContext);

export const generationOutlineStageSchema = z.object({
  title: z.string().min(2).max(50),
  description: z.string().min(8).max(100),
  lessonCount: z.number().int().min(1).max(10),
});

const generationOutlineSchema = z.object({
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
  stages: z.array(generationOutlineStageSchema).min(1).max(8),
});

const generationLessonSchema = z.object({
  theme: z.string().trim().min(2).max(80),
  content: z.string().trim().min(8).max(300),
  difficulty: z.string().trim().min(8).max(300),
  goal: z.string().trim().min(8).max(200),
  unitCodes: z.array(z.string().min(1).max(30)).max(10),
  satMathAllocations: z.array(z.object({
    code: z.enum(['algebra', 'advanced_math', 'problem_solving_data_analysis', 'geometry_trigonometry', 'integrated_practice']),
    hours: z.number().positive().multipleOf(0.5),
  }).strict()).max(5),
});

const generationStageResultSchema = z.object({
  lessons: z.array(generationLessonSchema).min(1).max(10),
});

export const outlineGenerationRequestSchema = generationInputBaseSchema.extend({
  operation: z.literal('outline'),
}).superRefine(validateSatSubjectContext);

export const stageGenerationRequestSchema = generationInputBaseSchema.extend({
  operation: z.literal('stage'),
  stage: generationOutlineStageSchema,
  stageIndex: z.number().int().min(0).max(7),
  stageCount: z.number().int().min(1).max(8),
  startLessonNumber: z.number().int().min(1).max(60),
  durations: z.array(z.number().positive().multipleOf(0.5)).min(1).max(10),
  previousStageTitle: z.string().max(50).optional().default(''),
  nextStageTitle: z.string().max(50).optional().default(''),
}).superRefine(validateSatSubjectContext);

export type GenerationInput = z.infer<typeof generationInputSchema>;
export type OutlineGenerationRequest = z.infer<typeof outlineGenerationRequestSchema>;
export type StageGenerationRequest = z.infer<typeof stageGenerationRequestSchema>;
export type GenerationOutlineResult = z.infer<typeof generationOutlineSchema> & {
  stages: Array<z.infer<typeof generationOutlineStageSchema> & { durations: number[]; startLessonNumber: number }>;
};
export type GenerationLesson = Omit<z.infer<typeof generationLessonSchema>, 'satMathAllocations'> & { duration: number };

export class GenerationRequestError extends Error {
  code: string;
  status: number;
  reason: string;
  suggestion: string;

  constructor(code: string, status: number, reason: string, suggestion = '请重试当前生成步骤；如果反复失败，请把发生时间发给管理员。') {
    super(code);
    this.name = 'GenerationRequestError';
    this.code = code;
    this.status = status;
    this.reason = reason;
    this.suggestion = suggestion;
  }
}

function createOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new GenerationRequestError('AI_SERVICE_NOT_CONFIGURED', 503, 'AI 服务尚未配置。');
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
  normalizeValue: (value: unknown) => unknown = (value) => value,
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
  const modelResponse = response as typeof response & { output_parsed?: unknown; output_text?: string };
  return parseModelResponse(modelResponse, (value) => {
    const parsed = schema.safeParse(normalizeValue(value));
    if (!parsed.success) {
      console.error('AI structured output validation failed', {
        schemaName,
        issues: parsed.error.issues.map((issue) => ({ code: issue.code, path: issue.path.join('.') })),
        hasOutputParsed: modelResponse.output_parsed !== undefined && modelResponse.output_parsed !== null,
        outputTextLength: modelResponse.output_text?.length || 0,
      });
    }
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

function createPromptContext(data: GenerationInput) {
  const subject = resolveSubject(data.subjectCode);
  const targetScore = data.targetScore || (subject.code.startsWith('ap_') ? '5' : '');
  const scoreValidation = validateSubjectScores(subject.code, data.currentScore, targetScore);
  if (!scoreValidation.valid) throw new GenerationRequestError('INVALID_SCORE', 400, '成绩不符合当前科目的分数范围。');
  const planningFocusAreas = normalizePlanningFocusAreas(data.planningFocusAreas, subject.code);
  if (planningFocusAreas.length !== data.planningFocusAreas.length) throw new GenerationRequestError('INVALID_PLANNING_FOCUS', 400, '课程侧重点不适用于当前科目。');
  let lessonDurations: number[];
  try {
    lessonDurations = buildLessonDurationSlots(data.totalHours, data.lessonCount);
  } catch {
    throw new GenerationRequestError('INVALID_LESSON_COUNT', 400, '课次与总课时不匹配。');
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

function normalizeGenerationError(error: unknown) {
  if (error instanceof GenerationRequestError) return error;
  if (error instanceof OpenAI.APIError && error.status === 429) return new GenerationRequestError('AI_RATE_LIMITED', 429, '当前使用人数较多。', '请等待 1 分钟后继续生成。');
  if (error instanceof OpenAI.APIError && [401, 403, 404].includes(error.status || 0)) return new GenerationRequestError('AI_SERVICE_NOT_CONFIGURED', 503, 'AI 服务当前不可用。', '请联系管理员处理，无需修改课堂记录。');
  const reason = error instanceof Error && error.name === 'APIConnectionTimeoutError'
    ? 'AI 服务本次响应超时。'
    : 'AI 服务本次没有完成生成。';
  return new GenerationRequestError('AI_GENERATION_FAILED', 502, reason);
}

export async function generateReportOutline(input: GenerationInput) {
  const context = createPromptContext(input);
  const client = createOpenAiClient();
  const examTrainingGuidance = input.subjectCode === 'sat_math' && input.satMathHours
    ? `老师已在 integrated_practice 中锁定 ${input.satMathHours.integrated_practice} 小时综合训练、Bluebook 模考与复盘，只能在这些课时中安排相应活动，不套用通用 20% 规则。`
    : input.includeExamTraining
      ? '老师已勾选考试训练，课程阶段必须安排 MCQ、FRQ、模考、真题讲评、错题订正或考试策略等考试训练，考试训练时长不少于总课时的 20%。'
      : '老师未勾选考试训练，不要为了凑结构强行安排模考或考试讲评。';
  const systemPrompt = `${buildSystemPrompt(context.subject)}

本次只生成报告摘要与课程阶段骨架，不生成详细 lessons。所有关于学生课堂行为、答题过程、提示前后变化和已掌握内容的陈述，都必须能在 teacherNotes 中找到直接依据；不得把未来课程计划改写成已经发生的课堂事实。每个阶段最多 10 个课次，所有 stage.lessonCount 之和必须严格等于 ${context.lessonDurations.length}。${examTrainingGuidance}`;
  const userPrompt = `${buildUserInput(context.subject, context.promptData)}

请返回摘要字段、coursePlan.rationale，以及只含 title、description、lessonCount 的阶段数组。`;
  try {
    const outline = await requestStructuredOutput(client, generationOutlineSchema, 'trial_report_outline', systemPrompt, userPrompt, 9000, normalizeOutlineResult);
    if (!outline) throw new GenerationRequestError('EMPTY_MODEL_OUTPUT', 502, 'AI 没有返回可用的阶段规划。');
    const guardedOutline = applyClassroomFactGuard(outline, context.subject.displayName, input.teacherNotes);
    const plannedCount = guardedOutline.stages.reduce((total, stage) => total + stage.lessonCount, 0);
    if (plannedCount !== context.lessonDurations.length) {
      throw new GenerationRequestError('OUTLINE_LESSON_COUNT_MISMATCH', 422, `阶段规划共 ${plannedCount} 个课次，与要求的 ${context.lessonDurations.length} 个课次不一致。`);
    }
    let durationIndex = 0;
    const stages = guardedOutline.stages.map((stage) => {
      const durations = context.lessonDurations.slice(durationIndex, durationIndex + stage.lessonCount);
      const startLessonNumber = durationIndex + 1;
      durationIndex += stage.lessonCount;
      return { ...stage, durations, startLessonNumber };
    });
    return { outline: { ...guardedOutline, stages } as GenerationOutlineResult, targetScore: context.targetScore };
  } catch (error) {
    throw normalizeGenerationError(error);
  }
}

export async function generateReportStage(input: StageGenerationRequest) {
  const context = createPromptContext(input);
  if (input.stage.lessonCount !== input.durations.length) {
    throw new GenerationRequestError('STAGE_LESSON_COUNT_MISMATCH', 400, '当前阶段的课次和时长数量不一致。');
  }
  const allowedUnitCodes = getAllowedUnitCodes(input.subjectCode, input.planningScenario, input.teacherNotes);
  const satMathLessonAllocations = input.subjectCode === 'sat_math' && input.satMathHours
    ? buildSatMathLessonAllocations(input.satMathHours, context.lessonDurations).slice(input.startLessonNumber - 1, input.startLessonNumber - 1 + input.stage.lessonCount)
    : input.durations.map(() => []);
  const endLessonNumber = input.startLessonNumber + input.stage.lessonCount - 1;
  const examTrainingGuidance = input.subjectCode === 'sat_math' && input.satMathHours
    ? '严格按照 satMathLessonAllocations 安排综合训练、Bluebook 模考与复盘，不套用通用 20% 规则。'
    : input.includeExamTraining
      ? '如果本阶段属于考试训练阶段，明确安排 MCQ、FRQ、模考、真题讲评、错题订正或考试策略；整个规划的考试训练时长需达到总课时的 20%。'
      : '未勾选考试训练时，按学生同步学习和知识点需要安排课程，不强行加入模考或考试讲评。';
  const systemPrompt = `${buildSystemPrompt(context.subject)}

本次只生成一个课程阶段的详细课次，不生成报告摘要或其他阶段。必须严格返回 ${input.stage.lessonCount} 个 lessons，对应完整报告第 ${input.startLessonNumber}–${endLessonNumber} 课。课程规划可以安排未来教学任务，但不得新增或推断学生已经出现过的具体错误、课堂动作、正确率或提示后表现。每节课都必须返回 satMathAllocations；SAT 数学严格原样返回输入中对应项并据此设计内容，其他科目返回空数组。${examTrainingGuidance}`;
  const userPrompt = `根据老师记录和阶段信息生成这一批课程：
${JSON.stringify({
    subject: context.subject.displayName,
    teacherNotes: input.teacherNotes,
    planningScenario: input.planningScenario,
    stageIndex: input.stageIndex,
    stageCount: input.stageCount,
    stage: input.stage,
    previousStageTitle: input.previousStageTitle || null,
    nextStageTitle: input.nextStageTitle || null,
    lessonNumberRange: [input.startLessonNumber, endLessonNumber],
    durations: input.durations,
    satMathLessonAllocations,
    allowedUnitCodes,
  }, null, 2)}

只返回 lessons 数组。每个 lesson 必须包含 theme、content、difficulty、goal、unitCodes、satMathAllocations，并保持相邻课次内容递进且不重复。`;
  try {
    const client = createOpenAiClient();
    const stageResult = await requestStructuredOutput(client, generationStageResultSchema, 'trial_report_stage', systemPrompt, userPrompt, 8000, (value) => normalizeStageResult(value, allowedUnitCodes));
    if (!stageResult) throw new GenerationRequestError('EMPTY_MODEL_OUTPUT', 502, 'AI 没有返回可用的阶段课次。');
    if (stageResult.lessons.length !== input.stage.lessonCount) {
      throw new GenerationRequestError('STAGE_LESSON_COUNT_MISMATCH', 422, `当前阶段应生成 ${input.stage.lessonCount} 个课次，AI 实际返回 ${stageResult.lessons.length} 个。`);
    }
    if (input.subjectCode === 'sat_math') {
      const allocationMismatch = stageResult.lessons.some((lesson, index) => {
        const actual = [...lesson.satMathAllocations].sort((first, second) => first.code.localeCompare(second.code));
        const expected = [...satMathLessonAllocations[index]].sort((first, second) => first.code.localeCompare(second.code));
        return JSON.stringify(actual) !== JSON.stringify(expected);
      });
      if (allocationMismatch) throw new GenerationRequestError('SAT_MATH_HOURS_MISMATCH', 422, 'AI 没有严格遵守老师填写的 SAT 数学领域课时分配。');
    }
    const isApSubject = context.subject.code.startsWith('ap_');
    const invalidUnitCode = isApSubject
      ? stageResult.lessons.flatMap((lesson) => lesson.unitCodes).find((code) => !allowedUnitCodes.includes(code))
      : undefined;
    if (invalidUnitCode || (isApSubject && stageResult.lessons.some((lesson) => lesson.unitCodes.length === 0))) {
      throw new GenerationRequestError('INVALID_UNIT_CODE', 422, '当前阶段包含无效或缺失的 AP Unit 编码。');
    }
    return {
      lessons: stageResult.lessons.map((lesson, index) => {
        const { satMathAllocations: unusedAllocations, ...lessonContent } = lesson;
        return {
          ...lessonContent,
          unitCodes: isApSubject ? lesson.unitCodes : [],
          duration: input.durations[index],
        };
      }) as GenerationLesson[],
    };
  } catch (error) {
    throw normalizeGenerationError(error);
  }
}
