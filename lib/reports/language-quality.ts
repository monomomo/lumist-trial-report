const japaneseScriptPattern = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

function collectUnexpectedLanguagePaths(value: unknown, path: string, paths: string[]) {
  if (paths.length >= 8) return;
  if (typeof value === 'string') {
    if (japaneseScriptPattern.test(value)) paths.push(path);
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

export function getUnexpectedLanguagePaths(report: unknown) {
  const paths: string[] = [];
  collectUnexpectedLanguagePaths(report, 'report', paths);
  return paths;
}

export function getUnexpectedLanguageIssues(report: unknown) {
  const paths = getUnexpectedLanguagePaths(report);
  if (!paths.length) return [];
  return [`报告出现日文假名，必须改为简体中文或必要的英文术语。涉及字段：${paths.join('、')}`];
}
