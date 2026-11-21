import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { waitForPrintImage } from '../public/report/export-utils.js';

test('print flow waits for report images before opening the browser dialog', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  assert.match(source, /async function waitForReportImages\(\)/);
  assert.match(source, /report\.querySelectorAll\('img'\).*image\.closest\('\.ap-only'\)/);
  assert.match(source, /querySelectorAll\('#parent-report \[data-print-src\]'\)/);
  assert.doesNotMatch(source, /#report-document/);
  assert.match(source, /switchReportImageSources\('print'\);\s*await waitForReportImages\(\);[\s\S]*window\.print\(\)/);
  assert.match(source, /window\.addEventListener\('afterprint', restorePrintState/);
  assert.match(source, /const restorePrintState = \(\) =>/);
  assert.match(source, /await waitForReportImages\(\);[\s\S]*window\.print\(\)/);
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


class FailedPrintImage extends EventTarget {
  complete = true;
  naturalWidth = 0;
  ownerDocument = { baseURI: 'https://example.test/report/index.html' };
  dataset = { printSrc: 'assets/course-print.jpg' };
  alt = '课程介绍';
  replacement = '';
  closest() { return null; }
  set src(url) {
    this.replacement = url;
    if (this.recovers) this.naturalWidth = 100;
  }
}

test('print retries a failed asset once without reusing the cached failure', async () => {
  const image = new FailedPrintImage();
  image.recovers = true;
  let retries = 0;
  await waitForPrintImage(image, () => { retries++; });
  assert.equal(retries, 1);
  const retryUrl = new URL(image.replacement);
  assert.equal(retryUrl.pathname, '/report/assets/course-print.jpg');
  assert.ok(retryUrl.searchParams.has('pdfRetry'));
});

test('print identifies the failed image when its retry also fails', async () => {
  const image = new FailedPrintImage();
  let retries = 0;
  await assert.rejects(waitForPrintImage(image, () => { retries++; }), {
    message: 'EXPORT_IMAGES_FAILED',
    imageLabel: '课程介绍',
  });
  assert.equal(retries, 1);
});
