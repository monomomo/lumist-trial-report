import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.REPORT_TEST_BROWSER_CHANNEL ? { channel: process.env.REPORT_TEST_BROWSER_CHANNEL } : {}) });
const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');
try {
  const page = await browser.newPage();
  for (const media of ['screen', 'print']) {
    await page.emulateMedia({ media });
    for (const width of [1280, 800]) {
      await page.setViewportSize({ width, height: 1200 });
      for (const dimensions of [[800, 1200], [900, 1200]]) {
        for (const density of ['', 'teacher-page-compact', 'teacher-page-condensed']) {
          const [imageWidth, imageHeight] = dimensions;
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}"><rect x="5" y="5" width="${imageWidth - 10}" height="${imageHeight - 10}" fill="#def" stroke="red" stroke-width="10"/><text x="20" y="40">Full image boundary</text></svg>`;
          await page.setContent(`<style>${styles}</style><article class="report-page teacher-page ${density}"><div class="teacher-profile"><div class="teacher-photo-wrap"><img src="data:image/svg+xml,${encodeURIComponent(svg)}"></div><div class="teacher-intro"><h2>测试老师</h2><p>教学简介</p></div></div></article>`);
          await page.locator('.teacher-photo-wrap img').evaluate((image) => image.decode());
          const result = await page.locator('.teacher-photo-wrap img').evaluate((image) => {
            const imageRect = image.getBoundingClientRect();
            const containerRect = image.parentElement.getBoundingClientRect();
            const style = getComputedStyle(image);
            return { fit: style.objectFit, image: { left: imageRect.left, right: imageRect.right, top: imageRect.top, bottom: imageRect.bottom }, container: { left: containerRect.left, right: containerRect.right, top: containerRect.top, bottom: containerRect.bottom } };
          });
          const context = `${media}, viewport ${width}, image ${dimensions}, ${density}`;
          assert.equal(result.fit, 'contain', context);
          assert.ok(result.image.left >= result.container.left - 1 && result.image.right <= result.container.right + 1, context);
          assert.ok(result.image.top >= result.container.top - 1 && result.image.bottom <= result.container.bottom + 1, context);
        }
      }
    }
  }
  console.log('PASS: 24 portrait aspect-ratio, screen/print, viewport and density combinations display the full image');
} finally {
  await browser.close();
}
