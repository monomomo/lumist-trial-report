import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('report app declares current report state before initialization', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const declarationIndex = source.indexOf('let currentReportData = null;');
  const initializationIndex = source.indexOf('currentReportData = buildFallbackReport');
  assert.notEqual(declarationIndex, -1);
  assert.notEqual(initializationIndex, -1);
  assert.ok(declarationIndex < initializationIndex);
});

test('course plan pagination reserves print safety space', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  assert.match(source, /PLAN_PAGE_SAFETY_MARGIN = 32/);
  assert.match(source, /body\.clientHeight - PLAN_PAGE_SAFETY_MARGIN/);
  assert.match(source, /\['plan-page-compact', 'plan-page-condensed'\]/);
});

test('new report form starts with empty teacher inputs', async () => {
  const source = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  for (const id of ['student-name', 'target-score', 'total-hours']) {
    const input = source.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] || '';
    assert.equal(input.includes('value='), false);
  }
  assert.match(source, /<textarea id="teacher-notes"[^>]*><\/textarea>/);
  assert.match(source, /id="sample-one"/);
  assert.match(source, /id="sample-two"/);
});

test('AP subjects use upcoming May exam options', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const htmlSource = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  assert.match(htmlSource, /id="ap-exam-date"/);
  assert.match(appSource, /subjectCode\.startsWith\('ap_'\)/);
  assert.match(appSource, /new Date\(\)\.getFullYear\(\) \+ 1/);
  assert.match(appSource, /Array\.from\(\{ length: 5 \}/);
  assert.match(appSource, /`\$\{year\}年5月`/);
});
