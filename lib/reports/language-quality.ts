const letterPattern = /\p{Letter}/u;
const allowedLetterScriptPattern = /[\p{Script_Extensions=Han}\p{Script_Extensions=Latin}\p{Script_Extensions=Greek}\p{Script_Extensions=Common}\p{Script_Extensions=Inherited}]/u;

function hasUnexpectedLetterScript(value: string) {
  return Array.from(value).some((character) => letterPattern.test(character) && !allowedLetterScriptPattern.test(character));
}

function collectUnexpectedLanguagePaths(value: unknown, path: string, paths: string[]) {
  if (paths.length >= 8) return;
  if (typeof value === 'string') {
    if (hasUnexpectedLetterScript(value)) paths.push(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUnexpectedLanguagePaths(item, `${path}[${index}]`, paths));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => collectUnexpectedLanguagePaths(item, `${path}.${key}`, paths));
  }
}

export function getUnexpectedScriptPaths(report: unknown) {
  const paths: string[] = [];
  collectUnexpectedLanguagePaths(report, 'report', paths);
  return paths;
}

export function getUnexpectedLanguageIssues(report: unknown) {
  const paths = getUnexpectedScriptPaths(report);
  if (!paths.length) return [];
  return [`报告出现中文、英文和数学符号之外的异常文字，必须改为简体中文或必要的英文术语。涉及字段：${paths.join('、')}`];
}
