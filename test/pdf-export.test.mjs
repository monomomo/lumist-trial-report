import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('print flow waits for report images before opening the browser dialog', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  assert.match(source, /async function waitForReportImages\(\)/);
  assert.match(source, /querySelectorAll\('#parent-report img'\)/);
  assert.match(source, /querySelectorAll\('#parent-report \[data-print-src\]'\)/);
  assert.doesNotMatch(source, /#report-document/);
  assert.match(source, /switchReportImageSources\('print'\);\s*await waitForReportImages\(\);\s*window\.print\(\)/);
  assert.match(source, /finally \{\s*switchReportImageSources\('screen'\)/);
  assert.match(source, /await waitForReportImages\(\);\s*window\.print\(\)/);
});

test('large full-page images have dedicated print sources', async () => {
  const htmlSource = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  const printSources = htmlSource.match(/data-print-src="assets\/[^"]+-print\.jpg"/g) || [];

  assert.equal(printSources.length, 5);
  assert.match(htmlSource, /lumist-sat-cover-print\.jpg/);
  assert.match(htmlSource, /lumist-sat-high-score-cases-print\.jpg/);
  assert.match(htmlSource, /lumist-company-introduction-print\.jpg/);
  assert.match(htmlSource, /lumist-course-introduction-print\.jpg/);
});

test('print flow does not attempt to override the browser PDF file name', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const domainSource = await readFile(new URL('../public/report/report-domain.js', import.meta.url), 'utf8');
  assert.equal(appSource.includes('document.title'), false);
  assert.equal(appSource.includes('buildPdfFileName'), false);
  assert.equal(domainSource.includes('buildPdfFileName'), false);
});
