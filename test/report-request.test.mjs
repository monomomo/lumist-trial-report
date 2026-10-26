import test from 'node:test';
import assert from 'node:assert/strict';
import { requestReportJson, requestFailureMetadata } from '../public/report/request-utils.js';

const noWait = async () => {};
test('temporary connection failures retry once and recover', async () => {
  let calls = 0;
  const result = await requestReportJson('/api/reports/reuse', { teacherNotes: 'private' }, {
    sleep: noWait,
    fetchImpl: async () => {
      if (++calls === 1) throw new TypeError('Failed to fetch');
      return Response.json({ id: null });
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { id: null });
});

test('persistent network failures stop after two attempts and carry safe diagnostics', async () => {
  let calls = 0;
  await assert.rejects(requestReportJson('/api/generate-report', { studentName: 'private' }, {
    sleep: noWait, fetchImpl: async () => { calls += 1; throw new TypeError('Failed to fetch'); },
  }), (error) => {
    assert.equal(error.message, 'NETWORK_ERROR');
    assert.equal(error.attempts, 2);
    assert.match(error.reason, /网络连接中断/);
    assert.ok(error.requestId);
    assert.equal(JSON.stringify(requestFailureMetadata(error, 'summary')).includes('private'), false);
    assert.equal(requestFailureMetadata(error, 'summary').path, '/api/generate-report');
    return true;
  });
  assert.equal(calls, 2);
});

test('authentication failures do not retry or lose their HTTP status', async () => {
  let calls = 0;
  await assert.rejects(requestReportJson('/api/reports/reuse', {}, {
    sleep: noWait, fetchImpl: async () => { calls += 1; return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 }); },
  }), (error) => error.message === 'UNAUTHORIZED' && error.status === 401);
  assert.equal(calls, 1);
});

test('non-JSON gateway failures retry and produce a readable error instead of a JSON parser message', async () => {
  let calls = 0;
  await assert.rejects(requestReportJson('/api/generate-report-batch', {}, {
    sleep: noWait, fetchImpl: async () => { calls += 1; return new Response('<html>Gateway Timeout</html>', { status: 504 }); },
  }), (error) => error.message === 'INVALID_RESPONSE' && error.reason.includes('超时') && error.status === 504);
  assert.equal(calls, 2);
});

test('a lost connection while reading the response body is retried', async () => {
  let calls = 0;
  assert.deepEqual(await requestReportJson('/api/generate-report', {}, {
    sleep: noWait,
    fetchImpl: async () => ++calls === 1
      ? { status: 200, headers: new Headers(), text: async () => { throw new TypeError('Failed to fetch'); } }
      : Response.json({ report: {} }),
  }), { report: {} });
  assert.equal(calls, 2);
});

test('timeouts abort the request and are classified separately from rendering errors', async () => {
  await assert.rejects(requestReportJson('/api/reports/reuse', {}, {
    attempts: 1, timeoutMs: 1,
    fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
  }), (error) => error.message === 'REQUEST_TIMEOUT' && error.reason.includes('超时'));
});

test('unexpected exception text is not copied into diagnostic metadata', () => {
  const metadata = requestFailureMetadata(new Error('student details private content'), 'render');
  assert.equal(metadata.code, 'UNEXPECTED_CLIENT_ERROR');
  assert.doesNotMatch(JSON.stringify(metadata), /student details|private content/);
});
