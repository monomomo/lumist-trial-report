import assert from 'node:assert/strict';
import test from 'node:test';
import { parseModelResponse } from '../lib/reports/model-response.ts';

const validate = (value) => {
  if (!value || typeof value !== 'object' || typeof value.overview !== 'string') return null;
  return value;
};

test('model response prefers an already parsed structured result', () => {
  const output = parseModelResponse({
    output_parsed: { overview: 'structured' },
    output_text: '{"overview":"raw"}',
  }, validate);

  assert.deepEqual(output, { overview: 'structured' });
});

test('model response parses compatible raw JSON output', () => {
  const output = parseModelResponse({
    output_parsed: null,
    output_text: '{"overview":"raw"}',
  }, validate);

  assert.deepEqual(output, { overview: 'raw' });
});

test('model response accepts a fenced JSON payload and rejects invalid content', () => {
  assert.deepEqual(parseModelResponse({ output_text: '```json\n{"overview":"raw"}\n```' }, validate), { overview: 'raw' });
  assert.equal(parseModelResponse({ output_text: 'not json' }, validate), null);
  assert.equal(parseModelResponse({ output_text: '{"missing":"overview"}' }, validate), null);
});
