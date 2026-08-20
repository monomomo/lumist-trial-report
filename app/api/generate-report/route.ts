import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SUBJECT_CODES, resolveSubject, validateSubjectScores } from '@/lib/subjects/catalog';
import { buildSystemPrompt, buildUserInput } from '@/lib/subjects/prompt';
import { hasSubjectScopeViolation } from '@/lib/subjects/scope';
import { getCoursePlanQualityIssues, getCoursePlanWordingIssues } from '@/lib/subjects/course-plan-quality';
import { applyLessonDurationSlots, buildLessonDurationSlots } from '@/lib/subjects/lesson-slots';
import { PLANNING_FOCUS_AREA_CODES, PLANNING_SCENARIO_CODES, normalizePlanningFocusAreas } from '@/lib/reports/planning-context';
import { reviewCalculusSyllabusCoverage } from '@/lib/subjects/ap-calculus-syllabus.js';
import { hasUnnaturalTeacherPerspective, normalizeTeacherPerspective } from '@/lib/reports/teacher-perspective';
import { createGenerationDiagnostics, type GenerationStage } from '@/lib/reports/generation-diagnostics';
import { getGenerationFailureDetails } from '@/lib/reports/generation-failures';
import { getUnexpectedLanguageIssues } from '@/lib/reports/language-quality';
import { getAuthResult, AUTH_STATUS } from '@/lib/auth/current-user';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** @see {@link https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic} */
export const dynamic = 'force-dynamic';

const lessonSchema = z.object({
  theme: z.string().min(2).max(36),
  content: z.string().min(8).max(105),
  difficulty: z.string().min(8).max(105),
  goal: z.string().min(8).max(80),
  unitCodes: z.array(z.string().min(1).max(20)).max(10)
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
  priorityAreas: z.array(z.string().min(2).max(80)).min(2).max(6),
  coursePlan: z.object({
    rationale: z.string().min(20).max(180),
    stages: z.array(z.object({
      title: z.string().min(4).max(50),
      description: z.string().min(10).max(100),
      lessons: z.array(lessonSchema).min(1).max(12)
    })).min(1).max(6)
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
  totalHours: z.coerce.number().min(2).max(60).multipleOf(0.5),
  lessonCount: z.coerce.number().int().min(1).max(60),
  planningScenario: z.enum(PLANNING_SCENARIO_CODES as [string, ...string[]]),
  planningFocusAreas: z.array(z.enum(PLANNING_FOCUS_AREA_CODES as [string, ...string[]])).max(3).optional().default([]),
  teacherNotes: z.string().trim().min(20).max(6000),
  subjectCode: z.enum(SUBJECT_CODES as [string, ...string[]]).optional().default('sat_math')
});

async function readRequestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizePlanTitle(value: string) {
  let normalized = value.trim().replace(/[、，,/]+$/g, '').trim();
  const openingCount = (normalized.match(/[（(]/g) || []).length;
  const closingCount = (normalized.match(/[）)]/g) || []).length;
  if (openingCount > closingCount) normalized = normalized.replace(/[（(][^）)]*$/g, '').trim();
  return normalized || '课堂任务';
}

function normalizeRationale(value: string) {
  const normalized = value.replace(/[^。；]*\d+(?:\.\d+)?\s*(?:小时|h)[^。；]*[。；]?/gi, '').trim();
  return normalized || '后续课时将依据诊断测试、课堂掌握情况、错题类型与每题用时动态调整。';
}

function limitText(value: string, maximum: number) {
  const normalized = value.trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).replace(/[，。；、,:：\s]+$/g, '')}。`;
}

const parentFacingForbiddenPattern = /老师原始记录|原始课堂记录|原始记录|老师短评|老师评语|老师记录|教师记录|课堂观察（老师记录）|课堂记录信息|输入中没有|已知事实|信息不足|信息有限|无法判断|未能获得|没有完整|缺少数据|缺乏.{0,8}数据|记录较少|未记录|未提供|暂无数据|尚无数据|无可用.{0,8}数据|不构成正式|可量化|本报告|报告严格依据|报告依据|报告整理|本次.{0,12}记录整理|本次记录显示|依据老师|根据老师|需.{0,8}老师确认|需.{0,8}诊断确认|需要.{0,8}诊断确认/;
const thirdPersonTeacherPattern = /(?:任课)?老师|教师/;
const lessonTitleProcessPattern = /学情报告|课程规划|初版|\d+(?:\.\d+)?\s*(?:小时|h)/i;

function getInputCompleteness(notes: string) {
  return {
    hasSpecificContent: /单元|章节|考点|题目|方程|不等式|函数|多项式|二次|指数|比率|百分比|概率|统计|数据表|几何|三角|圆|极限|导数|积分|级数|参数方程|极坐标|Java|代码|供需|市场|政策|汇率|Desmos|Module|Bluebook|Parametric|Polar|Vector|Series|ArrayList|Recursion|MCQ|FRQ/i.test(notes),
    hasClassroomObservation: /互动|思考|正确率|准确率|做对|做错|理解|反应|速度|用时|卡住|薄弱|熟练|遗忘|积极|专注/i.test(notes)
  };
}

function getParentVoiceIssues(report: z.infer<typeof reportSchema>) {
  const summaryTexts = [
    report.overview,
    report.classroomStatus,
    report.strength,
    report.currentFocus,
    report.lessonTitle,
    report.lessonSummary,
    report.performance,
    ...report.outcomes,
    ...report.priorityAreas,
  ];
  const planTexts = [
    report.coursePlan.rationale,
    ...report.coursePlan.stages.flatMap((stage) => [
      stage.title,
      stage.description,
      ...stage.lessons.flatMap((lesson) => [lesson.theme, lesson.content, lesson.difficulty, lesson.goal]),
    ]),
  ];
  const issues: string[] = [];
  if ([...summaryTexts, ...planTexts].some((value) => parentFacingForbiddenPattern.test(value))) {
    issues.push('家长可见内容暴露了原始记录、信息缺失、报告整理或诊断确认等生成过程');
  }
  if (summaryTexts.some((value) => thirdPersonTeacherPattern.test(value))) {
    issues.push('家长可见内容使用“老师、教师”第三者口吻，没有采用任课老师本人视角');
  }
  if (summaryTexts.some(hasUnnaturalTeacherPerspective)) {
    issues.push('家长可见内容出现“我是……的我”等不自然的教师自称');
  }
  if (lessonTitleProcessPattern.test(report.lessonTitle)) {
    issues.push('lessonTitle 写成了学情报告、课程规划或总课时标题，而不是本节试听内容');
  }
  return issues;
}

function sanitizeParentReport(report: z.infer<typeof reportSchema>, subjectCode: string) {
  const subject = resolveSubject(subjectCode);
  const safeOverview = `本次试听课中，我先了解了学生目前与 ${subject.displayName} 课程的衔接情况。接下来我会通过具体任务继续观察知识掌握、作答过程和易错点，再据此调整后续课时重点。`;
  const safeClassroomStatus = '本节课主要用于了解学生当前的学习衔接和作答习惯，接下来我会结合具体任务继续观察。';
  const safeStrength = '我会通过后续练习确认学生已经稳定掌握的内容，并据此减少重复训练。';
  const safeCurrentFocus = `接下来我会先完成 ${subject.displayName} 的基础诊断，再根据具体错因安排训练重点。`;
  const safeLessonTitle = `${subject.displayName}课堂衔接与学习诊断`;
  const safeLessonSummary = `本节课中，我主要了解了学生与 ${subject.displayName} 课程的衔接情况。接下来我会安排有明确作答过程的练习，观察学生对概念、方法和题型的实际掌握，再细化后续教学安排。`;
  const safePerformance = '本节课先以课堂交流和学习衔接为主。接下来我会通过具体练习观察学生的理解、作答步骤和订正情况。';
  const sanitizeText = (value: string, fallback: string) => {
    if (parentFacingForbiddenPattern.test(value)) return fallback;
    return normalizeTeacherPerspective(value);
  };
  const safeOutcomes = [
    `我已初步了解学生与 ${subject.displayName} 课程的衔接情况`,
    '学生明确了接下来课堂练习的重点',
    '我会根据后续作答过程和错因继续调整教学安排'
  ];
  const outcomes = report.outcomes
    .filter((item) => !parentFacingForbiddenPattern.test(item))
    .map(normalizeTeacherPerspective);
  safeOutcomes.forEach((item) => { if (outcomes.length < 3 && !outcomes.includes(item)) outcomes.push(item); });
  const priorityAreas = report.priorityAreas
    .filter((item) => !parentFacingForbiddenPattern.test(item))
    .map(normalizeTeacherPerspective);
  if (priorityAreas.length < 2) priorityAreas.push(`${subject.displayName}学习基础诊断`, '作答过程与错因分析');
  const normalizedCoursePlan = {
    ...report.coursePlan,
    rationale: sanitizeText(report.coursePlan.rationale, '我会根据后续诊断、课堂作答、错题类型和完成时间调整课时重点。'),
    stages: report.coursePlan.stages.map((stage) => ({
      ...stage,
      title: stage.title,
      description: stage.description,
      lessons: stage.lessons.map((lesson) => ({
        ...lesson,
        theme: lesson.theme,
        content: lesson.content,
        difficulty: lesson.difficulty,
        goal: lesson.goal,
      })),
    })),
  };

  return {
    ...report,
    overview: sanitizeText(report.overview, safeOverview),
    classroomStatus: sanitizeText(report.classroomStatus, safeClassroomStatus),
    strength: sanitizeText(report.strength, safeStrength),
    currentFocus: sanitizeText(report.currentFocus, safeCurrentFocus),
    lessonTitle: lessonTitleProcessPattern.test(report.lessonTitle) ? safeLessonTitle : sanitizeText(report.lessonTitle, safeLessonTitle),
    lessonSummary: sanitizeText(report.lessonSummary, safeLessonSummary),
    performance: sanitizeText(report.performance, safePerformance),
    outcomes: outcomes.slice(0, 5),
    priorityAreas: [...new Set(priorityAreas)].slice(0, 6),
    coursePlan: normalizedCoursePlan,
  };
}

function buildTeacherNotice(notes: string) {
  const { hasSpecificContent, hasClassroomObservation } = getInputCompleteness(notes);
  const missing = [];
  if (!hasSpecificContent) missing.push('具体考点或课堂练习');
  if (!hasClassroomObservation) missing.push('学生课堂表现或作答情况');
  return missing.length ? `当前课堂记录较为简略，家长版已采用保守表达。建议补充${missing.join('、')}，以生成更有针对性的报告。` : '';
}

export async function POST(request: Request) {
  const diagnostics = createGenerationDiagnostics();
  let stage: GenerationStage = 'configuration';
  let subjectCode: string | undefined;
  let lessonCount: number | undefined;
  let repairAttempted = false;
  const failureResponse = (
    errorCode: string,
    status: number,
    options: { issues?: readonly unknown[]; errorType?: string } = {},
  ) => {
    const details = getGenerationFailureDetails(errorCode, options.issues);
    diagnostics.record('failed', {
      stage,
      subjectCode,
      lessonCount,
      errorCode,
      errorType: options.errorType,
      repairAttempted,
      issueCount: options.issues?.length,
    });
    return NextResponse.json({
      error: errorCode,
      requestId: diagnostics.requestId,
      reason: details.reason,
      suggestion: details.suggestion,
      ...(options.issues ? { issues: options.issues } : {}),
    }, {
      status,
      headers: { 'x-request-id': diagnostics.requestId },
    });
  };

  try {
    diagnostics.record('started', { stage });
    stage = 'authentication';
    const auth = await getAuthResult();
    if (auth.status === AUTH_STATUS.SUPABASE_NOT_CONFIGURED) {
      return failureResponse('SYSTEM_NOT_CONFIGURED', 503);
    }
    if (auth.status === AUTH_STATUS.NOT_AUTHENTICATED) {
      return failureResponse('UNAUTHORIZED', 401);
    }

    stage = 'configuration';
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return failureResponse('AI_SERVICE_NOT_CONFIGURED', 503);
    }

    stage = 'request_validation';
    const parsed = requestSchema.safeParse(await readRequestBody(request));
    if (!parsed.success) {
      return failureResponse('INVALID_INPUT', 400);
    }

    const subject = resolveSubject(parsed.data.subjectCode);
    subjectCode = subject.code;
    const planningFocusAreas = normalizePlanningFocusAreas(parsed.data.planningFocusAreas, subject.code);
    if (planningFocusAreas.length !== parsed.data.planningFocusAreas.length) {
      return failureResponse('INVALID_PLANNING_FOCUS', 400);
    }
    const targetScore = parsed.data.targetScore || (subject.code.startsWith('ap_') ? '5' : '');
    const scoreValidation = validateSubjectScores(subject.code, parsed.data.currentScore, targetScore);
    if (!scoreValidation.valid) {
      return failureResponse('INVALID_SCORE', 400, { issues: scoreValidation.errors });
    }
    let lessonDurations;
    try {
      lessonDurations = buildLessonDurationSlots(parsed.data.totalHours, parsed.data.lessonCount);
    } catch {
      return failureResponse('INVALID_LESSON_COUNT', 400);
    }
    lessonCount = lessonDurations.length;
    const promptData = {
      ...parsed.data,
      targetScore,
      planningFocusAreas,
      lessonDurations,
    };

    const client = new OpenAI({
      apiKey,
      timeout: 240000,
      maxRetries: 0
    });
    const generateModelReport = async (repair?: {
      report: z.infer<typeof reportSchema>;
      issues: string[];
    }) => {
      const input = [
        { role: 'system' as const, content: buildSystemPrompt(subject) },
        { role: 'user' as const, content: buildUserInput(subject, promptData) },
      ];
      if (repair) {
        input.push({
          role: 'user',
          content: `上一版报告未通过校验。保留没有问题的字段，只修改与下列问题直接相关的内容，并重新返回完整结构。

校验问题：
${repair.issues.map((issue) => `- ${issue}`).join('\n')}

上一版报告：
<previous_report>
${JSON.stringify(repair.report)}
</previous_report>`,
        });
      }
      const response = await client.responses.parse({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        input,
        text: { format: zodTextFormat(reportSchema, 'trial_report') },
        reasoning: { effort: lessonDurations.length >= 20 ? 'medium' : 'low' },
        max_output_tokens: Math.min(16000, Math.max(8000, 4500 + lessonDurations.length * 300))
      });
      return response.output_parsed;
    };

    stage = 'model_generation';
    let modelReport = await generateModelReport();
    if (!modelReport) {
      return failureResponse('EMPTY_MODEL_OUTPUT', 502);
    }
    const reviewReport = (report: z.infer<typeof reportSchema>) => {
      const issues = [];
      if (hasSubjectScopeViolation(subject.code, report)) {
        issues.push(`内容只能使用 ${subject.displayName} 的模块和术语`);
      }
      issues.push(...getCoursePlanQualityIssues(report, subject.code, lessonDurations.length));
      issues.push(...getParentVoiceIssues(report));
      const syllabusReview = reviewCalculusSyllabusCoverage(
        report,
        subject.code,
        parsed.data.planningScenario,
        parsed.data.teacherNotes,
      );
      issues.push(...syllabusReview.hardIssues, ...syllabusReview.warnings);
      issues.push(...getUnexpectedLanguageIssues(report));
      return issues;
    };
    stage = 'quality_validation';
    let reviewIssues = reviewReport(modelReport);
    if (reviewIssues.length > 0) {
      repairAttempted = true;
      stage = 'quality_repair';
      diagnostics.record('repair_requested', {
        stage,
        subjectCode,
        lessonCount,
        issueCount: reviewIssues.length,
        repairAttempted,
      });
      modelReport = await generateModelReport({
        report: modelReport,
        issues: reviewIssues,
      });
    }
    if (!modelReport) {
      return failureResponse('EMPTY_MODEL_OUTPUT', 502);
    }
    stage = 'quality_validation';
    reviewIssues = reviewReport(modelReport);
    const finalLanguageIssues = getUnexpectedLanguageIssues(modelReport);
    if (finalLanguageIssues.length) {
      return failureResponse('UNEXPECTED_LANGUAGE', 502, { issues: finalLanguageIssues });
    }
    const finalWordingIssues = getCoursePlanWordingIssues(modelReport);
    if (finalWordingIssues.length) {
      return failureResponse('COURSE_PLAN_STYLE_REPETITION', 502, { issues: finalWordingIssues });
    }
    const finalSyllabusReview = reviewCalculusSyllabusCoverage(
      modelReport,
      subject.code,
      parsed.data.planningScenario,
      parsed.data.teacherNotes,
    );
    if (finalSyllabusReview.hardIssues.length) {
      return failureResponse('SYLLABUS_COVERAGE_VIOLATION', 502, { issues: finalSyllabusReview.hardIssues });
    }
    if (hasSubjectScopeViolation(subject.code, modelReport)) {
      return failureResponse('SUBJECT_SCOPE_VIOLATION', 502);
    }
    const generatedLessonCount = modelReport.coursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
    if (generatedLessonCount !== lessonDurations.length) {
      return failureResponse('REPORT_QUALITY_FAILED', 502, {
        issues: [`课程规划应生成 ${lessonDurations.length} 个课时块，实际生成了 ${generatedLessonCount} 个`],
      });
    }
    if (reviewIssues.length > 0) {
      diagnostics.record('accepted_with_warnings', {
        stage,
        subjectCode,
        lessonCount,
        issueCount: reviewIssues.length,
        repairAttempted,
      });
    }

    stage = 'response_assembly';
    const parentReport = sanitizeParentReport(modelReport, subject.code);
    const normalizedPriorityAreas = [...new Set(parentReport.priorityAreas.map(normalizePlanTitle))].slice(0, 6);
    const normalizedStages = parentReport.coursePlan.stages.map((stage) => ({
      ...stage,
      title: normalizePlanTitle(stage.title),
      description: limitText(stage.description, 100),
      lessons: stage.lessons.map((lesson) => ({
        ...lesson,
        theme: limitText(normalizePlanTitle(lesson.theme), 36),
        content: limitText(lesson.content, 105),
        difficulty: limitText(lesson.difficulty, 105),
        goal: limitText(lesson.goal, 80)
      }))
    }));
    const stages = applyLessonDurationSlots(normalizedStages, lessonDurations);
    const finalReport = {
      ...parentReport,
      priorityAreas: normalizedPriorityAreas,
      teacherNotice: buildTeacherNotice(parsed.data.teacherNotes),
      coursePlan: {
        ...parentReport.coursePlan,
        rationale: limitText(normalizeRationale(parentReport.coursePlan.rationale), 180),
        stages,
        totalHours: parsed.data.totalHours
      }
    };
    const finalModelWarnings = [
      ...getCoursePlanQualityIssues(finalReport, subject.code, lessonDurations.length),
      ...finalSyllabusReview.warnings,
    ];
    const finalTeacherVoiceIssues = getParentVoiceIssues(finalReport);

    diagnostics.record('succeeded', {
      stage,
      subjectCode,
      lessonCount,
      repairAttempted,
    });
    return NextResponse.json({
      generated: true,
      requestId: diagnostics.requestId,
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      report: {
        ...finalReport,
        planningContext: {
          scenario: parsed.data.planningScenario,
          lessonCount: parsed.data.lessonCount,
          focusAreas: planningFocusAreas,
        },
        qualityReview: {
          reviewCompleted: true,
          subjectScopePassed: !hasSubjectScopeViolation(subject.code, finalReport),
          teacherVoicePassed: finalTeacherVoiceIssues.length === 0,
          modelWarnings: [...finalModelWarnings, ...finalTeacherVoiceIssues]
        }
      }
    }, {
      headers: { 'x-request-id': diagnostics.requestId },
    });
  } catch (error) {
    return failureResponse('AI_GENERATION_FAILED', 502, {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}
