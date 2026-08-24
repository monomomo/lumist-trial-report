import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SUBJECT_CODES } from '../public/report/catalog.js';

test('searchable subject combobox is accessible and replaces the visible native select', async () => {
  const html = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');

  assert.match(html, /id="subject-search"[^>]+role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /aria-controls="subject-options"/);
  assert.match(html, /id="subject-options"[^>]+role="listbox"/);
  assert.match(html, /id="subject-select" hidden aria-hidden="true"/);
});

test('subject groups and search aliases cover every supported subject exactly once', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const groupBlock = source.match(/const SUBJECT_GROUPS = \[([\s\S]*?)\n\];/)?.[1] || '';
  const aliasBlock = source.match(/const SUBJECT_SEARCH_ALIASES = \{([\s\S]*?)\n\};/)?.[1] || '';
  const groupedCodes = [...groupBlock.matchAll(/codes:\s*\[([^\]]+)\]/g)]
    .flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]));
  const aliasCodes = [...aliasBlock.matchAll(/^\s{2}([a-z0-9_]+):/gm)].map((match) => match[1]);

  assert.deepEqual([...groupedCodes].sort(), [...SUBJECT_CODES].sort());
  assert.equal(new Set(groupedCodes).size, SUBJECT_CODES.length);
  assert.deepEqual([...aliasCodes].sort(), [...SUBJECT_CODES].sort());
  assert.match(aliasBlock, /AP物理C电磁/);
  assert.match(aliasBlock, /AP英语文学与写作/);
  assert.match(aliasBlock, /AP汉语语言与文化/);
});

test('subject search supports text filtering and keyboard selection', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');

  assert.match(source, /haystack\.includes\(normalizedQuery\)/);
  assert.match(source, /\['ArrowDown', 'ArrowUp', 'Enter'\]/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /role="option"/);
  assert.match(source, /aria-activedescendant/);
});

test('subject combobox opens from the whole field and keeps active search text', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const stylesSource = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');

  assert.match(appSource, /\$\(\'#subject-combobox\'\)\.addEventListener\('click'/);
  assert.match(appSource, /renderSubjectOptions\(subjectSelectionConfirmed \? '' : event\.target\.value\)/);
  assert.match(appSource, /renderSubjectOptions\(subjectSelectionConfirmed \? '' : \$\('#subject-search'\)\.value\)/);
  assert.match(stylesSource, /\.subject-field:focus-within \{ z-index:80; \}/);
  assert.match(stylesSource, /\.subject-options \{[^}]*width:100%;/);
  assert.match(stylesSource, /\.subject-options \{[^}]*z-index:80;/);
  assert.match(stylesSource, /\.subject-options \{[^}]*box-sizing:border-box;/);
});
