import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('print flow waits for report images before opening the browser dialog', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  assert.match(source, /async function waitForReportImages\(\)/);
  assert.match(source, /await waitForReportImages\(\);\s*window\.print\(\)/);
});

test('print flow does not attempt to override the browser PDF file name', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const domainSource = await readFile(new URL('../public/report/report-domain.js', import.meta.url), 'utf8');
  assert.equal(appSource.includes('document.title'), false);
  assert.equal(appSource.includes('buildPdfFileName'), false);
  assert.equal(domainSource.includes('buildPdfFileName'), false);
});
