function uniqueMatches(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    const key = JSON.stringify(match);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractRanges(notes, pattern) {
  return uniqueMatches([...String(notes || '').matchAll(pattern)].map((match) => ({
    minimum: Number(match[1]),
    maximum: Number(match[2] || match[1]),
    text: match[0].trim(),
  })).filter((match) => Number.isFinite(match.minimum) && Number.isFinite(match.maximum)));
}

function formatRange(match, suffix) {
  return match.minimum === match.maximum
    ? `${match.minimum}${suffix}`
    : `${match.minimum}–${match.maximum}${suffix}`;
}

function numericConflict(field, label, formValue, matches, suffix) {
  const expected = Number(formValue);
  if (!Number.isFinite(expected)) return [];
  return matches
    .filter((match) => expected < match.minimum || expected > match.maximum)
    .map((match) => ({
      field,
      label,
      noteValue: formatRange(match, suffix),
      formValue: `${expected}${suffix}`,
      sourceText: match.text,
    }));
}

function parseExamDate(value) {
  const match = String(value || '').match(/(20\d{2})\D{0,3}(1[0-2]|0?[1-9])/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

function extractExamDates(notes) {
  const text = String(notes || '');
  const fullDateMatches = [...text.matchAll(/(20\d{2})\s*(?:年|[./-])\s*(1[0-2]|0?[1-9])\s*月?/g)];
  const fullDateRanges = fullDateMatches.map((match) => ({ start: match.index, end: match.index + match[0].length }));
  const fullDates = fullDateMatches.map((match) => ({
    year: Number(match[1]),
    month: Number(match[2]),
    text: match[0].trim(),
  }));
  const monthOnly = [...text.matchAll(/(?:想|计划|准备|预计|目标)?\s*(1[0-2]|0?[1-9])\s*月\s*(?:考|考试|参加)/g)]
    .filter((match) => !fullDateRanges.some((range) => match.index >= range.start && match.index < range.end))
    .map((match) => ({
      year: null,
      month: Number(match[1]),
      text: match[0].trim(),
    }));
  return uniqueMatches([...fullDates, ...monthOnly]);
}

function scoreConflicts(notes, field, label, formValue, pattern) {
  const expected = Number(formValue);
  if (!Number.isFinite(expected) || String(formValue ?? '').trim() === '') return [];
  return uniqueMatches([...String(notes || '').matchAll(pattern)].map((match) => ({
    score: Number(match[1]),
    text: match[0].trim(),
  })))
    .filter((match) => Number.isFinite(match.score) && match.score !== expected)
    .map((match) => ({
      field,
      label,
      noteValue: `${match.score}分`,
      formValue: `${expected}分`,
      sourceText: match.text,
    }));
}

export function detectInputConflicts({
  teacherNotes,
  currentScore,
  targetScore,
  examDate,
  totalHours,
  lessonCount,
  includeExamTraining,
}) {
  const notes = String(teacherNotes || '');
  const totalHourMatches = extractRanges(
    notes,
    /(?:总课时(?:量)?|课时总量|总时长)\s*(?:为|是|需(?:要)?|预计|大约|约)?\s*(\d+(?:\.\d+)?)\s*(?:[-–—~～至到]\s*(\d+(?:\.\d+)?))?\s*(?:小时|h)/gi,
  );
  const lessonCountMatches = extractRanges(
    notes,
    /(?:总课次|预计课次|总共|一共|共计)\s*(?:为|是|需(?:要)?|安排|完成)?\s*(\d+)\s*(?:[-–—~～至到]\s*(\d+))?\s*(?:节课|课次|节)/g,
  );
  const conflicts = [
    ...numericConflict('totalHours', '总课时', totalHours, totalHourMatches, 'h'),
    ...numericConflict('lessonCount', '预计课次', lessonCount, lessonCountMatches, '节'),
    ...scoreConflicts(notes, 'currentScore', '当前成绩', currentScore, /(?:当前|目前|现在)(?:成绩|分数)?\s*(?:为|是|在)?\s*(\d{1,3})\s*分/g),
    ...scoreConflicts(notes, 'targetScore', '目标成绩', targetScore, /(?:目标|希望|想要|冲刺)(?:成绩|分数)?\s*(?:为|是|达到|到)?\s*(\d{1,3})\s*分/g),
  ];
  const expectedDate = parseExamDate(examDate);
  if (expectedDate) {
    for (const date of extractExamDates(notes)) {
      if (date.month === expectedDate.month && (!date.year || date.year === expectedDate.year)) continue;
      conflicts.push({
        field: 'examDate',
        label: '考试时间',
        noteValue: date.year ? `${date.year}年${date.month}月` : `${date.month}月`,
        formValue: `${expectedDate.year}年${expectedDate.month}月`,
        sourceText: date.text,
      });
    }
  }
  const examTrainingTerm = '(?:模考|模拟考试|完整(?:的)?测试|整套(?:的)?测试|套题|真题训练|考试训练)';
  const requestsExamTraining = new RegExp(`(?:想|希望|需要|建议|计划|安排|增加|加入|后续|再做)[^。；\\n]{0,20}${examTrainingTerm}`, 'i').test(notes);
  const rejectsExamTraining = new RegExp(`(?:不需要|不用|不要|暂不|无需)[^。；\\n]{0,12}${examTrainingTerm}`, 'i').test(notes);
  if (!includeExamTraining && requestsExamTraining) {
    conflicts.push({
      field: 'includeExamTraining',
      label: '考试训练安排',
      noteValue: '文字记录建议安排考试训练',
      formValue: '未勾选考试训练',
      sourceText: '考试训练相关描述',
    });
  }
  if (includeExamTraining && rejectsExamTraining) {
    conflicts.push({
      field: 'includeExamTraining',
      label: '考试训练安排',
      noteValue: '文字记录表示暂不安排考试训练',
      formValue: '已勾选考试训练',
      sourceText: '考试训练相关描述',
    });
  }
  return uniqueMatches(conflicts).filter((conflict, index, values) => (
    values.findIndex((item) => item.field === conflict.field && item.noteValue === conflict.noteValue && item.formValue === conflict.formValue) === index
  ));
}
