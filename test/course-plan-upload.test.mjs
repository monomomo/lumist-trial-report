import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLockedPlan, getUploadedPlanWarnings, lockedCoursePlanSchema } from '../lib/course-plan-upload/schema.ts';
import { buildCoursePlanExtractionPrompt, buildLockedReportPrompt } from '../lib/course-plan-upload/prompt.ts';

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
});

test('upload API keeps files in memory and the locked report path does not call AI again', async () => {
  const parseRoute = await readFile(new URL('../app/api/parse-course-plan/route.ts', import.meta.url), 'utf8');
  const reportRoute = await readFile(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
  assert.match(parseRoute, /request\.formData\(\)/);
  assert.match(parseRoute, /extractCoursePlanText\(file\)/);
  assert.doesNotMatch(parseRoute, /writeFile|putObject|storage\.from/);
  assert.match(reportRoute, /lockedCoursePlan: lockedCoursePlanSchema\.optional\(\)/);
  assert.match(reportRoute, /buildUploadedPlanReport/);
  assert.match(reportRoute, /model: 'uploaded-plan-layout'/);
  assert.doesNotMatch(reportRoute, /lockedResponse/);
});
