import test from 'node:test';
import assert from 'node:assert/strict';
import { getUnexpectedLanguageIssues, getUnexpectedLanguagePaths } from '../lib/reports/language-quality.ts';

test('language quality accepts Chinese with common English academic terms', () => {
  const report = {
    overview: '课堂上完成了 AP Calculus BC 的 Taylor series 诊断。',
    coursePlan: {
      stages: [{ lessons: [{ content: '使用 FRQ 检查 justification 和 notation。' }] }],
    },
  };
  assert.deepEqual(getUnexpectedLanguagePaths(report), []);
  assert.deepEqual(getUnexpectedLanguageIssues(report), []);
});

test('language quality locates Japanese kana in nested report fields', () => {
  const report = {
    overview: '学生の理解需要继续确认',
    coursePlan: {
      stages: [{ lessons: [{ content: '检查グラフ与函数关系' }] }],
    },
  };
  assert.deepEqual(getUnexpectedLanguagePaths(report), [
    'report.overview',
    'report.coursePlan.stages[0].lessons[0].content',
  ]);
  assert.match(getUnexpectedLanguageIssues(report)[0], /日文假名/);
});

test('language quality caps reported paths without exposing full field content', () => {
  const report = Array.from({ length: 12 }, (_, index) => ({ value: `テスト${index}` }));
  const paths = getUnexpectedLanguagePaths(report);
  assert.equal(paths.length, 8);
  assert.equal(paths.some((path) => path.includes('テスト')), false);
});
