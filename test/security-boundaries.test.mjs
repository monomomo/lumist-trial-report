import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('latest migration removes broad teacher profile and asset read policies', async () => {
  const migration = await readFile(new URL('../supabase/migrations/202608200001_tighten_teacher_asset_rls.sql', import.meta.url), 'utf8');
  assert.match(migration, /drop policy if exists "teacher_configs_read_authenticated"/);
  assert.match(migration, /drop policy if exists "teacher_assets_read_authenticated"/);
  assert.match(migration, /lumist_teacher_configs_select_own/);
  assert.match(migration, /auth\.uid\(\)\) = teacher_id/);
  assert.match(migration, /lumist_teacher_assets_read_own/);
  assert.match(migration, /storage\.foldername\(name\)/);
});
