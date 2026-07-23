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
6. 对未知信息使用稳妥表达，例如“建议通过首套 Bluebook 完整模考进一步确认”，不要自行补齐。
7. 家长报告语气专业、清晰、鼓励但不过度承诺。销售话术突出最急迫提升点和续课价值，但不得承诺具体提分结果或制造焦虑。
8. 使用自然、具体的中文，保留必要的 SAT、Bluebook、Desmos、Module、Algebra 等术语。
9. 必须严格依据当前 Digital SAT 数学考试：共 44 题、70 分钟，分为两个各 35 分钟的自适应 Module；整个数学部分均可使用计算器，并内置 Desmos。禁止使用旧版 SAT 的“无计算器部分”“有计算器部分”等表述。
10. 课程内容仅限当前官方四大 Domain：Algebra、Advanced Math、Problem-Solving and Data Analysis、Geometry and Trigonometry。具体考点必须符合 College Board 当前范围，不得加入排列组合、函数复合与反函数等非官方核心考点。
11. 概率内容应聚焦概率与条件概率、表格或情境建模；几何与三角应聚焦面积体积、直线角与三角形、直角三角形与三角函数、圆。限时训练应以 35 分钟 Module 或其合理拆分为依据。
12. Bluebook 诊断应表述为官方自适应数字化练习测试；如果只安排数学部分，应明确为两个数学 Module，不得编造纸笔版分区。`;

function buildInput(data: z.infer<typeof requestSchema>) {
  return `请根据以下信息生成 SAT 数学试听课报告：

学生姓名：${data.studentName}
当前 SAT 数学成绩：${data.currentScore || '未提供'}
目标成绩：${data.targetScore || '未提供'}
目标考试日期：${data.examDate || '未提供'}

老师原始记录：
${data.teacherNotes}`;
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

    const stages = response.output_parsed.coursePlan.stages;
    const totalHours = stages.reduce((sum, stage) => sum + stage.lessons.reduce((stageSum, lesson) => stageSum + lesson.duration, 0), 0);

    return NextResponse.json({
      generated: true,
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      report: {
        ...response.output_parsed,
        coursePlan: {
          ...response.output_parsed.coursePlan,
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
