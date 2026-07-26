import test from 'node:test';
import assert from 'node:assert/strict';
import { getCoursePlanQualityIssues } from '../lib/subjects/course-plan-quality.ts';

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
  for (const subjectCode of ['sat_math', 'sat_english', 'ap_calculus_ab', 'ap_calculus_bc', 'ap_csa', 'ap_microeconomics', 'ap_macroeconomics']) {
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
