import test from 'node:test';
import assert from 'node:assert/strict';
import { getCoursePlanQualityIssues } from '../lib/subjects/course-plan-quality.ts';
import { SUBJECT_CODES } from '../lib/subjects/catalog.js';

function createReport(stages) {
  return { coursePlan: { stages } };
}

test('quality review catches templated titles and abstract lesson fields for every subject', () => {
  const report = createReport([
    {
      title: '夯实基础',
      lessons: Array.from({ length: 8 }, (_, index) => ({
        theme: index === 0 ? '系统学习 Algebra' : `知识点强化 ${index + 1}`,
        content: '讲解核心知识并完成配套练习',
        difficulty: '中等偏难',
        goal: '提升综合能力',
      })),
    },
  ]);
  for (const subjectCode of SUBJECT_CODES) {
    const issues = getCoursePlanQualityIssues(report, subjectCode);
    assert.equal(issues.length, 4);
    assert.match(issues.join('；'), /模板词/);
    assert.match(issues.join('；'), /具体易错点/);
    assert.match(issues.join('；'), /课后核对/);
    assert.match(issues.join('；'), subjectCode.startsWith('sat_') ? /官方诊断/ : /AP 题型/);
  }
});

test('SAT quality review accepts evidence-led teaching tasks', () => {
  const report = createReport([
    {
      title: 'Bluebook 诊断与代数错因',
      lessons: Array.from({ length: 8 }, (_, index) => ({
        theme: `Algebra Skill ${index + 1}`,
        content: index === 0
          ? '完成 Bluebook 数学诊断并按 Domain 和 Skill 整理错题'
          : '从 Student Question Bank 筛选同 Skill 题目进行订正',
        difficulty: '等式变形时容易漏掉负号，且不能说明每一步依据',
        goal: '能解释错因，并独立完成同 Skill 的订正题',
      })),
    },
  ]);
  assert.deepEqual(getCoursePlanQualityIssues(report, 'sat_math'), []);
});

test('AP quality review accepts subject-specific evidence-led teaching tasks', () => {
  const report = createReport([
    {
      title: 'Java 作答证据与程序状态',
      lessons: Array.from({ length: 8 }, (_, index) => ({
        theme: `Java tracing task ${index + 1}`,
        content: index === 0
          ? '使用 AP Classroom Progress Check 的 MCQ 定位程序状态判断错误'
          : '根据 FRQ 作答和 test case 调试同类 Java 程序',
        difficulty: '循环边界改变后，无法准确追踪 ArrayList 的 index 与 size',
        goal: '能写出 trace table，并根据运行结果订正代码',
      })),
    },
  ]);
  assert.deepEqual(getCoursePlanQualityIssues(report, 'ap_csa'), []);
});

test('quality review requires the server-planned lesson count', () => {
  const report = createReport([
    {
      title: 'Algebra 作答检查',
      lessons: Array.from({ length: 4 }, (_, index) => ({
        theme: `Algebra Skill ${index + 1}`,
        content: '使用 Student Question Bank 检查同类题的作答步骤',
        difficulty: '等式变形时容易漏掉负号，且不能说明每一步依据',
        goal: '能解释错因，并独立完成同 Skill 的订正题',
      })),
    },
  ]);
  assert.match(getCoursePlanQualityIssues(report, 'sat_math', 5).join('；'), /必须包含 5 个课时块/);
  assert.deepEqual(getCoursePlanQualityIssues(report, 'sat_math', 4), []);
});

test('quality review rejects a first formal lesson that repeats the trial introduction', () => {
  const report = {
    lessonTitle: '试听：课程框架与核心术语导入',
    lessonSummary: '试听课已完成核心术语解释与基础练习',
    coursePlan: {
      stages: [{
        title: 'Limits 诊断',
        lessons: [{
          theme: '导入与术语适应',
          content: '再次介绍课程框架和 limit、continuity 等核心术语',
          difficulty: '英文术语与数学含义未能对应',
          goal: '能用英文术语解释基础概念',
        }],
      }],
    },
  };
  assert.match(getCoursePlanQualityIssues(report, 'ap_calculus_ab').join('；'), /重复试听课/);
});
