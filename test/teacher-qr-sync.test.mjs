import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('teacher QR sync reads attachment arrays and updates only existing teacher configs', async () => {
  const source = await readFile(new URL('../scripts/sync-feishu-teachers.mjs', import.meta.url), 'utf8');

  assert.match(source, /qrAttachments: Array\.isArray\(values\['导师宣传二维码'\]\)/);
  assert.match(source, /const QR_ONLY = process\.argv\.includes\('--qr-only'\)/);
  assert.match(source, /未找到账号/);
  assert.match(source, /\.update\(\{ qr_path: qrPath \}\)\.eq\('teacher_id', user\.id\)/);
  assert.equal(source.includes("update({ qr_path: null })"), false);
});

test('teacher QR sync preserves the existing account mapping after display-name changes', async () => {
  const source = await readFile(new URL('../scripts/sync-feishu-teachers.mjs', import.meta.url), 'utf8');

  assert.match(source, /\['吕静一', 'amberlyu'\]/);
  assert.match(source, /\['王琪涵', 'qihanwang'\]/);
});

test('package exposes separate QR preview and apply commands', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.match(packageJson.scripts['teachers:preview-qr'], /--qr-only$/);
  assert.match(packageJson.scripts['teachers:sync-qr'], /--qr-only --apply$/);
});
