export const FORM_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GENERATION_CHECKPOINT_TTL_MS = 24 * 60 * 60 * 1000;
export const RECOVERY_RECORD_VERSION = 1;

export function createExpiringRecord(payload, now, ttl) {
  return {
    version: RECOVERY_RECORD_VERSION,
    updatedAt: now,
    expiresAt: now + ttl,
    payload,
  };
}

export function readFreshRecord(serialized, now) {
  if (!serialized) return null;
  try {
    const record = JSON.parse(serialized);
    if (!record || record.version !== RECOVERY_RECORD_VERSION || !Number.isFinite(record.expiresAt) || record.expiresAt <= now) return null;
    if (!record.payload || typeof record.payload !== 'object') return null;
    return record;
  } catch {
    return null;
  }
}

export function createGenerationFingerprint(payload) {
  const source = stableSerialize(payload);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}-${source.length}`;
}

export function normalizeGeneratedStages(value, expectedLength) {
  if (!Array.isArray(value) || !Number.isInteger(expectedLength) || expectedLength < 1) return new Array(Math.max(0, expectedLength || 0));
  return Array.from({ length: expectedLength }, (_, index) => {
    const stage = value[index];
    if (!stage || typeof stage !== 'object' || !Array.isArray(stage.lessons) || stage.lessons.length < 1) return undefined;
    return stage;
  });
}

export function getPendingStageIndexes(generatedStages) {
  return generatedStages.flatMap((stage, index) => stage ? [] : [index]);
}

export function countCompletedStages(generatedStages) {
  return generatedStages.filter(Boolean).length;
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
