export const isSchoolFinal = exam => /期末|\bfinal(?:s)?\b/i.test(exam.name || '');

export function schoolFinalPlacement(exam, finals, stages, officialExamDate) {
  if (finals.length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(exam.date || '')) return -1;
  const official = /^(\d{4})\s*[年-]\s*(\d{1,2})/.exec(officialExamDate || '');
  if (!official || exam.date.slice(0,7) >= official[1]+'-'+official[2].padStart(2,'0')) return -1;
  const hasFinal = stage => isSchoolFinal({name:stage.title});
  const review = stages.findIndex(stage => hasFinal(stage) && /考后|复盘|讲评/.test(stage.title));
  return review > 0 && hasFinal(stages[review-1]) && /考前|备考|复习/.test(stages[review-1].title) ? review : -1;
}
