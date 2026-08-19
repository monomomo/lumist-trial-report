import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reportCreateSchema, reportUpdateSchema } from '../lib/reports/schema.ts';

function createValidReportPayload() {
  return {
    id: null,
    studentName: '小王',
    subject: 'AP Calculus BC',
    currentScore: '',
    targetScore: '',
    examDate: '2027年5月',
    teacherNotes: '学生课堂参与积极，需要继续通过具体练习确认各模块掌握情况。',
    reportData: {
      overview: '本次试听课中，我了解了学生的学习情况。',
      classroomStatus: '课堂参与积极',
      strength: '我观察到学生具备基础',
      currentFocus: '我会继续诊断具体错因',
      lessonTitle: '试听诊断',
      lessonSummary: '我通过课堂任务了解了当前学习情况。',
      performance: '学生能够跟随讲解完成思考。',
      outcomes: ['完成初步诊断'],
      priorityAreas: ['知识框架'],
      planningContext: { scenario: 'preview', lessonCount: 1 },
    },
    coursePlan: {
      totalHours: 2,
      rationale: '根据课堂诊断安排后续课程。',
      stages: [{
        title: '阶段一',
        description: '基础诊断',
        lessons: [{
          duration: 2,
          theme: '诊断',
          content: '完成诊断任务',
          difficulty: '定位错因',
          goal: '确认掌握情况',
        }],
      }],
    },
    salesFollowUp: {
      positive: '课堂参与积极。',
      urgent: '需要继续完成基础诊断。',
      angle: '先诊断再安排训练。',
      script: '建议先完成基础诊断，再依据具体错因安排后续训练。',
    },
  };
}

test('reports API supports listing, opening, creating and updating owned reports', async () => {
  const routeSource = await readFile(new URL('../app/api/reports/route.ts', import.meta.url), 'utf8');

  assert.match(routeSource, /export async function GET\(request: Request\)/);
  assert.match(routeSource, /searchParams\.get\('id'\)/);
  assert.match(routeSource, /\.select\('id,student_name,subject,current_score,target_score,exam_date_text,original_notes,report_data,course_plan,sales_follow_up,teacher_snapshot,status,created_at,updated_at'\)/);
  assert.match(routeSource, /export async function POST\(request: Request\)/);
  assert.match(routeSource, /export async function PATCH\(request: Request\)/);
  assert.match(routeSource, /reportCreateSchema\.safeParse/);
  assert.match(routeSource, /reportUpdateSchema\.safeParse/);
  assert.match(routeSource, /INVALID_REPORT_DATA/);
  assert.match(routeSource, /\.update\(buildMutableReportPayload\(body\)\)/);
  assert.match(routeSource, /teacher_snapshot: teacherSnapshot \|\| \{\}/);
  assert.equal(routeSource.match(/\.eq\('teacher_id', user\.id\)/g)?.length, 3);
});

test('report save schema accepts valid create and update payloads', () => {
  const payload = createValidReportPayload();
  assert.equal(reportCreateSchema.safeParse(payload).success, true);
  assert.equal(reportUpdateSchema.safeParse({ ...payload, id: 'd9428888-122b-4e5f-a3d6-5270e4fd5f3e' }).success, true);
});

test('report save schema rejects malformed data and inconsistent total hours', () => {
  const mismatch = createValidReportPayload();
  mismatch.coursePlan.totalHours = 2.5;
  const badSubject = { ...createValidReportPayload(), subject: 'AP Physics C' };
  const unknownField = { ...createValidReportPayload(), teacherId: 'forged-id' };
  const badDuration = createValidReportPayload();
  badDuration.coursePlan.stages[0].lessons[0].duration = 3;
  const badLessonCount = createValidReportPayload();
  badLessonCount.reportData.planningContext.lessonCount = 2;

  assert.equal(reportCreateSchema.safeParse(mismatch).success, false);
  assert.equal(reportCreateSchema.safeParse(badSubject).success, false);
  assert.equal(reportCreateSchema.safeParse(unknownField).success, false);
  assert.equal(reportCreateSchema.safeParse(badDuration).success, false);
  assert.equal(reportCreateSchema.safeParse(badLessonCount).success, false);
});

test('report save schema rejects scores outside the selected subject range', () => {
  const invalidApScore = { ...createValidReportPayload(), currentScore: '6' };
  const invalidSatTarget = { ...createValidReportPayload(), subject: 'SAT 数学', currentScore: '700', targetScore: '690' };

  assert.equal(reportCreateSchema.safeParse(invalidApScore).success, false);
  assert.equal(reportCreateSchema.safeParse(invalidSatTarget).success, false);
});

test('report workspace exposes persistent history actions without stale demo controls', async () => {
  const htmlSource = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');

  assert.match(htmlSource, /id="history-list"/);
  assert.match(htmlSource, /id="save-report"/);
  assert.doesNotMatch(htmlSource, /id="open-history"/);
  assert.doesNotMatch(appSource, /#open-history/);
  assert.match(appSource, /fetch\('\/api\/reports'\)/);
  assert.match(appSource, /fetch\(`\/api\/reports\?id=\$\{encodeURIComponent\(reportId\)\}`\)/);
  assert.match(appSource, /method: currentReportId \? 'PATCH' : 'POST'/);
  assert.match(appSource, /historicalTeacherProfile = buildHistoricalTeacherProfile\(record\.teacher_snapshot\)/);
  assert.match(appSource, /currentReportId = null/);
});
