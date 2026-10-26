export async function requestReportJson(path, payload, options = {}) {
  const { method = 'POST', attempts = 2, timeoutMs = 245000, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = options;
  const multipart = typeof FormData !== 'undefined' && payload instanceof FormData;
  const clientRequestId = globalThis.crypto?.randomUUID?.() || `client-${Date.now().toString(36)}`;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    let result;
    try {
      response = await fetchImpl(path, {
        method,
        signal: controller.signal,
        headers: { 'x-client-request-id': clientRequestId, ...(method === 'GET' || multipart ? {} : { 'Content-Type': 'application/json' }) },
        ...(method === 'GET' ? {} : { body: multipart ? payload : JSON.stringify(payload) }),
      });
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch {
        const error = new Error('INVALID_RESPONSE');
        error.reason = response.status === 502 || response.status === 504 ? '生成请求等待超时，服务暂时没有返回有效结果。' : '服务返回了无法读取的内容。';
        throw error;
      }
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('INVALID_RESPONSE');
      if (!response.ok) {
        const error = new Error(result.error || 'AI_GENERATION_FAILED');
        error.reason = result.reason || '';
        error.suggestion = result.suggestion || '';
        throw error;
      }
      return result;
    } catch (cause) {
      const transport = !response || cause instanceof TypeError || cause?.name === 'AbortError';
      const error = transport ? new Error(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR') : cause;
      error.requestPath = path;
      error.issues = Array.isArray(result?.issues) ? result.issues : [];
      error.operation = ['outline', 'stage'].includes(payload?.operation) ? payload.operation : '';
      error.stageIndex = Number.isInteger(payload?.stageIndex) ? payload.stageIndex : null;
      error.attempts = attempt;
      error.status = response?.status;
      error.requestId = result?.requestId || response?.headers.get('x-request-id') || clientRequestId;
      if (transport) {
        error.reason = controller.signal.aborted ? '请求等待超时，未能取得服务响应。' : '网络连接中断，浏览器未能取得服务响应。';
        error.suggestion = '请确认网络连接后再次生成，已完成的课程阶段会保留。';
      }
      if ((transport || [408, 429, 502, 503, 504].includes(response?.status)) && attempt < attempts) {
        clearTimeout(timer);
        await sleep(750 * attempt);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function requestFailureMetadata(error, stage) {
  return {
    stage,
    code: /^[A-Z][A-Z0-9_]{1,80}$/.test(error.message || '') ? error.message : 'UNEXPECTED_CLIENT_ERROR',
    path: error.requestPath || '',
    attempts: error.attempts || 1,
    status: error.status || null,
    requestId: error.requestId || '',
    operation: error.operation || '',
    stageIndex: error.stageIndex ?? null,
  };
}
