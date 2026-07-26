import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSubject } from '@/lib/subjects/catalog';
import { buildSystemPrompt, buildUserInput } from '@/lib/subjects/prompt';
import { hasSubjectScopeViolation } from '@/lib/subjects/scope';
import { getCoursePlanQualityIssues } from '@/lib/subjects/course-plan-quality';
import { getAuthResult, AUTH_STATUS } from '@/lib/auth/current-user';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** @see {@link https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic} */
export const dynamic = 'force-dynamic';

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
  priorityAreas: z.array(z.string().min(2).max(80)).min(2).max(6),
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
  totalHours: z.coerce.number().min(2).max(60).multipleOf(0.5),
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

function limitText(value: string, maximum: number) {
  const normalized = value.trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).replace(/[，。；、,:：\s]+$/g, '')}。`;
}

function distributeLessonDurations<T extends { lessons: Array<{ duration: number }> }>(stages: T[], totalHours: number): T[] {
  const lessonCount = stages.reduce((total, stage) => total + stage.lessons.length, 0);
  const targetUnits = totalHours * 2;
  if (targetUnits < lessonCount || targetUnits > lessonCount * 4) {
    throw new RangeError('COURSE_PLAN_LESSON_COUNT_MISMATCH');
  }
  const baseUnits = Math.floor(targetUnits / lessonCount);
  let remainder = targetUnits - baseUnits * lessonCount;
  return stages.map((stage) => ({
    ...stage,
    lessons: stage.lessons.map((lesson) => {
      const units = baseUnits + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return { ...lesson, duration: units / 2 };
    })
  }));
}

const parentFacingForbiddenPattern = /老师原始记录|老师只写|老师仅|老师未提供|老师未列出|输入中没有|信息不足|信息有限|无法判断|未能获得|没有完整|缺少数据|记录较少|未记录|未提供|暂无数据|尚无数据|课堂记录|观察记录|不构成正式|可量化/;

function getTopicContext(notes: string) {
  const topics = [];
  if (/代数|Algebra/i.test(notes)) topics.push('代数');
  if (/函数|Advanced Math/i.test(notes)) topics.push('函数与高阶数学');
  if (/概率|数据|统计|Problem-Solving/i.test(notes)) topics.push('数据分析与概率');
  if (/几何|三角|Geometry|Trigonometry/i.test(notes)) topics.push('几何与三角');
  if (/Desmos/i.test(notes)) topics.push('Desmos 工具应用');
  const uniqueTopics = [...new Set(topics)];
  const label = uniqueTopics.length ? uniqueTopics.slice(0, 3).join('、') : 'SAT 数学核心内容';
  return {
    label,
    module: uniqueTopics.length ? `SAT 数学${label}模块` : 'SAT 数学核心内容',
    training: uniqueTopics.length ? `${label}相关题型` : '相关题型'
  };
}

function getInputCompleteness(notes: string) {
  return {
    hasSpecificContent: /方程|不等式|函数|多项式|二次|指数|比率|百分比|概率|条件概率|统计|数据表|几何|三角|圆|Desmos|Module|Bluebook/i.test(notes),
    hasClassroomObservation: /互动|思考|正确率|准确率|做对|做错|理解|反应|速度|用时|卡住|薄弱|熟练|遗忘|积极|专注/i.test(notes)
  };
}

function sanitizeParentReport(report: z.infer<typeof reportSchema>, notes: string, subjectCode: string) {
  if (subjectCode !== 'sat_math') return report;
  const topic = getTopicContext(notes);
  const completeness = getInputCompleteness(notes);
  const safeOverview = `本次试听课围绕 ${topic.module} 展开，帮助学生初步熟悉相关知识在考试中的呈现方式。后续将结合模块练习与 Bluebook 数学诊断，进一步明确具体学习重点并细化训练安排。`;
  const safeLessonSummary = `本节试听课围绕 ${topic.module} 展开，通过知识讲解与课堂练习，帮助学生初步熟悉相关知识在 SAT 考试中的呈现方式。后续将结合 Bluebook 数学模块诊断，进一步确认学生在不同题型中的掌握情况，并据此细化学习重点与训练安排。`;
  const safePerformance = `当前阶段以熟悉${topic.training}和建立解题框架为主，后续将结合模块练习持续观察学生的理解与应用情况。`;
  const sanitizeText = (value: string, fallback: string) => parentFacingForbiddenPattern.test(value) ? fallback : value;
  const safeOutcomes = [
    `初步了解 ${topic.module} 的学习方向`,
    `了解${topic.training}在考试中的基本呈现方式`,
    '明确后续将通过模块练习与 Bluebook 诊断细化学习安排'
  ];
  const outcomes = completeness.hasSpecificContent && completeness.hasClassroomObservation
    ? report.outcomes.filter((item) => !parentFacingForbiddenPattern.test(item))
    : [...safeOutcomes];
  safeOutcomes.forEach((item) => { if (outcomes.length < 3 && !outcomes.includes(item)) outcomes.push(item); });
  const priorityAreas = completeness.hasSpecificContent
    ? report.priorityAreas.filter((item) => !parentFacingForbiddenPattern.test(item))
    : [`${topic.label}模块考点梳理`, 'Bluebook 数学模块诊断', 'SAT 题型与考试节奏'];
  if (priorityAreas.length < 2) priorityAreas.push(`${topic.label}考点梳理`, 'Bluebook 模块诊断');

  return {
    ...report,
    overview: completeness.hasSpecificContent && completeness.hasClassroomObservation ? sanitizeText(report.overview, safeOverview) : safeOverview,
    classroomStatus: completeness.hasClassroomObservation ? sanitizeText(report.classroomStatus, '当前阶段以熟悉 SAT 数学考点框架与题型为主') : `本节课主要围绕 ${topic.module} 进行知识讲解与课堂练习`,
    strength: completeness.hasClassroomObservation ? sanitizeText(report.strength, '将在后续模块练习中进一步确认并持续巩固') : '后续将结合模块练习进一步确认学生的优势题型',
    currentFocus: completeness.hasSpecificContent ? sanitizeText(report.currentFocus, `${topic.label}考点梳理与题型熟悉`) : `${topic.label}模块框架与题型熟悉`,
    lessonTitle: completeness.hasSpecificContent ? sanitizeText(report.lessonTitle, `${topic.label}内容梳理`) : `${topic.label}模块导入与题型认识`,
    lessonSummary: completeness.hasSpecificContent ? sanitizeText(report.lessonSummary, safeLessonSummary) : safeLessonSummary,
    performance: completeness.hasClassroomObservation ? sanitizeText(report.performance, safePerformance) : safePerformance,
    outcomes: outcomes.slice(0, 5),
    priorityAreas: [...new Set(priorityAreas)].slice(0, 6)
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI_SERVICE_NOT_CONFIGURED' }, { status: 503 });
  }

  const auth = await getAuthResult();
  // Supabase 未配置时进入 demo 模式，跳过认证检查
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
    const generateModelReport = async (scopeReminder = '') => {
      const response = await client.responses.parse({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        input: [
          { role: 'system', content: `${buildSystemPrompt(subject)}${scopeReminder}` },
          { role: 'user', content: buildUserInput(subject, parsed.data) }
        ],
        text: { format: zodTextFormat(reportSchema, 'trial_report') },
        reasoning: { effort: 'low' },
        max_output_tokens: 8000
      });
      return response.output_parsed;
    };

    let modelReport = await generateModelReport();
    if (!modelReport) {
      return NextResponse.json({ error: 'EMPTY_MODEL_OUTPUT' }, { status: 502 });
    }
    const scopeViolation = hasSubjectScopeViolation(subject.code, modelReport);
    const qualityIssues = getCoursePlanQualityIssues(modelReport, subject.code);
    if (scopeViolation || qualityIssues.length > 0) {
      const retryRequirements: string[] = [];
      if (scopeViolation) retryRequirements.push(`只使用 ${subject.displayName} 的模块与术语，删除其他 SAT 或 AP 科目的专属内容`);
      if (qualityIssues.length > 0) retryRequirements.push(`重写整个 coursePlan，并解决这些问题：${qualityIssues.join('；')}`);
      modelReport = await generateModelReport(`\n13. 上一版未达到交付标准。本次必须${retryRequirements.join('；')}。不要只替换同义词，要让每节课体现真实教学任务、具体易错点和可检查结果。`);
    }
    if (!modelReport || hasSubjectScopeViolation(subject.code, modelReport)) {
      return NextResponse.json({ error: 'SUBJECT_SCOPE_VIOLATION' }, { status: 502 });
    }

    const parentReport = sanitizeParentReport(modelReport, parsed.data.teacherNotes, subject.code);
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
    const stages = distributeLessonDurations(normalizedStages, parsed.data.totalHours);
    const totalHours = stages.reduce((sum, stage) => sum + stage.lessons.reduce((stageSum, lesson) => stageSum + lesson.duration, 0), 0);

    return NextResponse.json({
      generated: true,
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      report: {
        ...parentReport,
        priorityAreas: normalizedPriorityAreas,
        teacherNotice: buildTeacherNotice(parsed.data.teacherNotes),
        coursePlan: {
          ...parentReport.coursePlan,
          rationale: limitText(normalizeRationale(parentReport.coursePlan.rationale), 180),
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
