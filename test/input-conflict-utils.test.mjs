import assert from 'node:assert/strict';
import test from 'node:test';
import { detectInputConflicts } from '../public/report/input-conflict-utils.js';

function detect(overrides = {}) {
  return detectInputConflicts({
    teacherNotes: '学生课堂表现积极，能够认真完成任务。',
    currentScore: '480',
    targetScore: '700',
    examDate: '2026.12',
    totalHours: '32',
    lessonCount: '21',
    includeExamTraining: false,
    ...overrides,
  });
}

test('detects total hour conflicts without treating weekly frequency as a total', () => {
  const conflicts = detect({
    teacherNotes: '预计一周2节，一次1.5小时，总课时量需要25小时左右。',
  });

  assert.deepEqual(conflicts.map((item) => item.field), ['totalHours']);
  assert.equal(conflicts[0].noteValue, '25h');
  assert.equal(conflicts[0].formValue, '32h');
});

test('accepts a structured value inside a natural-language range', () => {
  assert.equal(detect({ teacherNotes: '总课时预计25-30小时。', totalHours: '28' }).length, 0);
});

test('detects lesson count, score and exam date conflicts', () => {
  const conflicts = detect({
    teacherNotes: '目前成绩为450分，目标达到680分，计划2027年3月考试，总共安排18节课。',
  });

  assert.deepEqual(conflicts.map((item) => item.field), ['lessonCount', 'currentScore', 'targetScore', 'examDate']);
});

test('detects exam training intent that conflicts with the checkbox', () => {
  const conflicts = detect({
    teacherNotes: '学生希望后续再做一套完整的测试，方便进一步分析。',
    includeExamTraining: false,
  });

  assert.deepEqual(conflicts.map((item) => item.field), ['includeExamTraining']);
});

test('does not report optional blank structured fields as conflicts', () => {
  const conflicts = detect({
    teacherNotes: '目前成绩为450分，目标达到680分，计划2027年3月考试。',
    currentScore: '',
    targetScore: '',
    examDate: '',
  });

  assert.deepEqual(conflicts, []);
});
