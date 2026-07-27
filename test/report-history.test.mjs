import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('reports API supports listing, opening, creating and updating owned reports', async () => {
  const routeSource = await readFile(new URL('../app/api/reports/route.ts', import.meta.url), 'utf8');

  assert.match(routeSource, /export async function GET\(request: Request\)/);
  assert.match(routeSource, /searchParams\.get\('id'\)/);
  assert.match(routeSource, /\.select\('id,student_name,subject,current_score,target_score,exam_date_text,original_notes,report_data,course_plan,sales_follow_up,teacher_snapshot,status,created_at,updated_at'\)/);
  assert.match(routeSource, /export async function POST\(request: Request\)/);
  assert.match(routeSource, /export async function PATCH\(request: Request\)/);
  assert.match(routeSource, /\.update\(buildMutableReportPayload\(body\)\)/);
  assert.match(routeSource, /teacher_snapshot: teacherSnapshot \|\| \{\}/);
  assert.equal(routeSource.match(/\.eq\('teacher_id', user\.id\)/g)?.length, 3);
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
