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

test('model response extracts JSON surrounded by explanatory text', () => {
  const output = parseModelResponse({
    output_text: '以下是生成结果：\n{"overview":"raw"}\n生成完毕。',
  }, validate);

  assert.deepEqual(output, { overview: 'raw' });
});

test('model response does not validate an absent parsed result before raw text', () => {
  let validationCount = 0;
  const output = parseModelResponse({ output_text: '{"overview":"raw"}' }, (value) => {
    validationCount += 1;
    return validate(value);
  });

  assert.deepEqual(output, { overview: 'raw' });
  assert.equal(validationCount, 1);
});
