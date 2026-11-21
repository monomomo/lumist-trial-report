export function apPlanScope(notes, unitCount) {
  notes = notes.split('\n').filter(line => !line.startsWith('【校内考试】')).join('\n');
  const token = /(?:\b(?:unit|u)\s*(\d+)\b|第\s*(\d+)\s*单元)/gi;
  const read = text => [...text.matchAll(token)].map(m => Number(m[1] || m[2])).filter(n => n >= 1 && n <= unitCount);
  const limit = notes.match(/(?:只|仅)(?:需要|需)?(?:补习|复习|学习|安排|规划|上到|学到|覆盖|准备|到|补|学|上|做|考)[^。；，,;\n]{0,40}/i);
  const units = read(notes);
  const start = read(notes.match(/(?:学到|学至|进度(?:在|到|为)?|正在学(?:习)?|目前在)\s*(?:(?:Unit|U)\s*\d+|第\s*\d+\s*单元)/i)?.[0] || '')[0] || units[0];
  const restricted = limit && (read(limit[0]).length || /quiz|小测|测验/i.test(limit[0]));
  if (restricted && start) {
    const selected = read(limit[0]);
    return selected.length ? selected : [start];
  }
  return start ? Array.from({length:unitCount-start+1},(_,i)=>start+i) : [];
}

export function apExamSections(code, modules, notes) {
  const count = code === 'ap_precalculus' ? 3 : code === 'ap_business_personal_finance' ? 4 : modules.length;
  const sections = modules.slice(0,count).map((_,i)=>i+1);
  if (['ap_csp','ap_seminar','ap_english_language','ap_micro_macro_economics'].includes(code)) return sections;
  const offset = code === 'ap_physics_2' ? 8 : code === 'ap_physics_c_electricity_magnetism' ? 7 : 0;
  const text = code === 'ap_us_history' ? notes.replace(/\bperiod\s*(\d+)/gi,'Unit $1') : notes;
  const scope = apPlanScope(text,count+offset).map(n=>n-offset).filter(n=>sections.includes(n));
  return scope.length ? scope : sections;
}
