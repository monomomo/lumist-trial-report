import test from 'node:test';
import assert from 'node:assert/strict';
import { getCoursePlanQualityIssues } from '../lib/subjects/course-plan-quality.ts';

function createReport(stages) {
  return { coursePlan: { stages } };
}

test('SAT quality review catches templated titles and generic difficulty labels', () => {
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
  const issues = getCoursePlanQualityIssues(report, 'sat_math');
  assert.equal(issues.length, 3);
  assert.match(issues.join('；'), /模板词/);
  assert.match(issues.join('；'), /具体易错点/);
  assert.match(issues.join('；'), /官方诊断/);
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

test('quality review does not impose SAT workflow on AP plans', () => {
  const report = createReport([{ title: '系统学习', lessons: [] }]);
  assert.deepEqual(getCoursePlanQualityIssues(report, 'ap_calculus_bc'), []);
});
