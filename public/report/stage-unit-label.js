const nonNumbered = new Set(['ap_csp','ap_seminar','ap_english_language','ap_micro_macro_economics']);

export function stageUnitLabel(subject, stage, moduleCount) {
  if (!subject.startsWith('ap_') || nonNumbered.has(subject)) return '';
  const offset = subject === 'ap_physics_2' ? 8 : subject === 'ap_physics_c_electricity_magnetism' ? 7 : 0;
  const codes = stage.lessons.flatMap(lesson => lesson.unitCodes || []);
  const units = [...new Set(codes.map(code => {
    const canonical = /^[a-z0-9]+_u(\d+)$/i.exec(code);
    if (canonical) {
      const index = Number(canonical[1]);
      return index > 0 && index <= moduleCount ? index + offset : 0;
    }
    return 0;
  }).filter(Boolean))].sort((a,b)=>a-b);
  if (!units.length) return '';
  const label = subject === 'ap_us_history' ? 'Period' : 'Unit';
  const named = [...stage.title.matchAll(/\b(?:Unit|Period)\s*(\d+)\b/gi)].map(match=>Number(match[1]));
  if (units.length > 1 && named.length === 1 && units.includes(named[0]) && /主学\s*(?:Unit|Period)/i.test(stage.title)) {
    return `主学 ${label} ${named[0]} · 涉及 ${label} ${units.filter(n=>n!==named[0]).join('、')}`;
  }
  return `${label} ${units.join('、')}`;
}
