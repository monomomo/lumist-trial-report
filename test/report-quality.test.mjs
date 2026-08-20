import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerationChecklist, buildReportQualityChecks } from '../public/report/report-quality-utils.js';

function createReport() {
  return {
    overview: '本次试听课中，我带领学生完成了函数任务。',
    classroomStatus: '学生认真完成课堂任务。',
    strength: '代数计算较为稳定。',
    currentFocus: '继续提升函数建模能力。',
    lessonTitle: '函数模型课堂诊断',
    lessonSummary: '学生完成了课堂中的函数分析任务。',
    performance: '学生能够说明自己的作答过程。',
    outcomes: ['完成函数任务'],
    priorityAreas: ['Function Modeling'],
    teacherNotice: '',
    coursePlan: {
      totalHours: 4,
      rationale: '根据后续作答情况调整。',
      stages: [{
        title: '函数基础',
        description: '梳理函数表示。',
        lessons: [
          { duration: 2, theme: '函数表示', content: '完成函数任务', difficulty: '表示转换', goal: '掌握表示方法' },
          { duration: 2, theme: '函数建模', content: '完成建模任务', difficulty: '情境转化', goal: '完成模型解释' },
        ],
      }],
    },
  };
}

test('generation checklist presents every decision before calling AI', () => {
  const items = buildGenerationChecklist({
    studentName: '李同学',
    subjectName: 'AP Precalculus',
    currentScore: '3',
    targetScore: '5',
    examDate: '2027年5月',
    totalHours: '20',
    lessonCount: '12',
    planningScenarioLabel: '预习',
    planningFocusLabel: '知识基础、英文术语',
    teacherName: 'Amber',
    notesLength: 128,
  });

  assert.deepEqual(items.map((item) => item.label), ['学生', '科目', '当前成绩', '目标成绩', '考试时间', '辅导场景', '课程侧重点', '总课时', '预计课次', '授课老师', '试听记录']);
  assert.equal(items.find((item) => item.label === '预计课次').value, '12 节');
  assert.equal(items.find((item) => item.label === '辅导场景').value, '预习');
  assert.equal(items.find((item) => item.label === '课程侧重点').value, '知识基础、英文术语');
  assert.equal(items.every((item) => item.status === 'ready'), true);
});

test('generation checklist marks optional and recommended missing fields without blocking', () => {
  const items = buildGenerationChecklist({
    studentName: '李同学',
    subjectName: 'SAT 数学',
    currentScore: '',
    targetScore: '',
    examDate: '',
    totalHours: '10',
    lessonCount: '5',
    planningScenarioLabel: '同步',
    planningFocusLabel: '',
    teacherName: 'Amber',
    notesLength: 80,
  });

  assert.equal(items.find((item) => item.label === '当前成绩').status, 'optional');
  assert.equal(items.find((item) => item.label === '考试时间').status, 'optional');
  assert.equal(items.find((item) => item.label === '目标成绩').status, 'warning');
  assert.equal(items.find((item) => item.label === '课程侧重点').status, 'optional');
});

test('post-generation quality review passes a consistent server-reviewed report', () => {
  const checks = buildReportQualityChecks({
    subjectCode: 'ap_precalculus',
    report: createReport(),
    targetScore: '5',
    requestedTotalHours: 4,
    qualityReview: { reviewCompleted: true, subjectScopePassed: true, modelWarnings: [] },
  });

  assert.equal(checks.length, 7);
  assert.equal(checks.every((check) => check.status === 'passed'), true);
});

test('post-generation quality review exposes hour, wording, evidence, layout and server review risks', () => {
  const report = createReport();
  report.overview = '部分内容待老师确认。';
  report.teacherNotice = '建议补充学生课堂表现。';
  const checks = buildReportQualityChecks({
    subjectCode: 'sat_math',
    report,
    targetScore: '',
    requestedTotalHours: 6,
    layoutWarnings: [{ path: 'coursePlan', message: '内容较长' }],
    qualityReview: { reviewCompleted: false, subjectScopePassed: false, modelWarnings: ['内容较模板化'] },
  });

  assert.deepEqual(
    checks.filter((check) => check.status === 'warning').map((check) => check.label),
    ['总课时一致性', '目标成绩', '待确认话术', '科目范围', '课堂依据', '页面排版', 'AI 内容质量'],
  );
});

test('critical content warnings make AI quality require teacher review', () => {
  const checks = buildReportQualityChecks({
    subjectCode: 'ap_calculus_bc',
    report: createReport(),
    targetScore: '5',
    requestedTotalHours: 4,
    qualityReview: {
      reviewCompleted: true,
      subjectScopePassed: true,
      criticalWarnings: ['第 8 节课被归入第 6 单元（积分与变化的累积），但本节明确内容与该单元不一致'],
      modelWarnings: [],
    },
  });
  const aiQuality = checks.find((check) => check.label === 'AI 内容质量');

  assert.equal(aiQuality.status, 'warning');
  assert.equal(aiQuality.message, '有 1 项问题需要老师重点核对');
});
