import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
  accessCode: z.string().max(100).optional().default('')
});

const systemPrompt = `你是路觅教育的资深 SAT 数学教研老师。你的任务是把老师的自然语言试听课记录整理成专业、克制、可直接交付家长的学情报告，并生成供销售内部使用的跟进建议。

必须遵守：
1. 只把输入中明确出现的信息写成已知事实，不编造成绩、考试日期、正确率百分比、诊断结果或课堂活动。
2. 区分“本次课堂观察”和“后续建议”，不要把一次试听表现等同于正式考试能力。
3. 课程规划仅针对 SAT 数学，必须覆盖诊断、知识模块、Desmos、限时训练、套题复盘与考前闭环，但根据学生实际情况调整比重。
4. 总课时必须由学生当前水平、目标分数、考试日期与薄弱点综合决定，不固定为 30 小时。每个课时块可为 0.5、1、1.5 或 2 小时；适合连续讲授的知识点不要强行拆成 1 小时。
5. 每个课时块都要写清主题、授课内容、重难点和目标。内容要具体到 SAT 数学考点或训练动作，避免“查漏补缺”等空话单独成项。
6. 对未知信息不要自行补齐，应将信息缺口转化为后续教学动作，但不得在家长版中解释老师输入不完整。
7. 家长报告语气专业、清晰、鼓励但不过度承诺。销售话术突出最急迫提升点和续课价值，但不得承诺具体提分结果或制造焦虑。
8. 使用自然、具体的中文，保留必要的 SAT、Bluebook、Desmos、Module、Algebra 等术语。
9. 必须严格依据当前 Digital SAT 数学考试：共 44 题、70 分钟，分为两个各 35 分钟的自适应 Module；整个数学部分均可使用计算器，并内置 Desmos。禁止使用旧版 SAT 的“无计算器部分”“有计算器部分”等表述。
10. 课程内容仅限当前官方四大 Domain：Algebra、Advanced Math、Problem-Solving and Data Analysis、Geometry and Trigonometry。具体考点必须符合 College Board 当前范围，不得加入排列组合、函数复合与反函数等非官方核心考点。
11. 概率内容应聚焦概率与条件概率、表格或情境建模；几何与三角应聚焦面积体积、直线角与三角形、直角三角形与三角函数、圆。限时训练应以 35 分钟 Module 或其合理拆分为依据。
12. Bluebook 诊断应表述为官方自适应数字化练习测试；如果只安排数学部分，应明确为两个数学 Module，不得编造纸笔版分区。
13. coursePlan.rationale 只说明动态调整依据，不得出现任何固定总课时数字或另一套课时方案。系统会根据所有 lesson.duration 自动计算并展示唯一总课时。
14. 每个阶段标题与课时主题必须是语义完整的短句，不得以顿号、逗号、斜杠或未闭合括号结尾。
15. 家长版字段不得出现“老师原始记录、老师只写了、老师仅提到、老师未提供、老师未列出、输入中没有、信息不足、信息有限、无法判断、未能获得、没有完整记录、缺少数据、记录较少”等暴露输入质量或系统处理过程的表达。
16. 不得向家长解释为什么无法生成更详细的内容，不得使用括号补充“老师未列出具体考点”等内部备注。
17. 如果老师只提供授课模块，没有具体考点，应提升一个层级概括本节内容，不得编造具体题目或学生表现。
18. 如果没有学生表现、正确率或答题数据，直接省略相关评价，不得写“没有表现信息”，也不得生成虚假的积极评价。
19. 信息不足时应自然转化为后续动作，例如“后续将结合 Bluebook 数学模块诊断，进一步明确具体优势与需要强化的考点”。
20. lessonSummary 只回答本节围绕什么内容展开、这部分内容在 SAT 学习中的作用以及后续如何细化，使用两到三句连贯、可直接给家长阅读的文字。
21. overview、classroomStatus、strength、lessonSummary、performance、outcomes 和 priorityAreas 均属于家长版内容，必须保持专业、自然、积极、克制，不暴露原始输入、字段缺失或系统判断过程。
22. salesFollowUp 属于内部内容，可以提醒销售或老师后续补充信息，但不得编造任何学生事实。`;

function buildInput(data: z.infer<typeof requestSchema>) {
  return `请根据以下信息生成 SAT 数学试听课报告：

学生姓名：${data.studentName}
当前 SAT 数学成绩：${data.currentScore || '未提供'}
目标成绩：${data.targetScore || '未提供'}
目标考试日期：${data.examDate || '未提供'}

老师原始记录：
${data.teacherNotes}`;
}

function normalizePlanTitle(value: string) {
  let normalized = value.trim().replace(/[、，,/]+$/g, '').trim();
  const openingCount = (normalized.match(/[（(]/g) || []).length;
  const closingCount = (normalized.match(/[）)]/g) || []).length;
  if (openingCount > closingCount) normalized = normalized.replace(/[（(][^）)]*$/g, '').trim();
  return normalized || '专项训练';
}

function normalizeRationale(value: string) {
  const normalized = value.replace(/[^。；]*\d+(?:\.\d+)?\s*(?:小时|h)[^。；]*[。；]?/gi, '').trim();
  return normalized || '后续课时将依据 Bluebook 诊断、课堂掌握情况、错题类型与每题用时动态调整。';
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

function sanitizeParentReport(report: z.infer<typeof reportSchema>, notes: string) {
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
  const requiredAccessCode = process.env.REPORT_ACCESS_CODE;

  if (!apiKey) {
    return NextResponse.json({ error: 'AI_SERVICE_NOT_CONFIGURED' }, { status: 503 });
  }

  if (!requiredAccessCode) {
    return NextResponse.json({ error: 'ACCESS_CODE_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    if (parsed.data.accessCode !== requiredAccessCode) {
      return NextResponse.json({ error: 'INVALID_ACCESS_CODE' }, { status: 401 });
    }

    const client = new OpenAI({
      apiKey,
      timeout: 240000,
      maxRetries: 0
    });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildInput(parsed.data) }
      ],
      text: { format: zodTextFormat(reportSchema, 'sat_trial_report') },
      reasoning: { effort: 'low' },
      max_output_tokens: 8000
    });

    if (!response.output_parsed) {
      return NextResponse.json({ error: 'EMPTY_MODEL_OUTPUT' }, { status: 502 });
    }

    const parentReport = sanitizeParentReport(response.output_parsed, parsed.data.teacherNotes);
    const stages = parentReport.coursePlan.stages.map((stage) => ({
      ...stage,
      title: normalizePlanTitle(stage.title),
      lessons: stage.lessons.map((lesson) => ({ ...lesson, theme: normalizePlanTitle(lesson.theme) }))
    }));
    const totalHours = stages.reduce((sum, stage) => sum + stage.lessons.reduce((stageSum, lesson) => stageSum + lesson.duration, 0), 0);

    return NextResponse.json({
      generated: true,
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      report: {
        ...parentReport,
        teacherNotice: buildTeacherNotice(parsed.data.teacherNotes),
        coursePlan: {
          ...parentReport.coursePlan,
          rationale: normalizeRationale(parentReport.coursePlan.rationale),
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
