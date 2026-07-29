import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPdfFileName } from '../public/report/report-domain.js';

test('PDF file name follows student subject report format', () => {
  assert.equal(buildPdfFileName('AP Calculus BC', '小王'), '小王+AP Calculus BC+学情报告');
  assert.equal(buildPdfFileName('SAT 数学', '李同学'), '李同学+SAT 数学+学情报告');
});

test('PDF file name removes unsafe characters and supplies fallbacks', () => {
  assert.equal(buildPdfFileName('SAT/英语', '小王:*?'), '小王+SAT-英语+学情报告');
  assert.equal(buildPdfFileName('', ''), '学生+课程+学情报告');
});

test('print flow temporarily uses the PDF file name as document title', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  assert.match(source, /document\.title = buildPdfFileName\(subjectName, studentName\)/);
  assert.match(source, /document\.title = previousTitle/);
  assert.match(source, /window\.addEventListener\('afterprint', restorePrintState\)/);
});
