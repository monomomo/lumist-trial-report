import { randomUUID } from 'node:crypto';

export type GenerationStage =
  | 'configuration'
  | 'authentication'
  | 'request_validation'
  | 'model_generation'
  | 'quality_repair'
  | 'quality_validation'
  | 'response_assembly';

export type GenerationEvent = 'started' | 'repair_requested' | 'accepted_with_warnings' | 'failed' | 'succeeded';

export interface GenerationDiagnosticMetadata {
  stage: GenerationStage;
  subjectCode?: string;
  lessonCount?: number;
  issueCount?: number;
  errorCode?: string;
  errorType?: string;
  repairAttempted?: boolean;
}

export function buildGenerationDiagnostic(
  requestId: string,
  startedAt: number,
  event: GenerationEvent,
  metadata: GenerationDiagnosticMetadata,
  now = Date.now(),
) {
  return {
    event: 'report_generation',
    status: event,
    requestId,
    stage: metadata.stage,
    durationMs: Math.max(0, now - startedAt),
    ...(metadata.subjectCode ? { subjectCode: metadata.subjectCode } : {}),
    ...(Number.isInteger(metadata.lessonCount) ? { lessonCount: metadata.lessonCount } : {}),
    ...(Number.isInteger(metadata.issueCount) ? { issueCount: metadata.issueCount } : {}),
    ...(metadata.errorCode ? { errorCode: metadata.errorCode } : {}),
    ...(metadata.errorType ? { errorType: metadata.errorType } : {}),
    ...(metadata.repairAttempted !== undefined ? { repairAttempted: metadata.repairAttempted } : {}),
  };
}

export function createGenerationDiagnostics() {
  const requestId = randomUUID();
  const startedAt = Date.now();
  return {
    requestId,
    record(event: GenerationEvent, metadata: GenerationDiagnosticMetadata) {
      const payload = JSON.stringify(buildGenerationDiagnostic(requestId, startedAt, event, metadata));
      if (event === 'failed') {
        console.error(payload);
        return;
      }
      if (event === 'repair_requested' || event === 'accepted_with_warnings') {
        console.warn(payload);
        return;
      }
      console.info(payload);
    },
  };
}
