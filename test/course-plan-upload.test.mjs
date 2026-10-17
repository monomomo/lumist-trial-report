import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLockedPlan, getUploadedPlanWarnings, lockedCoursePlanSchema } from '../lib/course-plan-upload/schema.ts';
import { buildCoursePlanExtractionPrompt, buildLockedReportInput, buildLockedReportPrompt } from '../lib/course-plan-upload/prompt.ts';
import { getSatUploadedPlanWarnings } from '../lib/course-plan-upload/sat-review.ts';

const extraction = {
  title: 'AP Biology 课程规划',
  declaredLessonCount: 3,
  declaredTotalHours: 3,
  stages: [{
    title: '基础阶段',
    description: '',
    declaredLessonCount: 3,
    declaredHours: 3,
    lessons: [
      { sourceNumber: '1', duration: 1, theme: 'Unit 1', content: 'Water', sourceText: '1. 1h Unit 1 Water' },
      { sourceNumber: '2', duration: 1, theme: 'Unit 2', content: 'Cells', sourceText: '2. 1h Unit 2 Cells' },
      { sourceNumber: '3', duration: 1, theme: 'Unit 3', content: 'Energy', sourceText: '3. 1h Unit 3 Energy' },
    ],
  }],
  corrections: [],
  ambiguities: [],
};

test('uploaded plan becomes a locked plan without changing order, text, or duration', () => {
  const plan = buildLockedPlan(extraction);
  assert.equal(plan.totalHours, 3);
  assert.deepEqual(plan.stages[0].lessons.map((lesson) => lesson.theme), ['Unit 1', 'Unit 2', 'Unit 3']);
  assert.deepEqual(plan.stages[0].lessons.map((lesson) => lesson.duration), [1, 1, 1]);
  assert.deepEqual(plan.stages[0].lessons.map((lesson) => lesson.content), ['Water', 'Cells', 'Energy']);
});

test('uploaded plan validation reports declared totals and missing durations instead of inventing values', () => {
  const invalid = structuredClone(extraction);
  invalid.declaredLessonCount = 4;
  invalid.declaredTotalHours = 4;
  invalid.stages[0].lessons[1].duration = null;
  const warnings = getUploadedPlanWarnings(invalid).join('；');
  assert.match(warnings, /没有明确时长/);
  assert.match(warnings, /声明 4 节，实际解析为 3 节/);
  assert.match(warnings, /声明 4h，逐节合计为 2h/);
  assert.throws(() => buildLockedPlan(invalid), /UPLOADED_PLAN_DURATION_MISSING/);
});

test('locked plan schema rejects changed totals and unsupported durations', () => {
  const plan = buildLockedPlan(extraction);
  assert.equal(lockedCoursePlanSchema.safeParse({ ...plan, totalHours: 4 }).success, false);
  const invalidDuration = structuredClone(plan);
  invalidDuration.stages[0].lessons[0].duration = 0.75;
  assert.equal(lockedCoursePlanSchema.safeParse(invalidDuration).success, false);
});

test('upload prompts restrict AI to extraction and narrative-only report work', () => {
  const extractionPrompt = buildCoursePlanExtractionPrompt('AP Biology');
  assert.match(extractionPrompt, /不新增、删除、合并、拆分或重新排序任何课次/);
  assert.match(extractionPrompt, /不改变阶段归属、课程时长、知识点或教学范围/);
  assert.match(extractionPrompt, /corrections/);
  const reportPrompt = buildLockedReportPrompt('AP Biology');
  assert.match(reportPrompt, /课程规划已经由老师上传并确认/);
  assert.match(reportPrompt, /不得生成、改写、概括或评价课程规划/);
  const reportInput = buildLockedReportInput({
    studentName: '测试学生',
    currentScore: '3',
    targetScore: '5',
    examDate: '2027年5月',
    teacherNotes: '课堂完成了细胞结构辨析，能够说明细胞器功能，但证据表达仍需加强。',
  });
  assert.match(reportInput, /课堂完成了细胞结构辨析/);
  assert.doesNotMatch(reportInput, /coursePlan|stages|lessons/);
});

test('upload API keeps files in memory and generates only the trial summary around the locked plan', async () => {
  const parseRoute = await readFile(new URL('../app/api/parse-course-plan/route.ts', import.meta.url), 'utf8');
  const reportRoute = await readFile(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
  assert.match(parseRoute, /request\.formData\(\)/);
  assert.match(parseRoute, /extractCoursePlanText\(file\)/);
  assert.match(parseRoute, /getSatUploadedPlanWarnings\(subjectCode, extraction\)/);
  assert.doesNotMatch(parseRoute, /writeFile|putObject|storage\.from/);
  assert.match(reportRoute, /lockedCoursePlan: lockedCoursePlanSchema\.optional\(\)/);
  assert.match(reportRoute, /buildLockedReportPrompt\(subject\.displayName\)/);
  assert.match(reportRoute, /buildLockedReportInput\(\{/);
  assert.match(reportRoute, /uploadedSummarySchema/);
  assert.match(reportRoute, /coursePlan: reportCoursePlan/);
  assert.match(reportRoute, /teacherNotice: buildTeacherNotice\(parsed\.data\.teacherNotes\)/);
  assert.doesNotMatch(reportRoute, /buildUploadedPlanReport/);
});

test('SAT math upload review reports missing domains without changing the plan', () => {
  const mathPlan = structuredClone(extraction);
  mathPlan.title = 'SAT 数学课程规划';
  mathPlan.stages[0].title = 'Algebra and Advanced Math';
  mathPlan.stages[0].lessons = [
    { sourceNumber: '1', duration: 1, theme: 'Linear equations', content: '方程组与不等式', sourceText: 'Linear equations' },
    { sourceNumber: '2', duration: 1, theme: 'Quadratic functions', content: '二次函数与多项式', sourceText: 'Quadratic functions' },
  ];
  const before = structuredClone(mathPlan);
  const warnings = getSatUploadedPlanWarnings('sat_math', mathPlan).join('；');
  assert.match(warnings, /Problem-Solving and Data Analysis/);
  assert.match(warnings, /Geometry and Trigonometry/);
  assert.deepEqual(mathPlan, before);
});

test('SAT math upload review recognizes four-domain coverage and flags advanced content', () => {
  const warnings = getSatUploadedPlanWarnings('sat_math', {
    title: 'SAT Math',
    stages: [{
      title: '完整规划',
      description: 'Algebra, Advanced Math, Problem-Solving and Data Analysis, Geometry and Trigonometry',
      lessons: [{ theme: '衔接微积分', content: '介绍导数', sourceText: 'Calculus bridge' }],
    }],
  });
  assert.equal(warnings.some((warning) => warning.includes('未识别')), false);
  assert.match(warnings.join('；'), /微积分/);
});

test('SAT English upload review only warns about likely non-Reading and Writing content', () => {
  const inScope = getSatUploadedPlanWarnings('sat_english', {
    title: 'SAT Reading and Writing',
    stages: [{ title: '课程', description: '', lessons: [{ theme: 'Craft and Structure', content: 'Words in Context 与文本结构' }] }],
  });
  const outOfScope = getSatUploadedPlanWarnings('sat_english', {
    title: 'SAT English',
    stages: [{ title: '课程', description: '', lessons: [{ theme: '口语与听力', content: 'TOEFL listening and speaking' }] }],
  });
  assert.deepEqual(inScope, []);
  assert.match(outOfScope.join('；'), /听力训练/);
  assert.match(outOfScope.join('；'), /口语训练/);
  assert.match(outOfScope.join('；'), /TOEFL\/IELTS 专项/);
  assert.deepEqual(getSatUploadedPlanWarnings('ap_calculus_ab', { title: 'TOEFL listening' }), []);
});
