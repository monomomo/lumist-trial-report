import test from 'node:test';
import assert from 'node:assert/strict';
import { getUnexpectedLanguageIssues, getUnexpectedScriptPaths } from '../lib/reports/language-quality.ts';

test('language quality accepts Chinese with common English academic terms', () => {
  const report = {
    overview: '课堂上完成了 AP Calculus BC 的 Taylor series 诊断。',
    coursePlan: {
      stages: [{ lessons: [{ content: '使用 FRQ 检查 justification 和 notation。' }] }],
    },
  };
  assert.deepEqual(getUnexpectedScriptPaths(report), []);
  assert.deepEqual(getUnexpectedLanguageIssues(report), []);
});

test('language quality locates unexpected scripts in nested report fields', () => {
  const report = {
    overview: '学生の理解需要继续确认',
    coursePlan: {
      stages: [{ lessons: [
        { content: '검사函数关系' },
        { content: 'Проверить函数关系' },
      ] }],
    },
  };
  assert.deepEqual(getUnexpectedScriptPaths(report), [
    'report.overview',
    'report.coursePlan.stages[0].lessons[0].content',
    'report.coursePlan.stages[0].lessons[1].content',
  ]);
  assert.match(getUnexpectedLanguageIssues(report)[0], /异常文字/);
});

test('language quality caps reported paths without exposing full field content', () => {
  const report = Array.from({ length: 12 }, (_, index) => ({ value: `テスト${index}` }));
  const paths = getUnexpectedScriptPaths(report);
  assert.equal(paths.length, 8);
  assert.equal(paths.some((path) => path.includes('テスト')), false);
});

test('language quality preserves Greek mathematical symbols and formulas', () => {
  const report = {
    overview: '使用 θ、π、Σ 和 Δ 检查参数方程与级数表达。',
    coursePlan: { rationale: '比较 f(x)、dy/dx 与 ∫ f(x) dx 的含义。' },
  };
  assert.deepEqual(getUnexpectedScriptPaths(report), []);
});
