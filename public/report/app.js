import { mountPaperWorkspace } from './paper-workspace.js?v=8';
import { ALLOWED_DURATIONS, cloneCoursePlan, calculateTotalHours, validateCoursePlan, moveItem, moveLesson, createStage, createLesson } from './course-plan-utils.js';
import { SUBJECT_CODES, SUBJECT_CATALOG, resolveSubject, validateSubjectScores } from './catalog.js';
import { createSubjectViewModel, normalizeTeacherProfile, buildFallbackReport, resolveTargetScore } from './report-domain.js';
import { stageUnitLabel } from './stage-unit-label.js';
import { isSchoolFinal, schoolFinalPlacement } from './school-final.js';
import { SUMMARY_FIELD_RULES, cloneReportSummary, validateReportSummary } from './summary-editor-utils.js';
import { buildGenerationChecklist, buildReportQualityChecks, humanizeReportWarning } from './report-quality-utils.js';
import { PLANNING_SCENARIOS, MAX_PLANNING_FOCUS_AREAS, getPlanningScenarioSample, getPlanningFocusOptions, normalizePlanningFocusAreas, resolvePlanningScenario, getLessonCountRange } from './planning-context.js';
import { detectInputConflicts } from './input-conflict-utils.js';
import { FORM_DRAFT_TTL_MS, GENERATION_CHECKPOINT_TTL_MS, createExpiringRecord, readFreshRecord, createGenerationFingerprint, normalizeGeneratedStages, getPendingStageIndexes, countCompletedStages } from './generation-recovery.js';
import { SAT_MATH_AREA_CONFIG, createEmptySatMathHours, sumSatMathHours, validateSatEnglishAssessment, validateSatMathHours } from './sat-context.js';
import { normalizeGenerationInput, getGenerationAction, sameCoursePlan } from './generation-policy.js';
import { requestReportJson, requestFailureMetadata } from './request-utils.js';
import { getWorkflowError } from './workflow-errors.js';
import { waitForPrintImage } from './export-utils.js';

if (window.parent !== window) {
  document.documentElement.classList.add('embedded-workspace');
  import('./workspace-ui.js?v=2').catch(error => console.warn('Report components unavailable', error));
}

const $ = (selector) => document.querySelector(selector);

function setDraftStatus(text, state = 'idle') {
  const status = $('#draft-status');
  status.textContent = text;
  status.dataset.state = state;
}
const setText = (selector, value) => { $(selector).textContent = value; };
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const CSS_PIXELS_PER_INCH = 96;
const MILLIMETERS_PER_INCH = 25.4;
const REPORT_PAGE_HEIGHT_MM = 296;
const PLAN_PAGE_VERTICAL_PADDING = 84;
const PLAN_PAGE_SAFETY_MARGIN = 32;
const PLAN_PAGE_AVAILABLE_HEIGHT = REPORT_PAGE_HEIGHT_MM / MILLIMETERS_PER_INCH * CSS_PIXELS_PER_INCH
  - PLAN_PAGE_VERTICAL_PADDING
  - PLAN_PAGE_SAFETY_MARGIN;

const SUBJECT_GROUPS = [
  { label: '标化考试', codes: ['sat_math', 'sat_english'] },
  { label: 'AP 数学', codes: ['ap_precalculus', 'ap_calculus_ab', 'ap_calculus_bc', 'ap_statistics'] },
  { label: 'AP 计算机', codes: ['ap_csa', 'ap_csp'] },
  { label: 'AP 物理', codes: ['ap_physics_1', 'ap_physics_2', 'ap_physics_c_mechanics', 'ap_physics_c_electricity_magnetism'] },
  { label: 'AP 自然科学', codes: ['ap_chemistry', 'ap_biology', 'ap_environmental_science'] },
  { label: 'AP 商科与经济', codes: ['ap_business_personal_finance', 'ap_microeconomics', 'ap_macroeconomics', 'ap_micro_macro_economics'] },
  { label: 'AP 历史', codes: ['ap_us_history', 'ap_world_history', 'ap_european_history'] },
  { label: 'AP 社会科学', codes: ['ap_psychology', 'ap_human_geography', 'ap_comparative_government', 'ap_us_government'] },
  { label: 'AP 英语', codes: ['ap_english_literature', 'ap_english_language'] },
  { label: 'AP 艺术', codes: ['ap_art_history', 'ap_music_theory'] },
  { label: 'AP 世界语言', codes: ['ap_chinese', 'ap_latin'] },
  { label: 'AP Capstone', codes: ['ap_seminar'] }
];

const SUBJECT_SEARCH_ALIASES = {
  sat_math: 'SAT数学 数学',
  sat_english: 'SAT英语 阅读 写作',
  ap_precalculus: 'AP预备微积分 预备微积分',
  ap_calculus_ab: 'AP微积分AB 微积分AB',
  ap_calculus_bc: 'AP微积分BC 微积分BC',
  ap_statistics: 'AP统计 统计学',
  ap_csa: 'AP计算机科学A APCSA CSA Java',
  ap_csp: 'AP计算机科学原理 APCSP CSP',
  ap_physics_1: 'AP物理1 代数物理',
  ap_physics_2: 'AP物理2 代数物理',
  ap_physics_c_mechanics: 'AP物理C力学 物理C力学 mechanics',
  ap_physics_c_electricity_magnetism: 'AP物理C电磁 物理C电磁 电磁学 electricity magnetism E&M',
  ap_chemistry: 'AP化学 化学',
  ap_biology: 'AP生物 生物',
  ap_environmental_science: 'AP环境科学 环科',
  ap_microeconomics: 'AP微观经济 微观经济学',
  ap_macroeconomics: 'AP宏观经济 宏观经济学',
  ap_micro_macro_economics: 'AP微观宏观联报 微观宏观 双科经济 Micro Macro economics 联动',
  ap_business_personal_finance: 'AP商业与个人理财 商业 个人理财 商科 Business Personal Finance BPF',
  ap_us_history: 'AP美国历史 APUSH 美史',
  ap_world_history: 'AP世界史 世界历史 WHAP',
  ap_european_history: 'AP欧洲史 欧洲历史',
  ap_psychology: 'AP心理学 心理',
  ap_human_geography: 'AP人文地理 人文地理',
  ap_comparative_government: 'AP比较政府与政治 比较政府 比较政治',
  ap_us_government: 'AP美国政府与政治 美国政府 AP Gov US Gov',
  ap_english_literature: 'AP英语文学与写作 英语文学 文学写作 AP Lit',
  ap_english_language: 'AP英语语言与写作 英语语言 语言写作 AP Lang',
  ap_art_history: 'AP艺术史 艺术历史',
  ap_music_theory: 'AP音乐理论 乐理',
  ap_chinese: 'AP汉语语言与文化 AP中文 汉语 中文',
  ap_latin: 'AP拉丁语 拉丁文',
  ap_seminar: 'AP研讨会 Seminar Capstone'
};

/* ── 科目选择 ── */

let currentSubjectCode = 'sat_math';
let currentReportData = null;
let currentReportId = null;
let reportAutoSaveTimer = null;
let historicalTeacherProfile = null;
let summaryPageCount = 1;
let isQuickPreview = false;
let visibleSubjectCodes = [];
let activeSubjectOptionIndex = -1;
let subjectSelectionConfirmed = true;
let generationChecklistResolver = null;
let planningSource = 'ai';
let uploadedCoursePlan = null;
let uploadedCoursePlanConfirmed = false;
let selectedCoursePlanFile = null;
let coursePlanParseVersion = 0;
let aiModeDraft = null;
let recoveryStorageScope = '';
let formDraftSaveTimer = null;
let formHasUserInput = false;
let activeGenerationSource = null;
let pendingRegenerationReportId = null;
let reportGenerationBaseline = null;
let pendingReportSaveToken = null;
const LEGACY_UPLOAD_REPORT_NOTE = '老师已上传并确认完整课程规划，本报告仅对老师提供的原规划进行结构化整理与排版。';
const FORM_DRAFT_STORAGE_KEY = 'lumist-report-form-draft-v1';
const GENERATION_CHECKPOINT_STORAGE_KEY = 'lumist-report-generation-checkpoint-v1';

function showWorkflowError(element, error, operation, progress = '') {
  error.requestId ||= globalThis.crypto?.randomUUID?.() || `support-${Date.now().toString(36)}`;
  const message = getWorkflowError(error, { operation });
  if (operation === 'export' && error.imageLabel) {
    message.reason = `${error.imageLabel}未能加载。导出已自动重试一次。`;
  }
  if (element.id === 'account-notice' && message.actionId === 'login') {
    message.reason = '请保留当前页面。登录后切回本页，即可继续填写。';
    message.action = '';
  }
  const labels = { generate: '继续生成', save: '重新保存', upload: '重新解析', history: '重试读取', export: '重试导出', input: '检查填写内容', profile: '重新读取资料', 'edit-plan': '检查课程规划', 'edit-summary': '检查试听总结', 'quick-preview': '重试样式预览' };
  const action = message.actionId === 'login'
    ? '<a href="/" target="_blank" rel="noopener">在新窗口重新登录</a>'
    : message.actionId && labels[message.actionId]
      ? `<button type="button" class="secondary-btn" data-workflow-action="${message.actionId}" data-workflow-focus="${escapeHtml(message.focus || '')}" data-workflow-operation="${operation}">${labels[message.actionId]}</button>` : '';
  element.classList.remove('hidden');
  element.setAttribute('role', 'alert');
  element.classList.add('error', 'workflow-error');
  const reloadAction = message.category === 'render' ? '<button type="button" class="secondary-btn" data-workflow-action="render">重新加载报告</button>' : '';
  element.innerHTML = `<strong>${escapeHtml(message.title)}</strong><p>${escapeHtml(message.reason)}</p>${message.action ? `<p>下一步：${escapeHtml(message.action)}</p>` : ''}${progress ? `<p>${escapeHtml(progress)}</p>` : ''}<div class="workflow-actions">${action}${reloadAction}</div>${error.requestId ? `<details><summary>多次尝试仍失败？查看问题编号</summary>参考编号：${escapeHtml(error.requestId)}</details>` : ''}`;
  console.warn('report-workflow-failure', requestFailureMetadata(error, operation));
  return message;
}

function renderSatMathHoursInputs(values = createEmptySatMathHours()) {
  $('#sat-math-hours-grid').innerHTML = SAT_MATH_AREA_CONFIG.map((item) => `<label><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.description)}</small></span><span class="sat-math-hour-input"><input type="text" inputmode="decimal" data-sat-math-hours="${escapeHtml(item.code)}" value="${escapeHtml(values[item.code] ?? '')}" aria-label="${escapeHtml(item.label)}课时"><i>h</i></span></label>`).join('');
  updateSatMathHoursSummary();
}

function collectSatMathHours() {
  return Object.fromEntries([...document.querySelectorAll('[data-sat-math-hours]')].map((input) => [input.dataset.satMathHours, input.value.trim()]));
}

function collectSatEnglishAssessment() {
  const testType = $('#language-test-type').value;
  if (!testType) return null;
  return {
    testType,
    scoreScale: testType === 'ielts_academic' ? 'ielts_0_9' : $('#language-score-scale').value,
    overallScore: $('#language-overall-score').value.trim(),
    readingScore: $('#language-reading-score').value.trim(),
    testDate: $('#language-test-date').value,
  };
}

function updateLanguageAssessmentFields() {
  const testType = $('#language-test-type').value;
  const enabled = Boolean(testType);
  $('#language-score-scale-field').classList.toggle('hidden', testType !== 'toefl_ibt');
  $('#language-overall-field').classList.toggle('hidden', !enabled);
  $('#language-reading-field').classList.toggle('hidden', !enabled);
  $('#language-test-date-field').classList.toggle('hidden', !enabled);
  $('#language-score-scale').disabled = testType !== 'toefl_ibt';
  $('#language-overall-score').disabled = !enabled;
  $('#language-reading-score').disabled = !enabled;
  $('#language-test-date').disabled = !enabled;
  $('#language-overall-score').required = enabled;
  const isIelts = testType === 'ielts_academic';
  $('#language-overall-label').textContent = isIelts ? 'IELTS 总分' : 'TOEFL 总分';
  $('#language-reading-label').textContent = isIelts ? 'IELTS 阅读（选填）' : 'TOEFL 阅读（选填）';
  $('#language-overall-score').placeholder = isIelts ? '例如：7.0' : ($('#language-score-scale').value === 'new_1_6' ? '例如：5.0' : '例如：100');
  $('#language-reading-score').placeholder = isIelts ? '例如：7.5' : ($('#language-score-scale').value === 'new_1_6' ? '例如：5.0' : '例如：26');
  $('#language-overall-score').setCustomValidity('');
  $('#language-reading-score').setCustomValidity('');
}

function updateSatMathHoursSummary() {
  if (currentSubjectCode !== 'sat_math' || planningSource !== 'ai') return;
  document.querySelectorAll('[data-sat-math-hours]').forEach((input) => input.setCustomValidity(''));
  const hours = collectSatMathHours();
  const assigned = sumSatMathHours(hours);
  const hasInput = Object.values(hours).some((value) => value !== '');
  const totalInput = $('#total-hours');
  totalInput.value = hasInput ? String(assigned) : '';
  totalInput.setCustomValidity('');
  $('#lesson-count').setCustomValidity('');
  updateLessonCountHint();
  const summary = $('#sat-math-hours-summary');
  summary.classList.remove('complete', 'error');
  if (!hasInput) {
    summary.textContent = '填写各领域课时后，系统自动汇总总课时；不安排的项目请填写 0。';
    return;
  }
  const validation = validateSatMathHours(hours, assigned);
  if (!validation.valid) {
    summary.classList.add('error');
    summary.textContent = `当前合计 ${assigned}h；${validation.message}。`;
    return;
  }
  if (assigned < 2 || assigned > 60) {
    summary.classList.add('error');
    summary.textContent = `当前合计 ${assigned}h；总课时须为 2–60 小时，请调整各领域课时。`;
    return;
  }
  summary.classList.add('complete');
  summary.textContent = `总课时已自动汇总：${assigned}h。预计课次请按实际授课安排独立填写。`;
}

function configureSatSubjectContext() {
  const isAi = planningSource === 'ai';
  const isSatEnglish = currentSubjectCode === 'sat_english' && isAi;
  const isSatMath = currentSubjectCode === 'sat_math' && isAi;
  $('#total-hours-label').textContent = isSatMath ? '总课时（自动汇总）' : '总课时（必填）';
  $('#total-hours').readOnly = isSatMath || (planningSource === 'upload' && uploadedCoursePlanConfirmed);
  $('#total-hours').required = isAi && !isSatMath;
  $('#total-hours').placeholder = isSatMath ? '填写下方各领域课时后自动计算' : '例如：50';
  $('#sat-english-context').classList.toggle('hidden', !isSatEnglish);
  $('#sat-math-context').classList.toggle('hidden', !isSatMath);
  $('#sat-english-context').querySelectorAll('input, select').forEach((control) => { control.disabled = !isSatEnglish; });
  $('#sat-math-context').querySelectorAll('input, button').forEach((control) => { control.disabled = !isSatMath; });
  $('.planning-exam-training-toggle').classList.toggle('hidden', !isAi || isSatMath);
  $('#include-exam-training').disabled = !isAi || isSatMath;
  if (isSatEnglish) updateLanguageAssessmentFields();
  if (isSatMath) updateSatMathHoursSummary();
}

function populateSubjectSelect() {
  const select = $('#subject-select');
  if (!select) return;
  select.innerHTML = '';
  SUBJECT_CODES.forEach((code) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = SUBJECT_CATALOG[code].displayName;
    select.appendChild(option);
  });
  select.value = currentSubjectCode;
  $('#subject-search').value = getSubjectShortName(currentSubjectCode);
  renderSubjectOptions('');
  configureExamDateField(currentSubjectCode);
  applyReportBrandAssets(currentSubjectCode);
  renderPlanningFocusOptions([]);
  configureSatSubjectContext();
}

function normalizeSubjectSearch(value) {
  return String(value || '').toLocaleLowerCase().replace(/[\s:：·\-—_&]+/g, '');
}

function getSubjectShortName(code) {
  const shortName = (SUBJECT_SEARCH_ALIASES[code] || SUBJECT_CATALOG[code].displayName).split(' ')[0];
  return shortName.replace(/^SAT(?=数学|英语)/, 'SAT ');
}

function getFilteredSubjectGroups(query) {
  const normalizedQuery = normalizeSubjectSearch(query);
  return SUBJECT_GROUPS.map((group) => ({
    ...group,
    codes: group.codes.filter((code) => {
      const haystack = normalizeSubjectSearch(`${SUBJECT_CATALOG[code].displayName} ${SUBJECT_SEARCH_ALIASES[code] || ''}`);
      return !normalizedQuery || haystack.includes(normalizedQuery);
    })
  })).filter((group) => group.codes.length > 0);
}

function renderSubjectOptions(query) {
  const container = $('#subject-options');
  const groups = getFilteredSubjectGroups(query);
  visibleSubjectCodes = groups.flatMap((group) => group.codes);
  activeSubjectOptionIndex = visibleSubjectCodes.indexOf(currentSubjectCode);
  if (activeSubjectOptionIndex < 0 && visibleSubjectCodes.length > 0) activeSubjectOptionIndex = 0;
  container.innerHTML = groups.length > 0
    ? groups.map((group) => `<section class="subject-option-group"><div>${escapeHtml(group.label)}</div>${group.codes.map((code) => `<button id="subject-option-${escapeHtml(code)}" type="button" role="option" data-subject-code="${escapeHtml(code)}" aria-selected="${code === currentSubjectCode}"><span>${escapeHtml(SUBJECT_CATALOG[code].displayName)}</span><small>${escapeHtml((SUBJECT_SEARCH_ALIASES[code] || '').split(' ')[0])}</small></button>`).join('')}</section>`).join('')
    : '<p class="subject-empty">没有匹配的科目</p>';
  updateActiveSubjectOption();
}

function updateActiveSubjectOption() {
  document.querySelectorAll('[data-subject-code]').forEach((option) => option.classList.toggle('active', option.dataset.subjectCode === visibleSubjectCodes[activeSubjectOptionIndex]));
  const activeCode = visibleSubjectCodes[activeSubjectOptionIndex];
  if (activeCode) $('#subject-search').setAttribute('aria-activedescendant', `subject-option-${activeCode}`);
  else $('#subject-search').removeAttribute('aria-activedescendant');
}

function openSubjectOptions() {
  $('#subject-options').classList.remove('hidden');
  $('#subject-search').setAttribute('aria-expanded', 'true');
}

function closeSubjectOptions() {
  $('#subject-options').classList.add('hidden');
  $('#subject-search').setAttribute('aria-expanded', 'false');
  $('#subject-search').removeAttribute('aria-activedescendant');
}

$('#subject-combobox').addEventListener('report-subject-search', (event) => renderSubjectOptions(event.detail));
$('#subject-combobox').addEventListener('report-subject-choice', (event) => chooseSubject(event.detail));
$('#course-plan-dropzone').addEventListener('report-upload', (event) => selectCoursePlanFile(event.detail));

function chooseSubject(code) {
  if (!SUBJECT_CODES.includes(code)) return;
  subjectSelectionConfirmed = true;
  $('#subject-search').setCustomValidity('');
  $('#subject-select').value = code;
  $('#subject-search').value = getSubjectShortName(code);
  closeSubjectOptions();
  $('#subject-select').dispatchEvent(new Event('change'));
}

function applyReportBrandAssets(subjectCode) {
  const track = subjectCode.startsWith('ap_') ? 'ap' : 'sat';
  const trackLabel = track === 'ap' ? 'AP' : 'SAT';
  $('#parent-report').classList.toggle('ap-report', track === 'ap');
  const cover = $('#report-cover-image');
  const closing = $('#report-closing-image');
  const highScore = $('#report-high-score-image');
  cover.dataset.screenSrc = `assets/lumist-${track}-cover.png`;
  cover.dataset.printSrc = `assets/lumist-${track}-cover-print.jpg`;
  cover.src = cover.dataset.screenSrc;
  cover.alt = `路觅 ${trackLabel} 学员学情报告封面`;
  closing.src = `assets/lumist-${track}-back.png`;
  closing.alt = `路觅 ${trackLabel} 学员学情报告封底`;
  highScore.dataset.screenSrc = `assets/lumist-${track}-high-score-cases.jpg`;
  highScore.dataset.printSrc = `assets/lumist-${track}-high-score-cases-print.jpg`;
  highScore.src = highScore.dataset.screenSrc;
  highScore.alt = `路觅 2026 ${trackLabel} 学员高分案例`;
}

function configureExamDateField(subjectCode) {
  const isApSubject = subjectCode.startsWith('ap_');
  const input = $('#exam-date');
  const select = $('#ap-exam-date');
  $('#exam-date-label').textContent = isApSubject ? 'AP 考试时间（固定为 5 月）' : '目标考试日期（可选）';
  input.classList.toggle('hidden', isApSubject);
  input.disabled = isApSubject;
  select.classList.toggle('hidden', !isApSubject);
  select.disabled = !isApSubject;
  if (!isApSubject) return;
  const firstExamYear = new Date().getFullYear() + 1;
  select.innerHTML = '';
  Array.from({ length: 5 }, (_, index) => firstExamYear + index).forEach((year) => {
    select.add(new Option(`${year} 年 5 月 AP 考试`, `${year}年5月`));
  });
}

function onSubjectChange() {
  applySubjectSelection($('#subject-select').value);
  refreshPreview();
}

function getSubjectTrack(code) {
  return code.startsWith('ap_') ? 'ap' : 'sat';
}

function resetFormForTrackChange({ clearRecovery = true } = {}) {
  $('#school-exams').replaceChildren();
  if ($('#parent-conclusion')) $('#parent-conclusion').value = '';
  if (!editingReportSource) {
    pendingRegenerationReportId = null;
    reportGenerationBaseline = null;
    $('#regeneration-options').classList.add('hidden');
    currentReportId = null;
    currentReportData = null;
    historicalTeacherProfile = null;
  }
  $('#student-name').value = '';
  $('#current-score').value = '';
  $('#target-score').value = '';
  $('#exam-date').value = '';
  $('#total-hours').value = '';
  $('#lesson-count').value = '';
  $('#planning-scenario').value = '';
  $('#include-exam-training').checked = false;
  $('#teacher-notes').value = '';
  $('#feedback-internal').value = '';
  $('#feedback-family').value = '';
  $('#feedback-review-status').textContent = '';
  $('#language-test-type').value = '';
  $('#language-score-scale').value = 'new_1_6';
  $('#language-overall-score').value = '';
  $('#language-reading-score').value = '';
  $('#language-test-date').value = '';
  $('#current-score').setCustomValidity('');
  $('#target-score').setCustomValidity('');
  $('#total-hours').setCustomValidity('');
  $('#lesson-count').setCustomValidity('');
  $('#language-overall-score').setCustomValidity('');
  $('#language-reading-score').setCustomValidity('');
  renderPlanningFocusOptions([]);
  renderSatMathHoursInputs();
  uploadedCoursePlan = null;
  uploadedCoursePlanConfirmed = false;
  selectedCoursePlanFile = null;
  aiModeDraft = null;
  coursePlanParseVersion += 1;
  $('#course-plan-file').value = '';
  $('#course-plan-dropzone').classList.remove('has-file');
  $('#course-plan-file-name').textContent = '尚未选择文件';
  $('#course-plan-upload-review').classList.add('hidden');
  $('#course-plan-upload-review').innerHTML = '';
  $('#course-plan-upload-status').className = 'course-plan-upload-status';
  $('#course-plan-upload-status').textContent = '';
  setPlanningSource('ai');
  if (clearRecovery) clearGenerationRecovery();
}

function applySubjectSelection(code, options = {}) {
  const selectedFocusAreas = getSelectedPlanningFocusAreas();
  const trackChanged = getSubjectTrack(currentSubjectCode) !== getSubjectTrack(code);
  if (trackChanged) resetFormForTrackChange(options);
  currentSubjectCode = code;
  const vm = createSubjectViewModel(code);
  subjectSelectionConfirmed = true;
  $('#subject-select').value = code;
  $('#subject-search').value = getSubjectShortName(code);
  $('#subject-search').setCustomValidity('');
  $('#current-score').setCustomValidity('');
  $('#target-score').setCustomValidity('');
  $('#form-eyebrow').textContent = `${getSubjectShortName(code)}试听`;
  const scoreLabel = code.startsWith('ap_') ? 'AP 成绩' : vm.scoreLabel;
  $('#score-label-current').textContent = `当前 ${scoreLabel}（可选）`;
  $('#score-label-target').textContent = code.startsWith('ap_') ? '目标 AP 成绩（默认 5）' : `目标 ${scoreLabel}（可选）`;
  $('#current-score').placeholder = vm.scoreMax > 100 ? `例如：${Math.round((vm.scoreMin + vm.scoreMax) / 2)}` : `例如：${Math.round((vm.scoreMin + vm.scoreMax) / 2)}`;
  $('#target-score').placeholder = code.startsWith('ap_') ? '默认 5 分' : `例如：${vm.scoreMax}`;
  configureExamDateField(code);
  applyReportBrandAssets(code);
  renderPlanningFocusOptions(trackChanged ? [] : selectedFocusAreas);
  $('#scenario-sample-hint').textContent = `当前提供 ${getSubjectShortName(code)} 的预习、同步和冲刺样例`;
  configureSatSubjectContext();
}

function refreshPreview() {
  if ($('#report-view').classList.contains('active')) return; // 报告已生成，不覆盖
  currentReportData = buildFallbackReport(currentSubjectCode, collectFormData());
  originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  renderReport(currentReportData);
}

/* ── 教师资料 ── */

let teacherProfile = null;

async function loadTeacherProfile() {
  try {
    const data = await requestReportJson('/api/me', undefined, { method: 'GET', timeoutMs: 15000 });
    recoveryStorageScope = typeof data.accountId === 'string' ? data.accountId : '';
    teacherProfile = normalizeTeacherProfile(data);
    $('#account-notice').classList.add('hidden');
    if (recoveryStorageScope && $('#draft-status').textContent === '草稿暂未保存') {
      setDraftStatus('草稿自动保存');
    }
    $('#sidebar-teacher').hidden = !teacherProfile;
    if (teacherProfile) {
      renderSidebarTeacher();
      renderTeacherProfile();
      setText('#info-teacher', getActiveTeacherProfile().displayName);
    }
    return Boolean(recoveryStorageScope);
  } catch (error) {
    $('#sidebar-teacher').hidden = true;
    setDraftStatus('草稿暂未保存', 'warning');
    showWorkflowError($('#account-notice'), error, 'profile');
    return false;
  }
}

let recheckProfileOnReturn = false;
$('#account-notice').addEventListener('click', (event) => {
  if (event.target.closest('a[target="_blank"]')) recheckProfileOnReturn = true;
});
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !recheckProfileOnReturn) return;
  recheckProfileOnReturn = false;
  if (await loadTeacherProfile() && formHasUserInput) saveFormDraft();
});

function renderSidebarTeacher() {
  if (!teacherProfile) return;
  const footer = $('#sidebar-teacher');
  footer.classList.remove('error', 'workflow-error');
  footer.removeAttribute('role');
  footer.innerHTML = `<div class="avatar">${escapeHtml(teacherProfile.displayPlaceholder)}</div><div><strong>${escapeHtml(teacherProfile.displayName)}</strong><small>${escapeHtml(teacherProfile.title)}</small></div>`;
}

function getActiveTeacherProfile() {
  return historicalTeacherProfile || teacherProfile;
}

/* ── 兜底默认规划（从 HTML 初始静态课时页提取） ── */

const hourPlanDifficulties = [
  '明确四大模块、Bluebook 操作与首套题诊断的流程。',
  '区分方程、方程组与不等式的建模条件。',
  '完成函数表示之间的转换，并读懂图像信息。',
  '掌握二次函数、多项式与零点题的常见模型。',
  '识别指数、非线性与含参题的切入点。',
  '熟练处理百分比、比率与复合单位换算。',
  '理解条件概率、抽样推断与统计量的适用情境。',
  '恢复角度关系、平行线与三角形基础定理。',
  '识别全等、相似及比例、面积比、体积比关系。',
  '熟练运用特殊直角三角形和勾股定理。',
  '掌握圆心角、圆周角、切线、弧长和扇形关系。',
  '建立距离、中点、斜率、圆方程的坐标解题路径。',
  '恢复三角比与角度、弧度转换。',
  '处理几何与代数、函数、比例结合的综合题。',
  '掌握方程、交点、表格和滑块的工具入口。',
  '判断何时手算、代入或使用 Desmos 提速。',
  '按错题类型定位知识、方法、审题或时间问题。',
  '通过每题用时、跳题和回查定位时间损耗。',
  '围绕首轮 Report 的重复错因安排针对性补强。',
  '在限时条件下验证专项训练是否转化为正确率。',
  '检查 Module 1 的正确率、用时与题型分布。',
  '优化 Module 2 的难题处理、跳题与时间止损。',
  '训练复杂建模和含参代数的高难题路径。',
  '将综合几何与 Desmos 策略融入真实难题。',
  '追踪重复错误，形成个人高频避坑清单。',
  '对高频薄弱点进行小专题限时重测。',
  '完成完整限时模考，观察稳定分数区间。',
  '复盘最后一套模考的错题、用时和考试策略。',
  '整理错题、公式、Desmos 和考场节奏清单。',
  '确认关键问题、考场流程与最后答疑事项。'
];

function getDefaultCoursePlan() {
  const sourcePages = Array.from(document.querySelectorAll('.hour-plan'));
  const lessons = sourcePages.flatMap((page) => Array.from(page.querySelectorAll('tbody tr')).map((row) => {
    const cells = row.querySelectorAll('td');
    return { duration: 1, theme: cells[1].textContent, content: cells[2].textContent, goal: cells[3].textContent };
  }));
  const stageDefinitions = [
    [0, 10, '阶段一 · 知识框架与基础恢复', '建立 SAT 数学知识地图，恢复代数、函数、数据与基础几何'],
    [10, 10, '阶段二 · 专项突破与工具提速', '补齐几何与三角模块，建立 Desmos、错因定位和限时策略'],
    [20, 10, '阶段三 · 高分稳定与考前闭环', '通过高难题、套题复盘、完整模考和考前清单稳定考试表现']
  ];
  sourcePages.forEach((page) => page.remove());
  return {
    totalHours: 30,
    rationale: '先建立完整知识框架，再根据套题错因、用时与实际掌握度动态调整专项训练。',
    stages: stageDefinitions.map(([start, count, title, description]) => ({
      title,
      description,
      lessons: lessons.slice(start, start + count).map((lesson, index) => ({ ...lesson, difficulty: hourPlanDifficulties[start + index] }))
    }))
  };
}

function layoutSummaryPages() {
  const page = document.querySelector('.summary-page:not(.summary-continuation-page)');
  const pageContent = page.querySelector('.summary-page-content');
  const existingContinuation = document.querySelector('.summary-continuation-page');
  const recent = document.querySelector('.report-recent-plan');
  const learningSection = existingContinuation?.querySelector('.summary-learning-section') || page.querySelector('.summary-learning-section');
  if (existingContinuation) {
    pageContent.append(learningSection, recent);
    existingContinuation.remove();
  }
  page.classList.remove('summary-page-compact', 'summary-page-condensed');
  const measurementHost = document.createElement('div');
  measurementHost.className = 'summary-measurement-host';
  document.body.appendChild(measurementHost);
  const pageFits = (candidate) => {
    measurementHost.innerHTML = '';
    const clone = candidate.cloneNode(true);
    measurementHost.appendChild(clone);
    return clone.querySelector('.summary-page-content').scrollHeight <= PLAN_PAGE_AVAILABLE_HEIGHT;
  };

  summaryPageCount = 1;
  if (pageFits(page)) {
    measurementHost.remove();
    return;
  }
  page.classList.add('summary-page-compact');
  if (pageFits(page)) {
    measurementHost.remove();
    return;
  }
  page.classList.add('summary-page-condensed');
  if (pageFits(page)) {
    measurementHost.remove();
    return;
  }

  page.classList.remove('summary-page-condensed');
  const continuation = document.createElement('article');
  continuation.className = 'report-page summary-page summary-continuation-page summary-page-compact';
  continuation.innerHTML = '<div class="summary-page-content"><img class="report-brand-header" src="assets/lumist-report-header-black.png" alt="路觅教育" /><div class="page-kicker">试听学情（续）</div><h2>试听反馈与学习成果</h2></div>';
  continuation.querySelector('.summary-page-content').append(learningSection, recent);
  page.after(continuation);
  if (!pageFits(page)) page.classList.add('summary-page-condensed');
  if (!pageFits(continuation)) continuation.classList.add('summary-page-condensed');
  summaryPageCount = 2;
  measurementHost.remove();
}

function stageAssessmentHtml(stage, stageIndex) {
  if (!stage.assessment) return '';
  const { objective, task, target, adjustment } = stage.assessment;
  const value = (field, text) => stageIndex === undefined ? escapeHtml(text) : `<span class="layout-value" data-layout-path="plan.${stageIndex}.assessment.${field}">${escapeHtml(text)}</span>`;
  return `<div class="stage-assessment">${objective ? `<p><b>阶段目标：</b>${value('objective', objective)}</p>` : ''}<p><b>达标标准：</b>${value('target', target)}</p><p><b>检验方式：</b>${value('task', task)}</p><p><b>未达标时：</b>${value('adjustment', adjustment)}</p></div>`;
}

// Document anchors are separate from the numbering shown after a reorder.
function reportAnchor(kind, item, index) {
  const key = String(item.id ?? index).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `report-${kind}-${key}`;
}

function stageRecapHtml(stage,index) {
  const task = stage.assessment?.task || '';
  const logistics = /[0-9０-９零一二两三四五六七八九十百半]+\s*(?:分钟|小时|秒钟|道|小题|题|分\b|%|％)|\d+\s*\/\s*\d+|逐题/;
  const concise = task && !logistics.test(task);
  const focus = concise ? task : stage.assessment?.objective || stage.title;
  const fields = [['task','怎么确认掌握',focus,concise],['adjustment','后续调整',stage.assessment?.adjustment,true]];
  const detail = stage.assessment ? fields.filter(([, , value]) => value && !logistics.test(value)).map(([key,label,value,editable]) =>
    `<p><b>${label}：</b><span${index === undefined || !editable ? '' : ` data-layout-path="plan.${index}.assessment.${key}"`}>${escapeHtml(value)}</span></p>`).join('') : '';
  return '<h3>阶段测与学情反馈</h3>' + (detail || '<p>本阶段结束后，由老师结合学生作答反馈掌握情况与下一步建议。</p>');
}

function renderCoursePlan(coursePlan) {
  // Legacy reports acquire IDs before their next normal save. Reordering only changes display numbers.
  const seenIds = new Set();
  for (const stage of coursePlan.stages) {
    for (const entry of [stage, ...stage.lessons]) {
      if (!entry.id || seenIds.has(entry.id)) entry.id = crypto.randomUUID();
      seenIds.add(entry.id);
    }
  }
  const report = $('#parent-report');
  const teacherPage = report.querySelector('.teacher-page');
  const measurement = document.createElement('div');
  measurement.className = 'plan-measurement-host';
  document.body.append(measurement);
  const detailPages = [];
  const overviewPages = [];
  const stages = [];
  let lessonNumber = 0;
  const number = (value) => String(value).padStart(2, '0');
  const range = (first, last) => first === last ? number(first) : `${number(first)}–${number(last)}`;
  const header = '<img class="report-brand-header" src="assets/lumist-report-header-black.png" alt="路觅教育">';
  const getBody = (page) => page.querySelector('.plan-page-body');
  const overflows = (page) => getBody(page).scrollHeight > PLAN_PAGE_AVAILABLE_HEIGHT;

  function makePage(list, kind, html) {
    const page = document.createElement('article');
    page.className = `report-page hour-plan reference-plan-page report-${kind}-page`;
    page.innerHTML = `<div class="plan-page-body">${header}${html}</div><footer class="report-page-number"></footer>`;
    measurement.append(page);
    list.push(page);
    return page;
  }

  for (const [index, stage] of coursePlan.stages.entries()) {
    const anchor = reportAnchor('stage', stage, index);
    const stagePath = `plan.${index}`;
    const first = lessonNumber + 1;
    const last = lessonNumber + stage.lessons.length;
    const hours = calculateTotalHours({ stages: [stage] });
    const unitLabel = stageUnitLabel(currentSubjectCode, stage, createSubjectViewModel(currentSubjectCode).modules.length);
    const objective = stage.assessment?.objective || stage.assessment?.target || stage.description;
    const objectivePath = stage.assessment?.objective ? 'assessment.objective' : stage.assessment?.target ? 'assessment.target' : 'description';
    const firstPageIndex = detailPages.length;
    let page;

    function makeDetailPage(continuation) {
      const next = makePage(detailPages, 'detail', `<div class="page-kicker">辅导阶段 ${number(index + 1)}${continuation ? '（续）' : ''}</div>
        <section class="plan-stage-group" data-stage-index="${index}" data-stage-name="${escapeHtml(stage.title)}">
          <h2 data-layout-path="${stagePath}.title">${escapeHtml(stage.title)}</h2>
          <p class="report-stage-locator">${unitLabel ? escapeHtml(unitLabel)+' · ' : ''}<span data-page-lesson-range></span> · 阶段共 ${hours} 小时</p>
          ${continuation ? '' : `<div class="report-stage-objectives">
            ${objective ? `<p><b>${stage.assessment?.objective ? '学完能做到什么' : '阶段重点'}</b><span data-layout-path="${stagePath}.${objectivePath}">${escapeHtml(objective)}</span></p>` : ''}
            ${stage.assessment?.examValue ? `<p><b>对考试有什么用</b><span data-layout-path="${stagePath}.assessment.examValue">${escapeHtml(stage.assessment.examValue)}</span></p>` : ''}
            ${stage.description && objectivePath !== 'description' ? `<p><b>课程安排</b><span data-layout-path="${stagePath}.description">${escapeHtml(stage.description)}</span></p>` : ''}
          </div>`}
          <div class="report-lesson-list"></div>
        </section>`);
      if (!continuation) next.id = anchor;
      return next;
    }

    function updateRange() {
      const lessons = page.querySelectorAll('.plan-lesson-row');
      const start = Number(lessons[0]?.dataset.lessonNumber || first);
      const end = Number(lessons[lessons.length - 1]?.dataset.lessonNumber || start);
      page.querySelector('[data-page-lesson-range]').textContent = `本页第 ${range(start, end)} 课`;
    }

    page = makeDetailPage(false);
    const lessonAnchors = [];
    for (const [localIndex, lesson] of stage.lessons.entries()) {
      lessonNumber += 1;
      const lessonAnchor = reportAnchor('lesson', lesson, localIndex);
      lessonAnchors.push(lessonAnchor);
      const lessonPath = `${stagePath}.lessons.${localIndex}`;
      const fields = [['goal', '学习目标']]
        .filter(([field]) => lesson[field])
        .map(([field, label]) => ({ field, label, text: String(lesson[field]) }));

      const newBlock = (continuation) => {
        const block = document.createElement('section');
        block.className = 'plan-lesson-row';
        block.dataset.stageIndex = index;
        block.dataset.stageLessonIndex = localIndex;
        block.dataset.lessonNumber = lessonNumber;
        if (!continuation) block.id = lessonAnchor;
        block.innerHTML = `<header><small>第 ${number(lessonNumber)} 课${continuation ? '（续）' : ''}</small>
          <b data-layout-path="${lessonPath}.theme">${escapeHtml(lesson.theme)}</b><span>${escapeHtml(lesson.duration)} 小时</span></header>`;
        page.querySelector('.report-lesson-list').append(block);
        return block;
      };

      function appendField(block, { field, label }, content) {
        const row = document.createElement('p');
        row.className = `report-lesson-field report-lesson-${field}`;
        row.innerHTML = `<b>${label}</b><span class="layout-value" data-layout-path="${lessonPath}.${field}"></span>`;
        row.lastElementChild.textContent = content;
        block.append(row);
        return row;
      }

      let block = newBlock(false);
      for (const field of fields) appendField(block, field, field.text);
      updateRange();
      if (!overflows(page)) continue;

      const hadEarlierLesson = Boolean(block.previousElementSibling);
      if (hadEarlierLesson) {
        block.remove();
        updateRange();
        page = makeDetailPage(true);
        page.querySelector('.report-lesson-list').append(block);
        updateRange();
        if (!overflows(page)) continue;
      }

      // Split only oversized lessons. Prefer field boundaries; a field larger than a full page is split at text boundaries.
      block.querySelectorAll('.report-lesson-field').forEach(row => row.remove());
      for (const field of fields) {
        let remaining = Array.from(field.text);
        while (remaining.length) {
          const row = appendField(block, field, remaining.join(''));
          updateRange();
          if (!overflows(page)) break;
          if (!block.querySelector('.report-lesson-field + .report-lesson-field')) {
            let low = 0, high = remaining.length - 1;
            while (low < high) {
              const middle = Math.ceil((low + high) / 2);
              row.lastElementChild.textContent = remaining.slice(0, middle).join('');
              if (overflows(page)) high = middle - 1;
              else low = middle;
            }
            const take = Math.max(1, low);
            row.lastElementChild.textContent = remaining.slice(0, take).join('');
            remaining = remaining.slice(take);
          } else {
            row.remove();
          }
          if (remaining.length) {
            page = makeDetailPage(true);
            block = newBlock(true);
          }
        }
      }
    }
    const recap = document.createElement('aside');
    recap.className = 'report-stage-recap';
    recap.innerHTML = stageRecapHtml(stage,index);
    page.querySelector('.plan-stage-group').append(recap);
    if (overflows(page)) {
      const lastLesson = page.querySelector('.report-lesson-list').lastElementChild;
      const moveLesson = Boolean(lastLesson?.previousElementSibling);
      recap.remove();
      if (moveLesson) {
        lastLesson.remove();
        updateRange();
      }
      page = makeDetailPage(true);
      if (moveLesson) page.querySelector('.report-lesson-list').append(lastLesson);
      if (moveLesson) updateRange();
      else page.querySelector('[data-page-lesson-range]').textContent = '阶段总结';
      page.querySelector('.plan-stage-group').append(recap);
    }
    stages.push({ stage, index, anchor, first, last, hours, unitLabel, objective, objectivePath, firstPageIndex,
      lastPageIndex: detailPages.length - 1, lessonAnchors });
  }

  const newOverview = () => {
    const continuation = overviewPages.length > 0;
    const page = makePage(overviewPages, 'overview',
      `<div class="page-kicker">课程规划</div><div class="plan-page-heading"><h2>课程规划总览${continuation ? '（续）' : ''}</h2>
      <div class="plan-total-hours"><b>${calculateTotalHours(coursePlan)} 小时</b><span>${stages.length} 个阶段</span></div></div>`);
    if (!continuation) {
      page.id = 'report-plan-overview';
      if (coursePlan.rationale) {
        const note = document.createElement('p');
        note.className = 'report-overview-meta';
        note.textContent = coursePlan.rationale;
        getBody(page).append(note);
      }
    }
    return page;
  };

  const recent = report.querySelector('.report-recent-plan');
  const initialStage = stages[0];
  recent.hidden = !initialStage?.lessonAnchors.length;
  if (!recent.hidden) {
    recent.innerHTML = `<h3>近期学习安排</h3><p class="recent-stage-name"><span>接下来学习</span> ${escapeHtml(initialStage.stage.title)}</p>
      <ul class="recent-lesson-list">${initialStage.stage.lessons.slice(0, 3).map((lesson, index) => `<li>
        <a class="recent-lesson-link" href="#${initialStage.lessonAnchors[index]}">第 ${number(index + 1)} 课</a>
        <div><h4>${escapeHtml(lesson.theme)}</h4>${lesson.goal ? `<p>${escapeHtml(lesson.goal)}</p>` : ''}</div>
      </li>`).join('')}</ul><a class="report-summary-to-plan" href="#report-plan-overview">查看课程规划总览</a>`;
  }
  layoutSummaryPages();

  let overview = newOverview();
  const plannedExams = schoolExamsFromNotes(currentReportData?.generationInput?.teacherNotes)
    .filter(exam => !exam.date || exam.date >= new Date().toLocaleDateString('sv-SE', {timeZone:'Asia/Shanghai'}));
  const finals = currentSubjectCode.startsWith('ap_') ? plannedExams.filter(isSchoolFinal) : [];
  const placed = new Set();
  for (const entry of stages) {
    const { stage, index, anchor, hours, first, last, unitLabel, objective, objectivePath } = entry;
    for (const exam of finals) {
      if (schoolFinalPlacement(exam, finals, coursePlan.stages, currentReportData?.generationInput?.examDate) !== index) continue;
      const milestone = document.createElement('section');
      milestone.className = 'phase-brief';
      milestone.innerHTML = `<h3>校内期末考试 · ${escapeHtml(exam.date)}</h3><p>${escapeHtml(exam.scope || '范围待确认')} · 考试不计入辅导课时</p>`;
      getBody(overview).append(milestone);
      if (overflows(overview)) getBody(overview = newOverview()).append(milestone);
      placed.add(exam);
    }
    const item = document.createElement('section');
    item.className = 'plan-overview-stage';
    item.dataset.number = number(index + 1);
    item.innerHTML = `<h3><span data-layout-path="plan.${index}.title">${escapeHtml(stage.title)}</span>
      <a href="#${anchor}" class="report-stage-page-link" aria-label="查看阶段 ${index + 1} 的课次">明细 P000–000</a></h3>
      <p class="report-overview-meta">${unitLabel ? escapeHtml(unitLabel)+' · ' : ''}第 ${range(first, last)} 课 · ${hours} 小时</p>
      ${objective ? `<p data-layout-path="plan.${index}.${objectivePath}">${escapeHtml(objective)}</p>` : ''}`;
    entry.link = item.querySelector('a');
    getBody(overview).append(item);
    if (item.previousElementSibling?.matches('.plan-overview-stage,.phase-brief') && overflows(overview)) {
      overview = newOverview();
      getBody(overview).append(item);
    }
  }

  const exams = plannedExams.filter(exam => !placed.has(exam))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  let examPage;
  for (const exam of exams) {
    const item = document.createElement('section');
    item.className = 'phase-brief';
    item.innerHTML = `<h3>${escapeHtml(exam.name || '校内考试')} · ${escapeHtml(exam.date || '日期待确认')}</h3>
      <p><b>范围：</b>${escapeHtml(exam.scope || '待学校确认')}　<b>考前可用课时：</b>${escapeHtml(exam.hours === '' || exam.hours == null ? '未确认' : exam.hours + 'h')}</p>`;
    if (isSchoolFinal(exam)) item.innerHTML += '<p>考前按校内范围复习；考后结合试卷、错题或短测复盘，与正式大考重合的内容不重复计课时。</p>';
    if (!examPage) examPage = makePage(overviewPages, 'overview', '<div class="page-kicker">课程规划</div><h2>校内考试安排</h2>');
    getBody(examPage).append(item);
    if (item.previousElementSibling?.classList.contains('phase-brief') && overflows(examPage)) {
      examPage = makePage(overviewPages, 'overview', '<div class="page-kicker">课程规划</div><h2>校内考试安排（续）</h2>');
      getBody(examPage).append(item);
    }
  }

  const detailOffset = 2 + summaryPageCount + overviewPages.length;
  for (const stage of stages) {
    const first = detailOffset + stage.firstPageIndex;
    const last = detailOffset + stage.lastPageIndex;
    stage.link.textContent = first === last ? `明细 P${first}` : `明细 P${first}–${last}`;
  }
  report.querySelectorAll('.reference-plan-page').forEach(page => page.remove());
  teacherPage.before(...overviewPages, ...detailPages);
  measurement.remove();
  teacherPage.querySelector('.page-kicker').textContent = `${detailOffset + detailPages.length} / 任课教师`;
  layoutTeacherProfilePages();
  const pages = Array.from(report.querySelectorAll(':scope > .report-page'))
    .filter(page => report.classList.contains('ap-report') || !page.classList.contains('ap-only'));
  for (const [index, page] of pages.entries()) {
    if (!page.matches('.summary-page,.reference-plan-page')) continue;
    let footer = page.querySelector('.report-page-number');
    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'report-page-number';
      page.append(footer);
    }
    const returnLink = page.classList.contains('report-detail-page') ? '<a href="#report-plan-overview">返回课程规划总览</a>'
      : page.classList.contains('report-overview-page') ? '<a href="#report-trial-summary">返回试听学情</a>' : '';
    footer.innerHTML = `${returnLink}<span>P${index + 1} / ${pages.length}</span>`;
  }
  return { oversizedLesson: null };
}

function deriveReport(notes, name, target) {
  const hasCalculus = /微积分|Algebra|代数/.test(notes);
  const hasForget = /不记得|遗忘|从头|基础差/.test(notes);
  const hasGeometry = /几何/.test(notes);
  const hasProbability = /概率|数据/.test(notes);
  const positive = /活泼|互动积极|爱互动/.test(notes) ? '课堂互动积极，愿意主动表达与思考' : '本节课以知识讲解与题型熟悉为主';
  const accuracy = /正确率|准确率|做对|中等难度/.test(notes) ? '中等难度题目完成情况较好，具备进一步提升的基础' : '具备继续诊断与专项训练的基础';
  const strength = hasCalculus ? '代数与函数基础相对扎实' : '理解与作答表现优于学生自我预期';
  const priorities = [hasForget ? '建立 SAT 数学知识图谱' : '建立 SAT 考点框架'];
  if (hasProbability) priorities.push('恢复概率与数据分析');
  if (hasGeometry) priorities.push('恢复几何与三角模块');
  const mainPriority = priorities.slice(1).join('、') || priorities[0];
  const overview = `从本次试听表现看，${name}的实际基础优于其课前预期。学生${positive}，且${accuracy}。当前更需要解决的不是重复学习已掌握内容，而是尽快建立完整的 SAT 数学考点框架，并针对未长期使用的知识点进行系统恢复。`;
  const lessonText = hasCalculus ? '本节课以 SAT 数学四大章节框架为切入点，结合课堂题目初步观察学生的知识结构与题型适应情况。' : '本节课以 SAT 数学知识框架和诊断题为切入点，初步定位学生的基础、遗忘点与后续学习重点。';
  const outcomes = [positive, accuracy, hasCalculus ? '确认 Algebra 模块可作为已有优势保持' : '确认学生具备通过系统梳理恢复知识的学习基础', `明确后续优先方向：${mainPriority}`];
  const needs = [priorities[0], ...(hasProbability ? ['概率与数据分析'] : []), ...(hasGeometry ? ['几何与三角'] : []), 'SAT 题型与考试节奏'];
  const urgent = `最需要优先解决的是${mainPriority}以及对 SAT 题型体系的熟悉度。如果缺少系统框架，学生即使有基础，也容易在陌生模块和限时作答中产生不必要失分。`;
  const script = `今天老师反馈，${name}课堂上的状态很好，互动和思考都比较主动，做题准确率也不错，说明学生本身具备较好的数学基础。\n\n当前最需要尽快解决的是${mainPriority}以及 SAT 考点体系的熟悉度。老师建议先完成整体知识框架梳理，再针对薄弱模块做专项恢复和题型训练，这样才能把已有基础更稳定地转化为 SAT 数学成绩。\n\n后续课程会结合每次套题的错题和用时动态调整，不会重复占用已经掌握模块的课时。`;
  const hasSpecificContent = /方程|不等式|函数|多项式|二次|指数|比率|百分比|概率|统计|数据表|几何|三角|圆|Desmos|Module|Bluebook/i.test(notes);
  const hasClassroomObservation = /互动|思考|正确率|准确率|做对|做错|理解|反应|速度|用时|卡住|薄弱|熟练|遗忘|积极|专注/i.test(notes);
  const missingDetails = [...(!hasSpecificContent ? ['具体考点或课堂练习'] : []), ...(!hasClassroomObservation ? ['学生课堂表现或作答情况'] : [])];
  return {
    overview,
    classroomStatus: positive,
    strength,
    currentFocus: priorities.join('、'),
    lessonTitle: /四章|4章/.test(notes) ? 'SAT 数学四大章节框架与诊断' : 'SAT 数学知识图谱与诊断',
    lessonSummary: lessonText,
    performance: `${positive}；${accuracy}。`,
    outcomes,
    priorityAreas: needs,
    coursePlan: defaultCoursePlan,
    salesFollowUp: {
      positive: `${positive}，${accuracy}。`,
      urgent,
      angle: '建议以“先建立完整框架，再针对真实薄弱点专项补强”为续课切入点，突出课程会依据套题错题与用时动态调整。',
      script
    },
    teacherNotice: missingDetails.length ? `当前课堂记录较为简略，家长版已采用保守表达。建议补充${missingDetails.join('、')}，以生成更有针对性的报告。` : '',
    target: target || (currentSubjectCode.startsWith('ap_') ? '5' : '待老师确认')
  };
}

function renderTeacherProfile() {
  const container = $('#teacher-profile-container');
  if (!container) return;
  const profile = getActiveTeacherProfile();

  if (profile) {
    const subjectName = createSubjectViewModel(currentSubjectCode).displayName;
    const photoHtml = profile.photoUrl
      ? `<div class="teacher-photo-wrap"><img src="${escapeHtml(profile.photoUrl)}" alt="${escapeHtml(profile.displayName)}" /><span class="teacher-photo-name">${escapeHtml(profile.displayName)}</span></div>`
      : `<div class="teacher-photo-wrap"><div class="avatar-placeholder">${escapeHtml(profile.displayPlaceholder)}</div><span class="teacher-photo-name">${escapeHtml(profile.displayName)}</span></div>`;
    const summaryHtml = profile.summary
      ? `<p class="teacher-summary">${escapeHtml(profile.summary)}</p>`
      : '';
    const sectionsHtml = profile.sections.length > 0
      ? `<div class="teacher-sections">${profile.sections.map((section) => `<section><h3>${escapeHtml(section.title)}</h3>${section.content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</section>`).join('')}</div>`
      : profile.bio.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
    const subjectsHtml = profile.subjects.length > 0
      ? `<div class="teacher-tags">${profile.subjects.map((subject) => `<span>${escapeHtml(subject)}</span>`).join('')}</div>`
      : '';
    const qrHtml = profile.qrUrl
      ? `<aside class="teacher-qr"><img src="${escapeHtml(profile.qrUrl)}" alt="${escapeHtml(profile.displayName)} 老师课程二维码" /><span>扫码查看<br />课程详情</span></aside>`
      : '';
    container.innerHTML = `<div class="teacher-profile">${photoHtml}<div class="teacher-intro"><span class="teacher-context">LUMIST · ${escapeHtml(subjectName)}</span><p class="teacher-label">${escapeHtml(profile.title || '')}</p><h2>${escapeHtml(profile.displayName)}</h2>${summaryHtml}${sectionsHtml}${subjectsHtml}</div>${qrHtml}</div>`;
    return;
  }

  container.innerHTML = '<div class="teacher-profile"><div class="teacher-intro"><p class="teacher-label">老师</p><h2>老师</h2><p>暂无教师简介。</p></div></div>';
}

function createTeacherProfileContinuation(pageNumber) {
  const page = document.createElement('article');
  page.className = 'report-page teacher-page teacher-profile-continuation-page delivery-only';
  page.innerHTML = `<img class="report-brand-header" src="assets/lumist-report-header-black.png" alt="路觅教育" /><div class="page-kicker">${String(pageNumber).padStart(2, '0')} / 任课教师 · 续</div><div class="teacher-profile teacher-profile-continuation"><div class="teacher-intro"><div class="teacher-sections"></div></div></div>`;
  return page;
}

function layoutTeacherProfilePages() {
  const teacherPage = document.querySelector('.teacher-page:not(.teacher-profile-continuation-page)');
  if (!teacherPage) return;

  document.querySelectorAll('.teacher-profile-continuation-page').forEach((page) => page.remove());
  teacherPage.classList.remove('teacher-page-compact', 'teacher-page-condensed');
  const pageNumber = Number(teacherPage.querySelector('.page-kicker')?.textContent.match(/\d+/)?.[0] || 0);
  const isOverflowing = (page) => page.scrollHeight > page.offsetHeight + 1;
  if (isOverflowing(teacherPage)) teacherPage.classList.add('teacher-page-compact');
  if (isOverflowing(teacherPage)) teacherPage.classList.add('teacher-page-condensed');
  const splitPage = (page, number) => {
    let continuation = null;
    while (isOverflowing(page)) {
      const sections = Array.from(page.querySelectorAll('.teacher-sections > section'));
      if (sections.length === 0) {
        page.classList.add('teacher-page-compact');
        return;
      }
      if (!continuation) {
        continuation = createTeacherProfileContinuation(number + 1);
        page.after(continuation);
      }
      continuation.querySelector('.teacher-sections').prepend(sections.at(-1));
    }
    if (continuation) splitPage(continuation, number + 1);
  };

  splitPage(teacherPage, pageNumber);
}

function renderReport(data) {
  try {
    renderReportContent(data);
  } catch (error) {
    error.generationStage = 'render';
    throw error;
  }
}

function renderReportContent(data) {
  const name = $('#student-name').value.trim() || '学生';
  const target = resolveTargetScore(currentSubjectCode, $('#target-score').value);
  const subjectName = createSubjectViewModel(currentSubjectCode).displayName;
  const activeTeacher = getActiveTeacherProfile();
  const teacherName = activeTeacher ? activeTeacher.displayName : '老师';

  setText('#report-title', `${name}个性化学习报告`);
  setText('#info-name', name);
  setText('#info-subject', `${subjectName}试听`);
  setText('#info-target', target || '待老师确认');
  setText('#info-teacher', teacherName);
  const snapshot = data.generationInput || {};
  const recentExam = schoolExamsFromNotes(snapshot.teacherNotes).find(exam => exam.name);
  const profileDetails = [
    ['#info-teacher-credentials', activeTeacher?.title],
    ['#info-progress', snapshot.schoolProgress || snapshot.teacherNotes?.match(/(?:^|\n)(?:校内进度|学校进度)[：:]\s*([^\n]+)/)?.[1]],
    ['#info-task', recentExam ? [recentExam.name, recentExam.date].filter(Boolean).join(' · ') : ''],
    ['#info-exam-date', snapshot.examDate],
  ];
  for (const [selector, value] of profileDetails) {
    const element = $(selector);
    element.textContent = value || '';
    const cell = element.parentElement;
    if (cell.id.endsWith('-cell') && selector !== '#info-exam-date') cell.hidden = !value;
    else element.hidden = !value;
  }
  setText('#overview-text', data.overview);
  setText('#classroom-text', data.classroomStatus);
  setText('#strength-text', data.strength);
  setText('#priority-text', data.currentFocus);
  setText('#lesson-title', data.lessonTitle);
  setText('#lesson-text', data.lessonSummary);
  setText('#performance-text', data.performance);
  $('#outcomes-list').innerHTML = data.outcomes.map((item, index) => `<li data-layout-path="summary.outcomes.${index}">${escapeHtml(item)}</li>`).join('');
  $('#needs-list').innerHTML = data.priorityAreas.map((item, index) => `<span data-layout-path="summary.priorityAreas.${index}">${escapeHtml(item)}</span>`).join('');
  setText('#sales-positive', data.salesFollowUp.positive);
  setText('#sales-urgent', data.salesFollowUp.urgent);
  setText('#sales-angle', data.salesFollowUp.angle);
  setText('#sales-script', data.salesFollowUp.script);
  renderTeacherProfile();
  renderCoursePlan(data.coursePlan);
  renderReportCriticalWarning(data);
  renderReportQualityNotice(data);
}

function renderReportCriticalWarning(data) {
  const warning = $('#report-critical-warning');
  const issues = Array.isArray(data.qualityReview?.criticalWarnings)
    ? data.qualityReview.criticalWarnings
      .filter((issue) => typeof issue === 'string' && issue.trim())
      .map(humanizeReportWarning)
    : [];
  warning.classList.toggle('hidden', issues.length === 0);
  warning.innerHTML = issues.length
    ? `<strong>报告存在需要老师重点核对的内容</strong><p>系统已保留并生成报告，请在交付家长前检查以下问题：</p><ul>${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul><p class="report-critical-warning-footer">可使用上方“编辑试听总结”或“编辑课程规划”完成修正。</p>`
    : '';
}

function renderReportQualityNotice(data) {
  const qualityNotice = $('#report-quality-notice');
  const layoutWarnings = validateCoursePlan(data.coursePlan).warnings;
  const checks = buildReportQualityChecks({
    subjectCode: currentSubjectCode,
    report: data,
    targetScore: resolveTargetScore(currentSubjectCode, $('#target-score').value),
    requestedTotalHours: $('#total-hours').value,
    layoutWarnings,
    qualityReview: data.qualityReview,
  });
  const warnings = checks.filter((check) => check.status === 'warning');
  qualityNotice.classList.remove('hidden');
  qualityNotice.classList.toggle('has-warnings', warnings.length > 0);
  qualityNotice.innerHTML = `<details ${warnings.length ? 'open' : ''}><summary class="quality-notice-header"><strong>报告质量检查</strong><span class="quality-notice-summary">${checks.length - warnings.length} 项通过${warnings.length ? ` · ${warnings.length} 项建议检查` : ''}</span></summary><ul class="quality-check-list">${checks.map((check) => `<li class="${check.status}"><span class="quality-check-icon">${check.status === 'passed' ? '✓' : '!'}</span><span class="quality-check-label">${escapeHtml(check.label)}</span><span class="quality-check-message">${escapeHtml(check.message)}</span></li>`).join('')}</ul></details>`;
}

function setQuickPreviewActions(enabled) {
  ['#save-report', '#edit-summary', '#edit-course-plan', '#regenerate-report', '#print-report'].forEach((selector) => $(selector).classList.toggle('hidden', enabled));
  $('#back-edit').textContent = enabled ? '返回继续填写' : '返回老师工作台';
}

function openQuickPreview() {
  const formData = collectFormData();
  currentReportData = buildFallbackReport(currentSubjectCode, formData);
  const parentConclusion = $('#parent-conclusion').value.trim();
  if (parentConclusion) currentReportData.overview = parentConclusion;
  currentReportData.generationInput = normalizeGenerationInput({...formData,subjectCode:currentSubjectCode,source:planningSource});
  currentReportId = null;
  historicalTeacherProfile = null;
  originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  isQuickPreview = true;
  renderReport(currentReportData);
  setQuickPreviewActions(true);
  setReportDisplayMode('reading');
  changeView('report');
  document.querySelector('#report-view .eyebrow').textContent = '快速预览 · 未生成、未保存';
  $('#report-mode-banner').innerHTML = '<div><strong>报告样式预览</strong><span>当前内容为即时示例，不会发送给 AI、不会保存，也不能导出。正式生成后可逐段编辑并导出 PDF。</span></div><button type="button" class="secondary-btn" data-preview-mode="preview">查看完整排版</button>';
}

function changeView(id) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${id}-view`));
  if (id !== 'report') {
    document.querySelectorAll('.nav-item').forEach((item) => {
      const current = item.dataset.view === id;
      item.classList.toggle('active', current);
      if (current) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let draftSummary = null;
let summaryEditorBaseline = '';

function isSummaryEditorDirty() {
  return draftSummary !== null && JSON.stringify(draftSummary) !== summaryEditorBaseline;
}

function setSummaryEditorMessage(message, type = '') {
  const element = $('#summary-editor-message');
  element.textContent = message;
  element.className = `plan-editor-message ${type}`.trim();
}

function createSummaryEditorField(field, rule) {
  const label = document.createElement('label');
  label.className = 'summary-editor-field';
  label.innerHTML = `<span>${escapeHtml(rule.label)}</span><small>${draftSummary[field].length} / ${rule.maximum}</small>`;
  const textarea = document.createElement('textarea');
  textarea.value = draftSummary[field];
  textarea.rows = field === 'lessonTitle' ? 1 : 4;
  if (field === 'lessonTitle') label.classList.add('summary-title-field');
  textarea.dataset.summaryPath = field;
  label.appendChild(textarea);
  return label;
}

function createSummaryListEditor(field, title, maximum) {
  const section = document.createElement('section');
  section.className = 'summary-list-editor';
  section.innerHTML = `<header><div><b>${escapeHtml(title)}</b><span>${draftSummary[field].length} / ${maximum} 项</span></div><button type="button" class="secondary-btn" data-summary-action="add" data-summary-field="${field}" ${draftSummary[field].length >= maximum ? 'disabled' : ''}>新增一项</button></header>`;
  const list = document.createElement('div');
  draftSummary[field].forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'summary-list-row';
    row.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><textarea rows="2" data-summary-path="${field}.${index}">${escapeHtml(item)}</textarea><button type="button" data-summary-action="delete" data-summary-field="${field}" data-summary-index="${index}" ${draftSummary[field].length === 1 ? 'disabled' : ''}>删除</button>`;
    list.appendChild(row);
  });
  section.appendChild(list);
  return section;
}

function renderSummaryEditor() {
  const content = $('#summary-editor-content');
  const previous = new Map([...content.querySelectorAll('details[data-summary-section]')].map((section) => [section.dataset.summarySection, section.open]));
  const sections = [
    ['conclusion', '课堂结论', ['lessonTitle', 'overview', 'classroomStatus', 'strength', 'currentFocus']],
    ['observation', '课堂内容与学生表现', ['lessonSummary', 'performance']],
    ['outcomes', '学习收获与提升项', []],
  ];
  content.replaceChildren(...sections.map(([key, title, fields], index) => {
    const section = document.createElement('details');
    section.className = 'summary-editor-section';
    section.dataset.summarySection = key;
    section.open = previous.get(key) ?? index === 0;
    section.innerHTML = `<summary class="editor-disclosure">${title}</summary>`;
    if (fields.length) {
      const group = document.createElement('div');
      group.className = 'summary-editor-fields';
      group.append(...fields.map((field) => createSummaryEditorField(field, SUMMARY_FIELD_RULES[field])));
      section.append(group);
    } else {
      section.append(createSummaryListEditor('outcomes', '本节课收获', 5), createSummaryListEditor('priorityAreas', '后续需要优先提升的内容', 6));
    }
    return section;
  }));
  $('#summary-editor-student-name').textContent = $('#student-name').value.trim() || '学生';
}

function setSummaryDraftValue(path, value) {
  const [field, index] = path.split('.');
  if (index === undefined) draftSummary[field] = value;
  else draftSummary[field][Number(index)] = value;
  const input = $(`[data-summary-path="${path}"]`);
  const counter = input?.closest('.summary-editor-field')?.querySelector('small');
  if (counter) counter.textContent = `${value.length} / ${SUMMARY_FIELD_RULES[field].maximum}`;
  setSummaryEditorMessage('');
  syncWorkspaceSummary();
}

function syncWorkspaceSummary() {
  if (!$('#summary-editor-modal').classList.contains('workspace-inline-editor')) return;
  currentReportData = { ...currentReportData, ...cloneReportSummary(draftSummary) };
  document.querySelector('#report-view .eyebrow').textContent = '试听反馈已编辑 · 未云端保存';
  scheduleReportAutoSave();
}

function openSummaryEditor() {
  draftSummary = cloneReportSummary(currentReportData);
  summaryEditorBaseline = JSON.stringify(draftSummary);
  renderSummaryEditor();
  $('#summary-editor-modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeSummaryEditor() {
  draftSummary = null;
  $('#summary-editor-modal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function cancelSummaryEditor() {
  if (isSummaryEditorDirty() && !window.confirm('当前修改尚未应用，确定取消吗？')) return;
  closeSummaryEditor();
}

function clearSummaryValidationErrors() {
  $('#summary-editor-content').querySelectorAll('.editor-field-error').forEach((element) => element.remove());
  $('#summary-editor-content').querySelectorAll('.is-invalid').forEach((element) => element.classList.remove('is-invalid'));
}

function showSummaryValidationErrors(errors) {
  clearSummaryValidationErrors();
  errors.forEach((error) => {
    const field = $(`[data-summary-path="${error.path}"]`);
    const target = field || $(`[data-summary-field="${error.path}"]`)?.closest('.summary-list-editor');
    const group = target?.closest('details');
    if (group) group.open = true;
    target?.classList.add('is-invalid');
    const reason = document.createElement('span');
    reason.className = 'editor-field-error';
    reason.textContent = error.message;
    target?.insertAdjacentElement('afterend', reason);
  });
}

function applySummaryEdits() {
  const validation = validateReportSummary(draftSummary);
  if (!validation.valid) {
    showSummaryValidationErrors(validation.errors);
    setSummaryEditorMessage(`共有 ${validation.errors.length} 项需要修改：${validation.errors[0].message}`, 'error');
    $(`[data-summary-path="${validation.errors[0].path}"]`)?.focus();
    return;
  }
  clearSummaryValidationErrors();
  Object.assign(currentReportData, cloneReportSummary(draftSummary));
  renderReport(currentReportData);
  document.querySelector('#report-view .eyebrow').textContent = '试听总结已编辑 · 未云端保存';
  closeSummaryEditor();
  document.querySelector('.summary-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function collectCoursePlan() {
  return currentReportData.coursePlan.stages;
}

let draftCoursePlan = null;
let originalAiCoursePlan = null;
let editorBaseline = '';
let collapsedStages = new WeakSet();
let expandedLessons = new WeakSet();

function isCoursePlanDirty() {
  return draftCoursePlan !== null && JSON.stringify(draftCoursePlan) !== editorBaseline;
}

function setPlanEditorMessage(message, type = '') {
  const element = $('#plan-editor-message');
  element.textContent = message;
  element.className = `plan-editor-message ${type}`.trim();
}

function updateEditorSummary() {
  draftCoursePlan.totalHours = calculateTotalHours(draftCoursePlan);
  $('#editor-student-name').textContent = $('#student-name').value.trim() || '学生';
  $('#editor-total-hours').textContent = `${draftCoursePlan.totalHours}h`;
  $('#editor-stage-count').textContent = String(draftCoursePlan.stages.length);
  $('#editor-lesson-count').textContent = String(draftCoursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0));
}

function markEditorDirty() {
  updateEditorSummary();
  setPlanEditorMessage('');
  if ($('#course-plan-modal').classList.contains('workspace-inline-editor')) syncWorkspaceCoursePlan();
}

function syncWorkspaceCoursePlan() {
  draftCoursePlan.totalHours = calculateTotalHours(draftCoursePlan);
  currentReportData.coursePlan = cloneCoursePlan(draftCoursePlan);
  $('#total-hours').value = String(draftCoursePlan.totalHours);
  const lessonCount = draftCoursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
  $('#lesson-count').value = String(lessonCount);
  currentReportData.planningContext = buildCurrentPlanningContext(lessonCount);
  updateLessonCountHint();
  renderReportQualityNotice(currentReportData);
  document.querySelector('#report-view .eyebrow').textContent = '课程规划已编辑 · 未云端保存';
  scheduleReportAutoSave();
}

function clearValidationErrors() {
  document.querySelectorAll('.editor-field-error').forEach((element) => element.remove());
  document.querySelectorAll('.is-invalid').forEach((element) => element.classList.remove('is-invalid'));
}

function createEditorField(labelText, value, path, multiline = false) {
  const label = document.createElement('label');
  label.textContent = labelText;
  const input = multiline ? document.createElement('textarea') : document.createElement('input');
  input.value = value || '';
  input.dataset.path = path;
  if (multiline) input.rows = Math.min(8, Math.max(4, Math.ceil(input.value.length / 55)));
  label.appendChild(input);
  return label;
}

function renderPlanEditor() {
  const content = $('#plan-editor-content');
  const openSettings = new Set([...content.querySelectorAll('.stage-settings[open]')].map((element) => Number(element.closest('[data-stage-editor]').dataset.stageEditor)));
  content.innerHTML = '';
  draftCoursePlan.stages.forEach((stage, stageIndex) => {
    const section = document.createElement('section');
    section.className = collapsedStages.has(stage) ? 'plan-stage-editor is-collapsed' : 'plan-stage-editor';
    section.tabIndex = -1;
    section.dataset.stageEditor = String(stageIndex);
    const header = document.createElement('div');
    header.className = 'plan-stage-editor-header';
    header.innerHTML = `<div><span>阶段 ${String(stageIndex + 1).padStart(2, '0')}</span><b>${escapeHtml(stage.title || '未命名阶段')}</b></div><div class="editor-icon-actions"><button type="button" data-stage-action="up" data-stage-index="${stageIndex}" ${stageIndex === 0 ? 'disabled' : ''}>上移</button><button type="button" data-stage-action="down" data-stage-index="${stageIndex}" ${stageIndex === draftCoursePlan.stages.length - 1 ? 'disabled' : ''}>下移</button><button type="button" data-stage-action="collapse" data-stage-index="${stageIndex}" aria-expanded="${!collapsedStages.has(stage)}">${collapsedStages.has(stage) ? '展开' : '折叠'}</button><button type="button" data-stage-action="delete" data-stage-index="${stageIndex}" ${draftCoursePlan.stages.length === 1 ? 'disabled' : ''}>删除</button></div>`;
    section.appendChild(header);
    if (!collapsedStages.has(stage)) {
      const fields = document.createElement('div');
      fields.className = 'plan-stage-fields';
      const description = createEditorField('阶段说明', stage.description, `stages.${stageIndex}.description`, true);
      description.querySelector('textarea').rows = 3;
      fields.append(createEditorField('阶段名称', stage.title, `stages.${stageIndex}.title`), description);
      if (stage.assessment) {
        const assessment = document.createElement('div');
        assessment.className = 'stage-assessment-fields';
        for (const [field, label, limit] of [['objective', '阶段目标（学生能独立做到什么）', 100], ['examValue', '对考试有什么用', 100], ['task', '阶段测任务与评分依据', 120], ['target', '计划达标线', 100], ['adjustment', '未达标时怎么调整', 120]]) {
          const path = `stages.${stageIndex}.assessment.${field}`;
          const control = createEditorField(label, stage.assessment[field] || '', path, true);
          const textarea = control.querySelector('textarea');
          textarea.maxLength = limit;
          textarea.rows = 3;
          assessment.append(control);
        }
        fields.append(assessment);
      }
      const settings = document.createElement('details');
      settings.className = 'stage-settings';
      settings.open = openSettings.has(stageIndex);
      settings.innerHTML = `<summary class="editor-disclosure">${stage.assessment ? '阶段名称、说明与测评' : '阶段名称与说明'}</summary>`;
      settings.append(fields);
      section.append(settings);
      const lessonList = document.createElement('div');
      lessonList.className = 'plan-lesson-list';
      stage.lessons.forEach((lesson, lessonIndex) => lessonList.appendChild(createLessonEditor(lesson, stageIndex, lessonIndex)));
      section.appendChild(lessonList);
      const addLesson = document.createElement('button');
      addLesson.type = 'button';
      addLesson.className = 'secondary-btn add-lesson-btn';
      addLesson.dataset.addLesson = String(stageIndex);
      addLesson.textContent = '新增课次';
      section.appendChild(addLesson);
    }
    content.appendChild(section);
  });
  updateEditorSummary();
  renderWorkspaceStageShortcuts();
}

function renderWorkspaceStageShortcuts() {
  const shortcuts = $('#workspace-stage-shortcuts');
  if (!shortcuts || !draftCoursePlan?.stages?.length) return;
  shortcuts.innerHTML = `<span>课程阶段</span>${draftCoursePlan.stages.map((stage, index) => `<button type="button" data-workspace-stage="${index}" aria-pressed="${!collapsedStages.has(stage)}">阶段 ${index + 1} · ${escapeHtml(stage.title || '未命名阶段')}</button>`).join('')}`;
}

function createLessonEditor(lesson, stageIndex, lessonIndex) {
  const card = document.createElement('article');
  card.className = expandedLessons.has(lesson) ? 'plan-lesson-editor is-expanded' : 'plan-lesson-editor';
  const globalIndex = draftCoursePlan.stages.slice(0, stageIndex).reduce((total, stage) => total + stage.lessons.length, 0) + lessonIndex + 1;
  card.innerHTML = `<header><button class="lesson-editor-toggle" type="button" data-lesson-action="toggle" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}" aria-expanded="${expandedLessons.has(lesson)}">第 ${globalIndex} 课 · ${escapeHtml(lesson.theme || '未填写主题')} · ${escapeHtml(lesson.duration)}h</button><div class="editor-icon-actions"><button type="button" data-lesson-action="up" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}" ${lessonIndex === 0 ? 'disabled' : ''}>上移</button><button type="button" data-lesson-action="down" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}" ${lessonIndex === draftCoursePlan.stages[stageIndex].lessons.length - 1 ? 'disabled' : ''}>下移</button><button type="button" data-lesson-action="copy" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}">复制</button><button type="button" data-lesson-action="delete" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}">删除</button></div></header>`;
  const grid = document.createElement('div');
  grid.className = 'plan-lesson-fields';
  grid.hidden = !expandedLessons.has(lesson);
  const durationLabel = document.createElement('label');
  durationLabel.textContent = '时长';
  const duration = document.createElement('select');
  duration.dataset.path = `stages.${stageIndex}.lessons.${lessonIndex}.duration`;
  ALLOWED_DURATIONS.forEach((value) => duration.add(new Option(`${value}h`, String(value), false, Number(lesson.duration) === value)));
  durationLabel.appendChild(duration);
  const targetLabel = document.createElement('label');
  targetLabel.textContent = '目标阶段';
  const target = document.createElement('select');
  target.dataset.moveLesson = `${stageIndex}.${lessonIndex}`;
  draftCoursePlan.stages.forEach((stage, index) => target.add(new Option(stage.title || `阶段 ${index + 1}`, String(index), false, index === stageIndex)));
  targetLabel.appendChild(target);
  grid.append(durationLabel, targetLabel, createEditorField('主题', lesson.theme, `stages.${stageIndex}.lessons.${lessonIndex}.theme`), createEditorField('课堂内容', lesson.content, `stages.${stageIndex}.lessons.${lessonIndex}.content`, true), createEditorField('当课目标', lesson.goal, `stages.${stageIndex}.lessons.${lessonIndex}.goal`, true), createEditorField('重难点', lesson.difficulty, `stages.${stageIndex}.lessons.${lessonIndex}.difficulty`, true));
  card.appendChild(grid);
  return card;
}

function setDraftValue(path, value) {
  const parts = path.split('.');
  let target = draftCoursePlan;
  parts.slice(0, -1).forEach((part) => { target = target[Number.isNaN(Number(part)) ? part : Number(part)]; });
  target[parts.at(-1)] = parts.at(-1) === 'duration' ? Number(value) : value;
  markEditorDirty();
  if (parts.at(-1) === 'theme' || parts.at(-1) === 'duration') {
    const stageIndex = Number(parts[1]);
    const lessonIndex = Number(parts[3]);
    const toggle = $(`[data-lesson-action="toggle"][data-stage-index="${stageIndex}"][data-lesson-index="${lessonIndex}"]`);
    if (toggle) {
      const number = draftCoursePlan.stages.slice(0, stageIndex).reduce((total, stage) => total + stage.lessons.length, 0) + lessonIndex + 1;
      toggle.textContent = `第 ${number} 课 · ${target.theme || '未填写主题'} · ${target.duration}h`;
    }
  }
  if (parts.at(-1) === 'title') {
    const stageIndex = Number(parts[1]);
    const title = value.trim() || '未命名阶段';
    const legacyShortcut = $(`[data-scroll-stage="${stageIndex}"]`);
    if (legacyShortcut) legacyShortcut.textContent = `${stageIndex + 1}. ${title}`;
    renderWorkspaceStageShortcuts();
    $(`[data-stage-editor="${stageIndex}"] .plan-stage-editor-header b`).textContent = title;
    document.querySelectorAll('[data-move-lesson]').forEach((select) => { select.options[stageIndex].textContent = title; });
  }
}

function mountTeacherWorkspaceEditors() {
  const workspace = $('#teacher-workspace-editor');
  const summaryModal = $('#summary-editor-modal');
  const courseModal = $('#course-plan-modal');
  workspace.append(summaryModal, courseModal);
  summaryModal.classList.remove('plan-editor-modal', 'hidden');
  summaryModal.classList.add('workspace-inline-editor');
  courseModal.classList.remove('plan-editor-modal', 'hidden');
  courseModal.classList.add('workspace-inline-editor');
}

function initializeWorkspaceEditors() {
  draftSummary = cloneReportSummary(currentReportData);
  summaryEditorBaseline = JSON.stringify(draftSummary);
  draftCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  editorBaseline = JSON.stringify(draftCoursePlan);
  collapsedStages = new WeakSet(draftCoursePlan.stages.slice(1));
  expandedLessons = new WeakSet();
  renderSummaryEditor();
  renderPlanEditor();
}

function openPlanEditor() {
  draftCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  editorBaseline = JSON.stringify(draftCoursePlan);
  collapsedStages = new WeakSet(draftCoursePlan.stages.slice(1));
  expandedLessons = new WeakSet();
  $('[data-editor-action="restore"]').textContent = currentReportData?.planningContext?.source === 'upload' ? '恢复上传原始规划' : '恢复 AI 原始规划';
  renderPlanEditor();
  $('#course-plan-modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closePlanEditor() {
  draftCoursePlan = null;
  $('#course-plan-modal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function cancelPlanEditor() {
  if (isCoursePlanDirty() && !window.confirm('当前修改尚未应用，确定取消吗？')) return;
  closePlanEditor();
}

function showValidationErrors(errors) {
  clearValidationErrors();
  errors.forEach((error) => {
    const [, stageIndex, , lessonIndex] = error.path.split('.');
    const stage = draftCoursePlan.stages[Number(stageIndex)];
    const lesson = stage?.lessons[Number(lessonIndex)];
    if (lesson) expandedLessons.add(lesson);
    if (collapsedStages.has(stage)) collapsedStages.delete(stage);
  });
  renderPlanEditor();
  errors.forEach((error) => {
    const stageIndex = Number(error.path.split('.')[1]);
    const field = $(`[data-path="${error.path}"]`);
    const target = field || $(`[data-stage-editor="${stageIndex}"]`);
    target?.classList.add('is-invalid');
    const reason = document.createElement('span');
    reason.className = 'editor-field-error';
    reason.textContent = error.message;
    if (field) {
      const group = field.closest('details');
      if (group) group.open = true;
      field.insertAdjacentElement('afterend', reason);
    }
    else target?.querySelector('.plan-stage-editor-header')?.insertAdjacentElement('afterend', reason);
  });
}

function focusValidationError(error) {
  const stageIndex = Number(error.path.split('.')[1]);
  const target = $(`[data-path="${error.path}"]`) || $(`[data-stage-editor="${stageIndex}"]`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target?.focus();
}

function applyCoursePlan() {
  draftCoursePlan.totalHours = calculateTotalHours(draftCoursePlan);
  const validation = validateCoursePlan(draftCoursePlan, { allowSparseLessons: currentReportData?.planningContext?.source === 'upload' });
  if (!validation.valid) {
    showValidationErrors(validation.errors);
    setPlanEditorMessage(`共有 ${validation.errors.length} 项需要修改：${validation.errors[0].message}`, 'error');
    focusValidationError(validation.errors[0]);
    return;
  }
  clearValidationErrors();
  if (validation.warnings.length && !window.confirm(`有 ${validation.warnings.length} 项内容较长，可能影响排版。仍要应用吗？`)) return;
  const previousTotalHours = Number(currentReportData.coursePlan.totalHours);
  if (Math.abs(previousTotalHours - draftCoursePlan.totalHours) > 0.001
    && !window.confirm(`总课时将从 ${previousTotalHours}h 调整为 ${draftCoursePlan.totalHours}h，是否确认？`)) return;
  renderCoursePlan(draftCoursePlan);
  currentReportData.coursePlan = cloneCoursePlan(draftCoursePlan);
  $('#total-hours').value = String(draftCoursePlan.totalHours);
  const lessonCount = draftCoursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
  $('#lesson-count').value = String(lessonCount);
  currentReportData.planningContext = buildCurrentPlanningContext(lessonCount);
  updateLessonCountHint();
  renderReportQualityNotice(currentReportData);
  document.querySelector('#report-view .eyebrow').textContent = '课程规划已编辑 · 未云端保存';
  closePlanEditor();
  document.querySelector('.reference-plan-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function restoreOriginalCoursePlan() {
  if (!originalAiCoursePlan) return;
  const uploaded = currentReportData?.planningContext?.source === 'upload';
  if (!window.confirm(`确定恢复为本次${uploaded ? '上传并确认' : ' AI 生成'}的原始课程规划吗？当前课程规划修改将被覆盖。`)) return;
  currentReportData.coursePlan = cloneCoursePlan(originalAiCoursePlan);
  $('#total-hours').value = String(currentReportData.coursePlan.totalHours);
  const lessonCount = currentReportData.coursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
  $('#lesson-count').value = String(lessonCount);
  currentReportData.planningContext = buildCurrentPlanningContext(lessonCount);
  updateLessonCountHint();
  renderCoursePlan(currentReportData.coursePlan);
  renderReportQualityNotice(currentReportData);
  document.querySelector('#report-view .eyebrow').textContent = `已恢复${uploaded ? '上传' : ' AI'}原始课程规划 · 未云端保存`;
  closePlanEditor();
  document.querySelector('.reference-plan-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scheduleReportAutoSave() {
  if (!currentReportId) return;
  clearTimeout(reportAutoSaveTimer);
  reportAutoSaveTimer = setTimeout(() => {
    reportAutoSaveTimer = null;
    saveReport({ automatic: true });
  }, 900);
}

async function saveReport({ automatic = false } = {}) {
  if (!currentReportData) return false;
  const reportStatus = document.querySelector('#report-view .eyebrow');
  const saveButton = $('#save-report');
  const lessonCount = currentReportData.coursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
  const reportSource = currentReportData.planningContext?.source === 'upload' ? 'upload' : 'ai';
  currentReportData.planningContext = buildCurrentPlanningContext(lessonCount, reportSource);
  const { coursePlan, salesFollowUp, ...reportData } = currentReportData;
  const payload = {
    id: currentReportId,
    ...(!currentReportId ? { saveToken: pendingReportSaveToken ||= crypto.randomUUID() } : {}),
    studentName: $('#student-name').value.trim(),
    currentScore: $('#current-score').value.trim(),
    targetScore: resolveTargetScore(currentSubjectCode, $('#target-score').value),
    examDate: getSelectedExamDate(),
    teacherNotes: currentReportData.generationInput?.teacherNotes || collectFormData(reportSource).teacherNotes,
    subject: createSubjectViewModel(currentSubjectCode).displayName,
    reportData,
    coursePlan,
    salesFollowUp,
  };
  reportStatus.textContent = automatic ? '正在自动保存报告' : '正在保存报告';
  saveButton.disabled = true;
  saveButton.textContent = '保存中…';
  try {
    const result = await requestReportJson('/api/reports', payload, { method: currentReportId ? 'PATCH' : 'POST', attempts: 1, timeoutMs: 30000 });
    if (!result.saved) throw new Error('SYSTEM_NOT_CONFIGURED');
    if (result.id) currentReportId = result.id;
    reportStatus.textContent = '报告已保存';
    saveButton.textContent = '保存报告';
    $('#report-operation-notice').classList.add('hidden');
    return Boolean(result.saved);
  } catch (error) {
    reportStatus.textContent = automatic ? '自动保存失败 · 请手动保存' : '报告保存失败 · 请稍后重试';
    saveButton.textContent = '重新保存';
    showWorkflowError($('#report-view').classList.contains('active') ? $('#report-operation-notice') : $('#generation-notice'), error, 'save');
    return false;
  } finally {
    saveButton.disabled = false;
  }
}

function collectFormData(source = planningSource) {
  const languageAssessment = validateSatEnglishAssessment(collectSatEnglishAssessment());
  const mathHours = validateSatMathHours(collectSatMathHours(), $('#total-hours').value);
  return {
    studentName: $('#student-name').value.trim(),
    currentScore: $('#current-score').value.trim(),
    targetScore: resolveTargetScore(currentSubjectCode, $('#target-score').value),
    examDate: getSelectedExamDate(),
    totalHours: $('#total-hours').value,
    lessonCount: $('#lesson-count').value,
    planningScenario: resolvePlanningScenario($('#planning-scenario').value),
    planningFocusAreas: getSelectedPlanningFocusAreas(),
    includeExamTraining: source === 'ai' && currentSubjectCode !== 'sat_math' && $('#include-exam-training').checked,
    teacherNotes: [$('#teacher-notes').value.trim(), ...schoolExams().map(exam => '【校内考试】'+JSON.stringify(exam))].filter(Boolean).join('\n'),
    ...(source === 'ai' && currentSubjectCode === 'sat_english' && languageAssessment.valid && languageAssessment.assessment ? { satEnglishAssessment: languageAssessment.assessment } : {}),
    ...(source === 'ai' && currentSubjectCode === 'sat_math' && mathHours.valid ? { satMathHours: mathHours.hours } : {}),
    ...(source === 'upload' && uploadedCoursePlanConfirmed ? { lockedCoursePlan: cloneCoursePlan(uploadedCoursePlan) } : {}),
  };
}

function getRecoveryStorageKey(baseKey) {
  return recoveryStorageScope ? `${baseKey}:${recoveryStorageScope}` : '';
}

function readRecoveryRecord(baseKey) {
  const storageKey = getRecoveryStorageKey(baseKey);
  if (!storageKey) return null;
  try {
    const serialized = window.localStorage.getItem(storageKey);
    const record = readFreshRecord(serialized, Date.now());
    if (!record && serialized) window.localStorage.removeItem(storageKey);
    return record;
  } catch {
    return null;
  }
}

function writeRecoveryRecord(baseKey, payload, ttl) {
  const storageKey = getRecoveryStorageKey(baseKey);
  if (!storageKey) return false;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(createExpiringRecord(payload, Date.now(), ttl)));
    return true;
  } catch {
    return false;
  }
}

function clearRecoveryRecord(baseKey) {
  const storageKey = getRecoveryStorageKey(baseKey);
  if (!storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    return;
  }
}

function collectFormDraft() {
  return {
    planningSource,
    subjectCode: currentSubjectCode,
    studentName: $('#student-name').value,
    currentScore: $('#current-score').value,
    targetScore: $('#target-score').value,
    examDate: getSelectedExamDate(),
    totalHours: $('#total-hours').value,
    lessonCount: $('#lesson-count').value,
    planningScenario: $('#planning-scenario').value,
    planningFocusAreas: getSelectedPlanningFocusAreas(),
    includeExamTraining: $('#include-exam-training').checked,
    satEnglishAssessment: collectSatEnglishAssessment(),
    satMathHours: collectSatMathHours(),
    teacherNotes: $('#teacher-notes').value,
    parentConclusion: $('#parent-conclusion')?.value || '',
    schoolExams: schoolExams(),
    feedback: feedbackInputs(),
    feedbackReviewed: reviewedFeedbackKey === JSON.stringify(feedbackInputs()),
  };
}

function saveFormDraft() {
  if (planningSource !== 'ai') return;
  if (writeRecoveryRecord(FORM_DRAFT_STORAGE_KEY, collectFormDraft(), FORM_DRAFT_TTL_MS)) {
    setDraftStatus('草稿已保存', 'saved');
  } else {
    setDraftStatus('草稿保存失败，请复制课堂记录备份', 'warning');
  }
}

function scheduleFormDraftSave() {
  if (editingReportSource) return;
  formHasUserInput = true;
  window.clearTimeout(formDraftSaveTimer);
  formDraftSaveTimer = window.setTimeout(saveFormDraft, 400);
}

function applySavedFormData(data) {
  if (!data || typeof data !== 'object') return false;
  const subjectCode = SUBJECT_CODES.includes(data.subjectCode) ? data.subjectCode : currentSubjectCode;
  applySubjectSelection(subjectCode, { clearRecovery: false });
  setPlanningSource('ai');
  $('#student-name').value = String(data.studentName || '');
  $('#current-score').value = String(data.currentScore || '');
  $('#target-score').value = String(data.targetScore || '');
  $('#total-hours').value = String(data.totalHours || '');
  $('#lesson-count').value = String(data.lessonCount || '');
  $('#planning-scenario').value = resolvePlanningScenario(data.planningScenario);
  $('#include-exam-training').checked = data.includeExamTraining === true;
  const languageAssessment = data.satEnglishAssessment && typeof data.satEnglishAssessment === 'object' ? data.satEnglishAssessment : {};
  $('#language-test-type').value = languageAssessment.testType || '';
  $('#language-score-scale').value = languageAssessment.scoreScale === 'legacy_0_120' ? 'legacy_0_120' : 'new_1_6';
  $('#language-overall-score').value = languageAssessment.overallScore ?? '';
  $('#language-reading-score').value = languageAssessment.readingScore ?? '';
  $('#language-test-date').value = languageAssessment.testDate || '';
  renderSatMathHoursInputs(data.satMathHours && typeof data.satMathHours === 'object' ? data.satMathHours : createEmptySatMathHours());
  configureSatSubjectContext();
  restoreSchoolExams(data);
  if ($('#parent-conclusion')) $('#parent-conclusion').value = String(data.parentConclusion || '');
  $('#feedback-internal').value = data.feedback?.internal || '';
  $('#feedback-family').value = data.feedback?.family || '';
  reviewedFeedbackKey = data.feedbackReviewed ? JSON.stringify(feedbackInputs()) : '';
  renderPlanningFocusOptions(Array.isArray(data.planningFocusAreas) ? data.planningFocusAreas : []);
  if (subjectCode.startsWith('ap_')) {
    const examDate = String(data.examDate || '');
    if (examDate && !Array.from($('#ap-exam-date').options).some((option) => option.value === examDate)) {
      $('#ap-exam-date').add(new Option(`${examDate} AP 考试`, examDate));
    }
    $('#ap-exam-date').value = examDate;
  } else {
    $('#exam-date').value = String(data.examDate || '');
  }
  updateLessonCountHint();
  return true;
}

function loadGenerationCheckpoint(commonPayload) {
  const record = readRecoveryRecord(GENERATION_CHECKPOINT_STORAGE_KEY);
  const checkpoint = record?.payload;
  if (!checkpoint || checkpoint.fingerprint !== createGenerationFingerprint(commonPayload)) return null;
  const stages = checkpoint.outlineResult?.outline?.stages;
  if (!Array.isArray(stages) || stages.length < 1) return null;
  return {
    ...checkpoint,
    generatedStages: normalizeGeneratedStages(checkpoint.generatedStages, stages.length),
  };
}

function saveGenerationCheckpoint(commonPayload, outlineResult, generatedStages) {
  writeRecoveryRecord(GENERATION_CHECKPOINT_STORAGE_KEY, {
    fingerprint: createGenerationFingerprint(commonPayload),
    commonPayload,
    outlineResult,
    generatedStages,
  }, GENERATION_CHECKPOINT_TTL_MS);
}

function clearGenerationRecovery() {
  clearRecoveryRecord(GENERATION_CHECKPOINT_STORAGE_KEY);
  clearRecoveryRecord(FORM_DRAFT_STORAGE_KEY);
  window.clearTimeout(formDraftSaveTimer);
  setDraftStatus('草稿自动保存');
}

function restoreGenerationRecovery() {
  const formRecord = readRecoveryRecord(FORM_DRAFT_STORAGE_KEY);
  const checkpointRecord = readRecoveryRecord(GENERATION_CHECKPOINT_STORAGE_KEY);
  let restored = false;
  if (!restored && formRecord?.payload?.planningSource === 'ai') restored = applySavedFormData(formRecord.payload);
  if (!restored && checkpointRecord?.payload?.commonPayload) restored = applySavedFormData(checkpointRecord.payload.commonPayload);
  if (!restored) return;
  setDraftStatus('已恢复上次草稿', 'saved');
  const commonPayload = { ...collectFormData(), subjectCode: currentSubjectCode };
  const checkpoint = loadGenerationCheckpoint(commonPayload);
  if (checkpoint) {
    const completed = countCompletedStages(checkpoint.generatedStages);
    const total = checkpoint.outlineResult.outline.stages.length;
    $('#generation-notice').innerHTML = `<strong>已恢复生成记录：</strong>此前完成 ${completed}/${total} 个阶段。确认信息后再次生成，系统会继续缺失阶段。`;
  } else {
    $('#generation-notice').innerHTML = '<strong>已恢复草稿：</strong>请确认信息后继续生成。草稿会在成功生成后自动清除。';
  }
}

function setPlanningSource(value, { preserveNotice = false } = {}) {
  planningSource = value === 'upload' ? 'upload' : 'ai';
  document.querySelectorAll('[name="planning-source"]').forEach((input) => { input.checked = input.value === planningSource; });
  $('#course-plan-upload-panel').classList.toggle('hidden', planningSource !== 'upload');
  $('#ai-generation-fields').classList.remove('hidden');
  document.querySelectorAll('.ai-planning-only').forEach((element) => element.classList.toggle('hidden', planningSource === 'upload'));
  document.querySelectorAll('.ai-workflow-only').forEach((element) => element.classList.toggle('hidden', planningSource === 'upload'));
  $('#teacher-notes').required = true;
  $('#planning-scenario').required = planningSource === 'ai';
  $('#total-hours').required = planningSource === 'ai';
  $('#lesson-count').required = planningSource === 'ai';
  $('#total-hours').readOnly = planningSource === 'upload' && uploadedCoursePlanConfirmed;
  $('#lesson-count').readOnly = planningSource === 'upload' && uploadedCoursePlanConfirmed;
  $('#include-exam-training').disabled = planningSource === 'upload';
  configureSatSubjectContext();
  const generationNotice = $('#generation-notice');
  if (!preserveNotice) {
    generationNotice.classList.remove('error');
    generationNotice.innerHTML = planningSource === 'upload'
      ? uploadedCoursePlanConfirmed
        ? '<strong>课程规划已锁定：</strong>请填写本次试听课反馈，再统一生成完整报告。AI 不会修改上传规划。'
        : '<strong>上传模式：</strong>请先上传并确认课程规划，再填写本次试听课反馈。'
      : '<strong>生成原则：</strong>总课时由老师决定，AI 仅负责规划内容与课时分配。';
  }
  $('#generate-report').textContent = editingReportSource ? '更新报告' : '生成报告';
  $('#generate-report').classList.toggle('hidden', planningSource === 'upload' && !uploadedCoursePlanConfirmed);
  $('#quick-preview-report').classList.toggle('hidden', planningSource === 'upload');
  $('#regeneration-options').classList.toggle('hidden', planningSource === 'upload' || !reportGenerationBaseline);
  generationNotice.classList.remove('hidden');
  $('#feedback-section-title').textContent = planningSource === 'upload' ? '填写试听课反馈' : '学生背景与试听课反馈';
  $('#feedback-section-description').textContent = planningSource === 'upload'
    ? '课程规划来自上传文件；请单独记录本次课堂观察，系统会将两部分合并成完整报告。'
    : '像写微信反馈一样描述即可。系统会整理成报告与销售跟进话术。';
  $('#teacher-notes-label').textContent = '核对后的课堂记录（也可直接填写）';
  $('#student-info-hint').textContent = planningSource === 'upload'
    ? '填写报告封面信息，课时和课次将从上传文件中自动读取。'
    : '只填写 AI 无法从课堂描述中可靠获取的信息。';
  if (!$('#form-review').hidden) renderFormReview();
}

function clearCoursePlanUploadState() {
  coursePlanParseVersion += 1;
  selectedCoursePlanFile = null;
  uploadedCoursePlan = null;
  uploadedCoursePlanConfirmed = false;
  $('#course-plan-file').value = '';
  $('#course-plan-dropzone').classList.remove('has-file', 'is-dragging');
  $('#course-plan-file-name').textContent = '尚未选择文件';
  $('#course-plan-upload-panel').classList.remove('is-reviewing');
  $('#course-plan-upload-review').classList.add('hidden');
  $('#course-plan-upload-review').innerHTML = '';
  $('#course-plan-upload-status').className = 'course-plan-upload-status';
  $('#course-plan-upload-status').textContent = '';
}

function restoreAiModeDraft(draft) {
  const data = draft?.subjectCode === currentSubjectCode ? draft : {};
  $('#student-name').value = String(data.studentName || '');
  $('#current-score').value = String(data.currentScore || '');
  $('#target-score').value = String(data.targetScore || '');
  $('#total-hours').value = String(data.totalHours || '');
  $('#lesson-count').value = String(data.lessonCount || '');
  $('#planning-scenario').value = PLANNING_SCENARIOS[data.planningScenario] ? data.planningScenario : '';
  $('#include-exam-training').checked = data.includeExamTraining === true;
  restoreSchoolExams(data);
  if ($('#parent-conclusion')) $('#parent-conclusion').value = String(data.parentConclusion || '');
  $('#feedback-internal').value = data.feedback?.internal || '';
  $('#feedback-family').value = data.feedback?.family || '';
  $('#feedback-review-status').textContent = '';
  reviewedFeedbackKey = data.feedbackReviewed ? JSON.stringify(feedbackInputs()) : '';
  const languageAssessment = data.satEnglishAssessment && typeof data.satEnglishAssessment === 'object' ? data.satEnglishAssessment : {};
  $('#language-test-type').value = languageAssessment.testType || '';
  $('#language-score-scale').value = languageAssessment.scoreScale === 'legacy_0_120' ? 'legacy_0_120' : 'new_1_6';
  $('#language-overall-score').value = languageAssessment.overallScore ?? '';
  $('#language-reading-score').value = languageAssessment.readingScore ?? '';
  $('#language-test-date').value = languageAssessment.testDate || '';
  renderSatMathHoursInputs(data.satMathHours && typeof data.satMathHours === 'object' ? data.satMathHours : createEmptySatMathHours());
  renderPlanningFocusOptions(Array.isArray(data.planningFocusAreas) ? data.planningFocusAreas : []);
  if (!currentSubjectCode.startsWith('ap_')) $('#exam-date').value = String(data.examDate || '');
  updateLanguageAssessmentFields();
  updateLessonCountHint();
  configureSatSubjectContext();
}

function switchPlanningSource(value) {
  const nextSource = value === 'upload' ? 'upload' : 'ai';
  if (nextSource === planningSource) {
    setPlanningSource(nextSource);
    return;
  }
  if (planningSource === 'ai' && nextSource === 'upload') {
    aiModeDraft = collectFormDraft();
    setPlanningSource('upload');
    return;
  }
  clearCoursePlanUploadState();
  setPlanningSource('ai');
  restoreAiModeDraft(aiModeDraft);
  aiModeDraft = null;
  scheduleFormDraftSave();
}

function showGenerationProgress(title, detail, completed, total) {
  $('#generation-progress-title').textContent = title;
  $('#generation-progress-detail').textContent = detail;
  const meter = $('#generation-progress-meter');
  if (total > 0) {
    meter.max = total;
    meter.value = completed;
  } else {
    meter.removeAttribute('value');
  }
}

function setGenerationControlsLocked(locked, source = null) {
  activeGenerationSource = locked ? source : null;
  $('#generation-progress').hidden = !locked;
  $('#report-form').classList.toggle('generation-in-progress', locked);
  document.querySelectorAll('#report-form input, #report-form select, #report-form textarea, [data-form-next], [data-form-module], [data-scenario-sample], #review-feedback, #manual-feedback, #quick-preview-report').forEach((control) => {
    if (locked) {
      control.dataset.disabledBeforeGeneration = String(control.disabled);
      control.disabled = true;
      return;
    }
    control.disabled = control.dataset.disabledBeforeGeneration === 'true';
    delete control.dataset.disabledBeforeGeneration;
  });
  if (!locked) setPlanningSource(planningSource, { preserveNotice: true });
  $('#report-form').setAttribute('aria-busy', String(locked));
}

function renderUploadedCoursePlan(result) {
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const satReviewWarnings = Array.isArray(result.satReviewWarnings) ? result.satReviewWarnings : [];
  const corrections = Array.isArray(result.extraction?.corrections) ? result.extraction.corrections : [];
  const stages = Array.isArray(result.extraction?.stages) ? result.extraction.stages : [];
  const needsDurationFix = !result.lockedPlan;
  const eyebrow = needsDurationFix ? '需要补充信息' : 'SAT 专项复核';
  const heading = needsDurationFix ? '调整课程规划' : '确认课程范围';
  const description = needsDurationFix
    ? `${result.extraction?.title || result.fileName || '已解析课程规划'} · AI 未能确认部分时长，请补全后填写试听反馈。`
    : `${result.extraction?.title || result.fileName || '已解析课程规划'} · 以下提示仅供老师复核，系统不会修改原文件。`;
  const confirmLabel = needsDurationFix ? '补全并确认课程规划' : '确认原课程规划';
  $('#course-plan-upload-review').innerHTML = `<header><div><p class="eyebrow">${eyebrow}</p><h3>${heading}</h3><p>${escapeHtml(description)}</p></div><div class="course-plan-review-actions"><button type="button" class="secondary-btn" data-upload-action="reselect">重新上传</button><button type="button" class="primary-btn" data-upload-action="confirm">${confirmLabel}</button></div></header>${satReviewWarnings.length ? `<section class="sat-upload-review"><strong>SAT 课程范围提示</strong><ul>${satReviewWarnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p>提示不会阻止使用原规划，也不会自动补课或删改内容。</p></section>` : ''}${warnings.length ? `<ul class="course-plan-upload-warnings">${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}${corrections.length ? `<details><summary>查看 ${corrections.length} 项文字修正</summary><ul class="course-plan-upload-warnings">${corrections.map((item) => `<li>${escapeHtml(item.original)} → ${escapeHtml(item.corrected)}</li>`).join('')}</ul></details>` : ''}<div>${stages.map((stage, stageIndex) => `<section class="uploaded-stage" data-upload-stage="${stageIndex}"><input aria-label="阶段名称" value="${escapeHtml(stage.title)}" maxlength="100" required><textarea aria-label="阶段说明" maxlength="300">${escapeHtml(stage.description || '')}</textarea><div class="uploaded-lessons">${stage.lessons.map((lesson, lessonIndex) => `<div class="uploaded-lesson" data-upload-lesson="${lessonIndex}"><select aria-label="课时时长"><option value="">未填写</option>${[0.5, 1, 1.5, 2].map((duration) => `<option value="${duration}"${Number(lesson.duration) === duration ? ' selected' : ''}>${duration}h</option>`).join('')}</select><input aria-label="课程主题" value="${escapeHtml(lesson.theme)}" maxlength="120" required><textarea aria-label="课程内容" maxlength="600">${escapeHtml(lesson.content || '')}</textarea></div>`).join('')}</div></section>`).join('')}</div>`;
  $('#course-plan-upload-panel').classList.add('is-reviewing');
  $('#course-plan-upload-review').classList.remove('hidden');
  uploadedCoursePlanConfirmed = false;
  uploadedCoursePlan = null;
  $('#course-plan-upload-review').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function confirmUploadedCoursePlan(coursePlan) {
  uploadedCoursePlan = cloneCoursePlan(coursePlan);
  uploadedCoursePlanConfirmed = true;
  const lessonCount = coursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
  $('#total-hours').value = String(coursePlan.totalHours);
  $('#lesson-count').value = String(lessonCount);
  $('#course-plan-upload-status').className = 'course-plan-upload-status success';
  $('#course-plan-upload-status').textContent = `课程规划已确认：${lessonCount} 节，共 ${coursePlan.totalHours} 小时。请继续填写试听课反馈。`;
  const confirmButton = $('#course-plan-upload-review [data-upload-action="confirm"]');
  if (confirmButton) confirmButton.textContent = '课程规划已确认';
  setPlanningSource('upload');
  $('#teacher-notes').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function collectUploadedCoursePlan() {
  const stages = [...document.querySelectorAll('[data-upload-stage]')].map((stage) => ({
    title: stage.querySelector('[aria-label="阶段名称"]').value.trim(),
    description: stage.querySelector('[aria-label="阶段说明"]').value.trim(),
    lessons: [...stage.querySelectorAll('[data-upload-lesson]')].map((lesson) => ({
      duration: Number(lesson.querySelector('[aria-label="课时时长"]').value),
      theme: lesson.querySelector('[aria-label="课程主题"]').value.trim(),
      content: lesson.querySelector('[aria-label="课程内容"]').value.trim(),
      difficulty: '',
      goal: '',
      unitCodes: [],
    })),
  }));
  const lessons = stages.flatMap((stage) => stage.lessons);
  if (!stages.length || !lessons.length || lessons.some((lesson) => ![0.5, 1, 1.5, 2].includes(lesson.duration) || !lesson.theme)) {
    throw new Error('请补齐每节课的时长和课程主题');
  }
  const totalHours = lessons.reduce((total, lesson) => total + lesson.duration, 0);
  if (lessons.length > 60 || totalHours < 2 || totalHours > 60) throw new Error('课程规划须为 1–60 节、总计 2–60 小时');
  return { totalHours, rationale: '', stages };
}

async function parseUploadedCoursePlan() {
  const file = selectedCoursePlanFile || $('#course-plan-file').files[0];
  const parseVersion = coursePlanParseVersion;
  const status = $('#course-plan-upload-status');
  if (!file) {
    status.className = 'course-plan-upload-status error';
    status.textContent = '请先选择 DOCX、XLSX 或 PDF 文件。';
    return;
  }
  status.className = 'course-plan-upload-status';
  status.textContent = '正在读取并整理课程规划，请稍候…';
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('subjectCode', currentSubjectCode);
    const result = await requestReportJson('/api/parse-course-plan', form, { timeoutMs: 245000 });
    if (parseVersion !== coursePlanParseVersion) return;
    const satReviewWarnings = Array.isArray(result.satReviewWarnings) ? result.satReviewWarnings : [];
    if (result.lockedPlan && !satReviewWarnings.length) {
      confirmUploadedCoursePlan(result.lockedPlan);
      return;
    }
    renderUploadedCoursePlan(result);
    status.className = `course-plan-upload-status ${result.lockedPlan ? '' : 'error'}`.trim();
    status.textContent = result.lockedPlan ? '请复核 SAT 课程范围提示，确认后继续。' : '部分课时时长无法确认，请补全后继续。';
  } catch (error) {
    if (parseVersion !== coursePlanParseVersion) return;
    status.className = 'course-plan-upload-status error';
    showWorkflowError(status, error, 'upload');
  }
}

function selectCoursePlanFile(file) {
  const status = $('#course-plan-upload-status');
  coursePlanParseVersion += 1;
  uploadedCoursePlan = null;
  uploadedCoursePlanConfirmed = false;
  $('#course-plan-upload-review').classList.add('hidden');
  $('#course-plan-upload-review').innerHTML = '';
  setPlanningSource('upload');
  const validExtension = /\.(docx|xlsx|pdf)$/i.test(file?.name || '');
  if (!file || !validExtension || file.size === 0 || file.size > 8 * 1024 * 1024) {
    selectedCoursePlanFile = null;
    $('#course-plan-dropzone').classList.remove('has-file');
    $('#course-plan-file-name').textContent = '尚未选择文件';
    status.className = 'course-plan-upload-status error';
    status.textContent = !validExtension ? '请选择 DOCX、XLSX 或 PDF 文件后重新上传。' : file?.size === 0 ? '文件为空，请保存课程规划后重新选择文件。' : '文件超过 8MB，请压缩或只保留本次规划后重新上传。';
    return;
  }
  selectedCoursePlanFile = file;
  uploadedCoursePlan = null;
  uploadedCoursePlanConfirmed = false;
  $('#course-plan-upload-review').classList.add('hidden');
  $('#course-plan-upload-review').innerHTML = '';
  $('#course-plan-dropzone').classList.add('has-file');
  $('#course-plan-file-name').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)}MB`;
  status.className = 'course-plan-upload-status';
  status.textContent = '文件已选择，AI 正在读取并整理课程规划…';
  parseUploadedCoursePlan();
}

function getSelectedPlanningFocusAreas() {
  return normalizePlanningFocusAreas(
    [...document.querySelectorAll('[name="planning-focus"]:checked')].map((input) => input.value),
    currentSubjectCode,
  );
}

function updatePlanningFocusState() {
  const selected = getSelectedPlanningFocusAreas();
  document.querySelectorAll('[name="planning-focus"]').forEach((input) => {
    input.disabled = selected.length >= MAX_PLANNING_FOCUS_AREAS && !input.checked;
  });
  $('#planning-focus-hint').textContent = selected.length
    ? `已选择 ${selected.length}/${MAX_PLANNING_FOCUS_AREAS} 项，只影响课程安排，不代表学生能力结论`
    : '未选择时，系统将根据课堂记录安排课程重点';
}

function renderPlanningFocusOptions(selectedValues = []) {
  const selected = new Set(normalizePlanningFocusAreas(selectedValues, currentSubjectCode));
  $('#planning-focus-options').innerHTML = getPlanningFocusOptions(currentSubjectCode)
    .map((option) => `<label><input type="checkbox" name="planning-focus" value="${escapeHtml(option.code)}"${selected.has(option.code) ? ' checked' : ''}>${escapeHtml(option.label)}</label>`)
    .join('');
  updatePlanningFocusState();
}

function buildCurrentPlanningContext(lessonCount, source = currentReportData?.planningContext?.source === 'upload' ? 'upload' : planningSource) {
  const reportContext = currentReportData?.planningContext;
  const formData = collectFormData(source);
  return {
    scenario: resolvePlanningScenario(reportContext?.scenario || $('#planning-scenario').value),
    lessonCount,
    focusAreas: normalizePlanningFocusAreas(reportContext?.focusAreas ?? getSelectedPlanningFocusAreas(), currentSubjectCode),
    includeExamTraining: source === 'ai' && (reportContext?.includeExamTraining === true || $('#include-exam-training').checked),
    ...(source === 'ai' && currentSubjectCode === 'sat_english' && (formData.satEnglishAssessment || reportContext?.satEnglishAssessment) ? { satEnglishAssessment: formData.satEnglishAssessment || reportContext?.satEnglishAssessment } : {}),
    ...(source === 'ai' && currentSubjectCode === 'sat_math' && (formData.satMathHours || reportContext?.satMathHours) ? { satMathHours: formData.satMathHours || reportContext?.satMathHours } : {}),
    source,
  };
}

function clearLessonCountValidity() {
  $('#lesson-count').setCustomValidity('');
  updateLessonCountHint();
}

function updateLessonCountHint() {
  const range = getLessonCountRange($('#total-hours').value);
  $('#lesson-count-hint').textContent = range
    ? `当前总课时支持 ${range.minimum}–${range.maximum} 节，请独立填写；每节 0.5–2 小时`
    : '请根据实际授课安排独立填写，单次支持 0.5–2 小时';
}

function getSelectedExamDate() {
  return currentSubjectCode.startsWith('ap_') ? $('#ap-exam-date').value : $('#exam-date').value.trim();
}

function getGenerationChecklistItems() {
  const formData = collectFormData();
  const teacher = getActiveTeacherProfile();
  const focusLabels = getPlanningFocusOptions(currentSubjectCode)
    .filter((option) => formData.planningFocusAreas.includes(option.code))
    .map((option) => option.label);
  const items = buildGenerationChecklist({
    studentName: formData.studentName,
    subjectName: createSubjectViewModel(currentSubjectCode).displayName,
    currentScore: formData.currentScore,
    targetScore: formData.targetScore,
    examDate: formData.examDate,
    totalHours: formData.totalHours,
    lessonCount: formData.lessonCount,
    planningScenarioLabel: PLANNING_SCENARIOS[formData.planningScenario].label,
    planningFocusLabel: focusLabels.join('、'),
    teacherName: teacher?.displayName || '',
    notesLength: formData.teacherNotes.length,
  });
  if (planningSource !== 'upload') {
    if (reportGenerationBaseline) {
      const nextInput = normalizeGenerationInput({ ...formData, subjectCode: currentSubjectCode, source: planningSource });
      const forceNewPlan = $('[name="regeneration-plan-mode"]:checked')?.value === 'replace';
      const action = getGenerationAction(reportGenerationBaseline, nextInput, { forceNewPlan });
      items.push({
        label: '本次修改方式',
        value: action === 'reuse' ? '输入未变化，保留现有报告与人工修改' : action === 'summary-only' ? '仅更新试听总结，保留课程内容、课时和顺序' : '根据当前条件重新制定课程规划',
        status: 'ready',
      });
    }
    if (currentSubjectCode === 'sat_math' && formData.satMathHours) {
      items.push({
        label: 'SAT 数学课时分配',
        value: SAT_MATH_AREA_CONFIG.map((item) => `${item.label} ${formData.satMathHours[item.code]}h`).join('；'),
        status: 'ready',
      });
    }
    if (currentSubjectCode === 'sat_english') {
      const assessment = formData.satEnglishAssessment;
      items.push({
        label: '语言成绩参考',
        value: assessment ? `${assessment.testType === 'toefl_ibt' ? 'TOEFL iBT' : 'IELTS Academic'} ${assessment.overallScore}${assessment.readingScore !== undefined ? `，阅读 ${assessment.readingScore}` : ''}` : '未提供，按 SAT 诊断与课堂记录规划',
        status: assessment ? 'ready' : 'optional',
      });
    }
    return items;
  }
  return [
    ...items.filter((item) => !['辅导场景', '课程侧重点'].includes(item.label)),
    { label: '生成方式', value: '老师上传已有规划', status: 'ready' },
  ];
}

function getGenerationInputConflicts() {
  if (planningSource === 'upload') return [];
  const formData = collectFormData();
  return detectInputConflicts({
    teacherNotes: formData.teacherNotes,
    currentScore: formData.currentScore,
    targetScore: formData.targetScore,
    examDate: formData.examDate,
    totalHours: formData.totalHours,
    lessonCount: formData.lessonCount,
    includeExamTraining: formData.includeExamTraining,
  });
}

function renderFormReview() {
  const groups = [
    ['student', '学生信息', [$('#student-name').value.trim() || '待填写学生姓名', createSubjectViewModel(currentSubjectCode).displayName].join(' · ')],
    ['feedback', '试听反馈', `${$('#teacher-notes').value.trim().length} 字`],
    ['planning', '课程规划', planningSource === 'upload'
      ? (uploadedCoursePlanConfirmed ? '已确认上传规划' : '待确认上传规划')
      : `${$('#total-hours').value || '待填'} 小时 · ${$('#lesson-count').value || '待填'} 课次`],
  ];
  $('#form-review-summary').innerHTML = groups.map(([module, label, value]) => `
    <section><div><h3>${label}</h3><p>${escapeHtml(value)}</p></div>
    <button type="button" class="secondary-btn" data-form-next="${module}">修改${label}</button></section>`).join('');
}

function showFormModule(module, { focus = false } = {}) {
  const panel = $(`#form-${module}`);
  if (!panel?.matches('[data-form-panel]')) return;
  document.querySelectorAll('[data-form-module]').forEach((button) => {
    if (button.dataset.formModule === module) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  if (module === 'review') renderFormReview();
  if (focus) {
    const heading = panel.querySelector('h2');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    $('#new-view .topbar').scrollIntoView({ block: 'start' });
  }
}

function revealFormField(field) {
  const module = field?.closest('[data-form-panel]')?.dataset.formPanel;
  if (!module) return;
  showFormModule(module);
  if (field.closest('details')) field.closest('details').open = true;
  field.scrollIntoView({ block: 'center' });
}

$('#report-form').addEventListener('click', (event) => {
  const button = event.target.closest('[data-form-module], [data-form-next]');
  if (button) showFormModule(button.dataset.formModule || button.dataset.formNext, { focus: true });
});

function closeGenerationChecklist(confirmed) {
  $('#generation-checklist-modal').classList.add('hidden');
  document.body.classList.remove('modal-open');
  const resolve = generationChecklistResolver;
  generationChecklistResolver = null;
  resolve?.(confirmed);
}

function openGenerationChecklist() {
  if (generationChecklistResolver) closeGenerationChecklist(false);
  const items = getGenerationChecklistItems();
  const conflicts = getGenerationInputConflicts();
  $('#generation-conflict-summary').classList.toggle('hidden', conflicts.length === 0);
  $('#generation-conflict-summary').innerHTML = conflicts.length
    ? `<strong>发现 ${conflicts.length} 项信息可能冲突</strong><p>自然语言记录与上方字段不一致。建议返回修改；如果继续生成，课程表的课时和课次仍以上方字段为准。</p>`
    : '';
  $('#generation-checklist-content').innerHTML = [
    ...items.map((item) => `<div class="generation-checklist-item ${escapeHtml(item.status)}"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.value)}</b></div>`),
    ...conflicts.map((conflict) => `<div class="generation-checklist-item conflict"><span>${escapeHtml(conflict.label)}冲突</span><b>文字记录：${escapeHtml(conflict.noteValue)}<br>上方填写：${escapeHtml(conflict.formValue)}</b></div>`),
  ].join('');
  $('[data-checklist-action="confirm"]').textContent = conflicts.length ? '已知晓，继续生成' : '确认并生成';
  $('#generation-checklist-modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  $('.generation-checklist-body').scrollTop = 0;
  $('[data-checklist-action="confirm"]').focus({ preventScroll: true });
  return new Promise((resolve) => {
    generationChecklistResolver = resolve;
  });
}

function validateGenerationInputs() {
  const notice = $('#generation-notice');
  for (const [selector, field, minimum, maximum] of [['#student-name', 'studentName', 1, 30], ['#teacher-notes', 'teacherNotes', 20, 6000]]) {
    const value = $(selector).value.trim();
    if (value.length < minimum || value.length > maximum) {
      const error = new Error('INVALID_INPUT');
      error.issues = [{ path: field }];
      showWorkflowError(notice, error, 'generate');
      revealFormField($(selector));
      $(selector).focus();
      return false;
    }
  }
  if (!subjectSelectionConfirmed) {
    $('#subject-search').setCustomValidity('请从下拉列表中选择课程科目');
    notice.classList.add('error');
    notice.innerHTML = '<strong>科目未确认：</strong>请从搜索结果中点击或按 Enter 选择课程科目。';
    revealFormField($('#subject-search'));
    $('#subject-search').reportValidity();
    return false;
  }
  if (planningSource === 'upload' && !uploadedCoursePlanConfirmed) {
    notice.classList.add('error');
    notice.innerHTML = '<strong>课程规划尚未就绪：</strong>请上传文件；如系统发现范围风险，请复核确认后继续。';
    revealFormField($('#course-plan-upload-panel'));
    return false;
  }
  const currentScore = $('#current-score');
  const targetScore = $('#target-score');
  const lessonCount = $('#lesson-count');
  currentScore.setCustomValidity('');
  targetScore.setCustomValidity('');
  lessonCount.setCustomValidity('');
  if (planningSource === 'ai' && currentSubjectCode === 'sat_math') {
    updateSatMathHoursSummary();
    const mathValidation = validateSatMathHours(collectSatMathHours(), $('#total-hours').value);
    document.querySelectorAll('[data-sat-math-hours]').forEach((input) => input.setCustomValidity(''));
    const total = Number($('#total-hours').value);
    if (!mathValidation.valid || total < 2 || total > 60) {
      const message = !mathValidation.valid ? mathValidation.message : '总课时须为 2–60 小时，请调整各领域课时';
      const input = !mathValidation.valid && mathValidation.code !== 'total'
        ? $(`[data-sat-math-hours="${mathValidation.code}"]`) : $('[data-sat-math-hours]');
      input?.setCustomValidity(message);
      notice.classList.add('error');
      notice.innerHTML = `<strong>数学课时分配有误：</strong>${escapeHtml(message)}`;
      revealFormField(input);
      input?.reportValidity();
      return false;
    }
  }
  const lessonCountRange = getLessonCountRange($('#total-hours').value);
  const requestedLessonCount = Number(lessonCount.value);
  if (!lessonCountRange || !Number.isInteger(requestedLessonCount)
    || requestedLessonCount < lessonCountRange.minimum || requestedLessonCount > lessonCountRange.maximum) {
    const rangeText = lessonCountRange ? `${lessonCountRange.minimum}–${lessonCountRange.maximum}` : '有效';
    lessonCount.setCustomValidity(`当前总课时下，预计课次应为 ${rangeText} 节`);
    notice.classList.add('error');
    notice.innerHTML = `<strong>课次填写有误：</strong>当前总课时下，预计课次应为 ${escapeHtml(rangeText)} 节。`;
    revealFormField(lessonCount);
    lessonCount.reportValidity();
    return false;
  }
  if (planningSource === 'ai' && currentSubjectCode === 'sat_english') {
    const languageValidation = validateSatEnglishAssessment(collectSatEnglishAssessment());
    $('#language-overall-score').setCustomValidity('');
    $('#language-reading-score').setCustomValidity('');
    if (!languageValidation.valid) {
      const input = languageValidation.field === 'reading' ? $('#language-reading-score') : $('#language-overall-score');
      input.setCustomValidity(languageValidation.message);
      notice.classList.add('error');
      notice.innerHTML = `<strong>语言成绩填写有误：</strong>${escapeHtml(languageValidation.message)}`;
      revealFormField(input);
      input.reportValidity();
      return false;
    }
  }
  const validation = validateSubjectScores(
    currentSubjectCode,
    currentScore.value,
    resolveTargetScore(currentSubjectCode, targetScore.value),
  );
  if (validation.valid) return true;
  validation.errors.forEach((error) => {
    const input = error.path === 'currentScore' ? currentScore : targetScore;
    input.setCustomValidity(error.message);
  });
  notice.classList.add('error');
  notice.innerHTML = `<strong>成绩填写有误：</strong>${escapeHtml(validation.errors[0].message)}`;
  const firstInput = validation.errors[0].path === 'currentScore' ? currentScore : targetScore;
  revealFormField(firstInput);
  firstInput.reportValidity();
  return false;
}

function resolveStoredSubjectCode(subjectName) {
  return SUBJECT_CODES.find((code) => SUBJECT_CATALOG[code].displayName === subjectName) || 'sat_math';
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function loadHistoryReports() {
  const container = $('#history-list');
  container.innerHTML = '<div class="history-empty">正在读取历史报告…</div>';
  try {
    const result = await requestReportJson('/api/reports', undefined, { method: 'GET', timeoutMs: 20000 });
    if (result.demo) throw new Error('SYSTEM_NOT_CONFIGURED');
    if (!result.reports?.length) {
      container.innerHTML = '<div class="history-empty">还没有保存过报告。生成报告后点击“保存报告”，这里就会出现历史记录。</div>';
      return;
    }
    container.innerHTML = result.reports.map((report) => `<article class="history-card"><div><span class="history-chip">${escapeHtml(report.status === 'completed' ? '已完成' : report.status)}</span><h2>${escapeHtml(report.student_name)} · ${escapeHtml(report.subject)}</h2><p>更新于 ${escapeHtml(formatHistoryDate(report.updated_at))}</p></div><button type="button" class="secondary-btn" data-history-id="${escapeHtml(report.id)}">打开报告</button></article>`).join('');
  } catch (error) {
    container.innerHTML = '<div class="history-empty" id="history-error-notice"></div>';
    showWorkflowError($('#history-error-notice'), error, 'history');
  }
}

function buildHistoricalTeacherProfile(snapshot) {
  if (!snapshot?.displayName) return null;
  const publicPhoto = snapshot.photoAsset?.source === 'public' ? snapshot.photoAsset.path : null;
  const publicQr = snapshot.qrAsset?.source === 'public' ? snapshot.qrAsset.path : null;
  return normalizeTeacherProfile({
    ...snapshot,
    photoUrl: publicPhoto || teacherProfile?.photoUrl || null,
    qrUrl: publicQr || teacherProfile?.qrUrl || null,
  });
}

async function openHistoricalReport(reportId) {
  const result = await requestGeneratedJson(`/api/reports?id=${encodeURIComponent(reportId)}`, undefined, 'GET');
  if (!result.report) throw new Error('REPORT_NOT_FOUND');
  try {
    displayHistoricalReport(result.report);
  } catch (cause) {
    throw new Error('HISTORICAL_REPORT_RENDER_FAILED', { cause });
  }
}

function displayHistoricalReport(record) {
  const subjectCode = resolveStoredSubjectCode(record.subject);
  applySubjectSelection(subjectCode);
  $('#student-name').value = record.student_name || '';
  $('#current-score').value = record.current_score || '';
  $('#target-score').value = record.target_score || '';
  restoreSchoolExams({teacherNotes:record.report_data?.generationInput?.teacherNotes || (record.original_notes === LEGACY_UPLOAD_REPORT_NOTE ? '' : record.original_notes)});
  $('#feedback-internal').value = '';
  $('#feedback-family').value = '';
  $('#feedback-review-status').textContent = '';
  $('#total-hours').value = record.course_plan?.totalHours || '';
  const savedPlanningContext = record.report_data?.planningContext || {};
  $('#planning-scenario').value = resolvePlanningScenario(savedPlanningContext.scenario);
  renderPlanningFocusOptions(savedPlanningContext.focusAreas || []);
  const savedLessons = record.course_plan?.stages?.flatMap((stage) => stage.lessons || []) || [];
  // The saved plan may have been edited after generation. Its actual lesson count wins on reopen.
  $('#lesson-count').value = savedLessons.length || savedPlanningContext.lessonCount || Math.ceil(Number(record.course_plan?.totalHours || 0) / 2) || '';
  $('#include-exam-training').checked = savedPlanningContext.includeExamTraining === true;
  const languageAssessment = savedPlanningContext.satEnglishAssessment || {};
  $('#language-test-type').value = languageAssessment.testType || '';
  $('#language-score-scale').value = languageAssessment.scoreScale === 'legacy_0_120' ? 'legacy_0_120' : 'new_1_6';
  $('#language-overall-score').value = languageAssessment.overallScore ?? '';
  $('#language-reading-score').value = languageAssessment.readingScore ?? '';
  $('#language-test-date').value = languageAssessment.testDate || '';
  renderSatMathHoursInputs(savedPlanningContext.satMathHours || createEmptySatMathHours());
  configureSatSubjectContext();
  updateLessonCountHint();
  if (subjectCode.startsWith('ap_')) {
    const examDate = record.exam_date_text || '';
    if (examDate && !Array.from($('#ap-exam-date').options).some((option) => option.value === examDate)) {
      $('#ap-exam-date').add(new Option(`${examDate} AP 考试`, examDate));
    }
    $('#ap-exam-date').value = examDate;
  } else {
    $('#exam-date').value = record.exam_date_text || '';
  }
  const savedPlan = record.course_plan || record.report_data?.coursePlan;
  const fallback = buildFallbackReport(subjectCode, {...collectFormData(),lessonCount:undefined}, savedPlan);
  currentReportData = {
    ...fallback,
    ...(record.report_data || {}),
    coursePlan: fallback.coursePlan,
    salesFollowUp: {
      ...fallback.salesFollowUp,
      ...(record.sales_follow_up || {}),
    },
  };
  currentReportId = record.id;
  pendingReportSaveToken = null;
  reportGenerationBaseline = record.report_data?.generationInput || normalizeGenerationInput({
    ...collectFormData(savedPlanningContext.source === 'upload' ? 'upload' : 'ai'),
    subjectCode,
    source: savedPlanningContext.source,
  });
  if (savedPlanningContext.source === 'upload') {
    planningSource = 'upload';
    uploadedCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
    uploadedCoursePlanConfirmed = true;
    document.querySelector('[name="planning-source"][value="upload"]').checked = true;
    setPlanningSource('upload');
  } else {
    planningSource = 'ai';
    uploadedCoursePlan = null;
    uploadedCoursePlanConfirmed = false;
    document.querySelector('[name="planning-source"][value="ai"]').checked = true;
    setPlanningSource('ai');
  }
  historicalTeacherProfile = buildHistoricalTeacherProfile(record.teacher_snapshot);
  isQuickPreview = false;
  originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  renderReport(currentReportData);
  setQuickPreviewActions(false);
  teacherReportModule = 'summary';
  setReportDisplayMode('workspace');
  changeView('report');
  document.querySelector('#report-view .eyebrow').textContent = '历史报告 · 已保存';
  $('#save-report').textContent = '保存报告';
}

async function generateAiReport({ source, formData, subjectCode, preserveCoursePlan = null }) {
  if (preserveCoursePlan) {
    const result = await requestGeneratedJson('/api/generate-report', {
      ...formData,
      subjectCode,
      lockedCoursePlan: cloneCoursePlan(preserveCoursePlan),
      planningSource: 'ai',
    });
    return result.report;
  }
  if (source === 'upload') {
    if (!formData.lockedCoursePlan) throw new Error('LOCKED_PLAN_REQUIRED');
    const result = await requestGeneratedJson('/api/generate-report', {
      ...formData,
      subjectCode,
    });
    return result.report;
  }
  if (formData.lockedCoursePlan) throw new Error('AI_MODE_LOCKED_PLAN_FORBIDDEN');
  const commonPayload = {
    ...formData,
    subjectCode,
  };
  let checkpoint = loadGenerationCheckpoint(commonPayload);
  let outlineResult = checkpoint?.outlineResult;
  if (!outlineResult) {
    clearRecoveryRecord(GENERATION_CHECKPOINT_STORAGE_KEY);
    outlineResult = await retryGenerationStep(
      () => requestGeneratedJson('/api/generate-report-batch', { ...commonPayload, operation: 'outline' }),
      2,
      (attempt, attempts) => {
        showGenerationProgress('正在制定课程大纲', attempt === 1 ? '根据试听反馈和课时安排划分课程阶段。' : `正在重试（${attempt}/${attempts}）。`);
      },
    );
    checkpoint = null;
  }
  const outline = outlineResult.outline;
  const stages = outline.stages;
  const generatedStages = checkpoint
    ? normalizeGeneratedStages(checkpoint.generatedStages, stages.length)
    : new Array(stages.length);
  let completedStages = countCompletedStages(generatedStages);
  const pendingStageIndexes = getPendingStageIndexes(generatedStages);
  let stageCursor = 0;
  const activeStageAttempts = new Map();
  saveGenerationCheckpoint(commonPayload, outlineResult, generatedStages);
  const updateProgress = () => {
    const activeText = [...activeStageAttempts.entries()]
      .map(([stageIndex, attempt]) => `第 ${stageIndex + 1} 阶段${attempt > 1 ? `（第 ${attempt}/3 次尝试）` : ''}`)
      .join('、');
    const status = activeText ? `正在处理${activeText}。` : '';
    showGenerationProgress('正在生成课次', `已完成 ${completedStages}/${stages.length} 个阶段。${status}`, completedStages, stages.length);
  };
  updateProgress();
  const worker = async () => {
    while (stageCursor < pendingStageIndexes.length) {
      const stageIndex = pendingStageIndexes[stageCursor];
      stageCursor += 1;
      const stage = stages[stageIndex];
      let stageResult;
      try {
        stageResult = await retryGenerationStep(
          () => requestGeneratedJson('/api/generate-report-batch', {
            ...commonPayload,
            operation: 'stage',
            stage: {
              title: stage.title,
              description: stage.description,
              lessonCount: stage.lessonCount,
              ...(stage.assessment ? { assessment: stage.assessment } : {}),
            },
            stageIndex,
            stageCount: stages.length,
            startLessonNumber: stage.startLessonNumber,
            durations: stage.durations,
            previousStageTitle: stages[stageIndex - 1]?.title || '',
            nextStageTitle: stages[stageIndex + 1]?.title || '',
          }),
          3,
          (attempt) => {
            activeStageAttempts.set(stageIndex, attempt);
            updateProgress();
          },
        );
      } catch (error) {
        activeStageAttempts.delete(stageIndex);
        updateProgress();
        throw error;
      }
      generatedStages[stageIndex] = {
        title: stage.title,
        description: stage.description,
        ...(stage.assessment ? { assessment: stage.assessment } : {}),
        lessons: stageResult.lessons,
      };
      activeStageAttempts.delete(stageIndex);
      completedStages += 1;
      saveGenerationCheckpoint(commonPayload, outlineResult, generatedStages);
      updateProgress();
    }
  };
  const workerResults = await Promise.allSettled(Array.from({ length: Math.min(2, pendingStageIndexes.length) }, () => worker()));
  const failedWorker = workerResults.find((result) => result.status === 'rejected');
  if (failedWorker) throw failedWorker.reason;
  const generatedLessonCount = generatedStages.reduce((total, stage) => total + stage.lessons.length, 0);
  if (generatedLessonCount !== Number(formData.lessonCount)) {
    saveGenerationCheckpoint(commonPayload, outlineResult, new Array(stages.length));
    const error = new Error('STAGE_LESSON_COUNT_MISMATCH');
    error.reason = `完整规划应包含 ${formData.lessonCount} 个课次，实际生成 ${generatedLessonCount} 个。`;
    error.suggestion = '请重新生成；系统不会再用占位课次补齐。';
    throw error;
  }
  if (formData.includeExamTraining) {
    const examLessonPattern = /模考|考试|真题|MCQ|FRQ|错题|讲评|订正|计时|套题|exam|mock|practice/i;
    const examLessons = generatedStages.flatMap((stage) => stage.lessons).filter((lesson) => examLessonPattern.test(`${lesson.theme} ${lesson.content} ${lesson.goal}`));
    const examTrainingHours = examLessons.reduce((total, lesson) => total + Number(lesson.duration || 0), 0);
    const minimumExamTrainingHours = Number(formData.totalHours) * 0.2;
    if (examTrainingHours + 0.001 < minimumExamTrainingHours) {
      saveGenerationCheckpoint(commonPayload, outlineResult, new Array(stages.length));
      const error = new Error('EXAM_TRAINING_LESSON_COUNT_MISMATCH');
      error.reason = `已勾选考试训练，但规划中只有 ${examTrainingHours}h 考试训练，至少需要 ${minimumExamTrainingHours}h。`;
      error.suggestion = '请重新生成，系统会补充 MCQ、FRQ、模考或错题讲评安排。';
      throw error;
    }
  }
  const { stages: unusedStages, rationale, ...summary } = outline;
  const targetScore = outlineResult.targetScore || formData.targetScore || '';
  const subjectName = createSubjectViewModel(subjectCode).displayName;
  return {
    ...summary,
    coursePlan: {
      rationale,
      stages: generatedStages,
      totalHours: Number(formData.totalHours),
    },
    salesFollowUp: buildBatchedSalesFollowUp(summary, subjectName, targetScore),
    teacherNotice: '',
    target: targetScore,
    planningContext: {
      scenario: formData.planningScenario,
      lessonCount: Number(formData.lessonCount),
      focusAreas: formData.planningFocusAreas || [],
      includeExamTraining: formData.includeExamTraining === true,
      ...(formData.satEnglishAssessment ? { satEnglishAssessment: formData.satEnglishAssessment } : {}),
    ...(formData.satMathHours ? { satMathHours: formData.satMathHours } : {}),
      source: 'ai',
    },
    qualityReview: {
      reviewCompleted: true,
      subjectScopePassed: true,
      teacherVoicePassed: true,
      criticalWarnings: [],
      modelWarnings: [],
    },
  };
}

async function requestGeneratedJson(path, payload, method = 'POST') {
  return requestReportJson(path, payload, { method, timeoutMs: path === '/api/reports/reuse' ? 8000 : 245000 });
}

async function presentGeneratedReport(report, generationSource, notice, generationInput) {
  const parentConclusion = $('#parent-conclusion').value.trim();
  if (parentConclusion) report.overview = parentConclusion;
  pendingReportSaveToken = null;
  $('[name="regeneration-plan-mode"][value="preserve"]').checked = true;
  report.generationInput = normalizeGenerationInput({
    ...generationInput.formData,
    subjectCode: generationInput.subjectCode,
    source: generationSource,
  });
  reportGenerationBaseline = report.generationInput;
  currentReportData = report;
  currentReportId = pendingRegenerationReportId;
  historicalTeacherProfile = null;
  isQuickPreview = false;
  originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  setQuickPreviewActions(false);
  changeView('report');
  renderReport(currentReportData);
  teacherReportModule = 'summary';
  setReportDisplayMode('workspace');
  document.querySelector('#report-view .eyebrow').textContent = 'AI 报告已生成 · 未云端保存';
  $('#save-report').textContent = '保存报告';
  editingReportSource = false;
  const reportSaved = await saveReport({ automatic: true });
  if (reportSaved) pendingRegenerationReportId = null;
  if (generationSource === 'ai' && reportSaved) clearGenerationRecovery();
  notice.innerHTML = generationSource === 'upload'
    ? '<strong>上传模式：</strong>课程规划来自老师确认的上传文件，系统未改动课次、顺序和时长。'
    : '<strong>生成完成：</strong>总课时由老师决定，AI 仅负责规划内容与课时分配。';
}

function displayGenerationFailure(notice, error, generationInput) {
  const checkpoint = generationInput?.source === 'ai'
    ? loadGenerationCheckpoint({ ...generationInput.formData, subjectCode: generationInput.subjectCode }) : null;
  const progress = checkpoint ? `已保留 ${countCompletedStages(checkpoint.generatedStages)}/${checkpoint.outlineResult.outline.stages.length} 个阶段；继续生成会从可用进度接着处理。` : '';
  const target = error.generationStage === 'render' ? $('#report-operation-notice') : notice;
  showWorkflowError(target, error, 'generate', progress);
}

async function retryGenerationStep(task, attempts, onAttempt = () => {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      onAttempt(attempt, attempts);
      return await task();
    } catch (error) {
      lastError = error;
      if (['NETWORK_ERROR', 'REQUEST_TIMEOUT'].includes(error.message) || [401, 403, 408, 429, 502, 503, 504].includes(error.status)) throw error;
    }
  }
  throw lastError;
}

function buildBatchedSalesFollowUp(report, subjectName, targetScore) {
  const priorities = report.priorityAreas.slice(0, 3).join('、') || report.currentFocus;
  const target = targetScore ? `，逐步向 ${targetScore} 的学习目标推进` : '';
  return {
    positive: `试听课中已观察到的积极表现：${report.strength}`,
    urgent: `后续建议优先关注：${report.currentFocus}。课程重点将根据课堂作答、错题类型和完成情况继续调整。`,
    angle: `沟通时可围绕“${priorities}”介绍后续安排，说明课程会依据学生的实际表现动态调整。`,
    script: `家长您好，本次 ${subjectName} 试听课中，${report.performance}。目前比较积极的表现是：${report.strength}。接下来建议围绕${report.currentFocus}安排课程，并根据后续作答、错题和完成情况动态调整${target}。`,
  };
}


$('#report-form').addEventListener('invalid', (event) => {
  event.preventDefault();
  if (event.target !== $('#report-form').querySelector(':invalid')) return;
  const fields = { 'student-name': 'studentName', 'subject-search': 'subjectCode', 'current-score': 'currentScore', 'target-score': 'targetScore', 'total-hours': 'totalHours', 'lesson-count': 'lessonCount', 'planning-scenario': 'planningScenario', 'teacher-notes': 'teacherNotes', 'language-overall-score': 'satEnglishAssessment', 'language-reading-score': 'satEnglishAssessment' };
  const error = new Error('INVALID_INPUT');
  error.issues = [{ path: fields[event.target.id] || (event.target.dataset.satMathHours ? 'satMathHours' : '') }];
  showWorkflowError($('#generation-notice'), error, 'generate');
  revealFormField(event.target);
  event.target.focus();
}, true);
const feedbackInputs = () => ({
  internal: $('#feedback-internal').value.trim(),
  family: $('#feedback-family').value.trim(),
  subject: currentSubjectCode,
});
const schoolExamFields = [['name','考试名称','text',48],['date','考试日期','date',0],['scope','考试范围','text',100],['hours','考前可上课时（小时）','number',0]];
function schoolExamsFromNotes(notes) {
  return String(notes || '').split('\n').flatMap(line => {
    if (!line.startsWith('【校内考试】')) return [];
    try { const item = JSON.parse(line.slice('【校内考试】'.length)); return item && typeof item === 'object' ? [item] : []; } catch { return []; }
  });
}
function schoolExams() {
  return [...$('#school-exams').children].map(row => Object.fromEntries(schoolExamFields.map(([key]) => [key,row.querySelector('[data-exam="'+key+'"]').value.trim()]))).filter(item => Object.values(item).some(Boolean));
}
function addSchoolExam(item = {}) {
  if ($('#school-exams').children.length >= 8) return;
  const row = document.createElement('fieldset');
  row.className = 'school-exam';
  row.innerHTML = '<legend>校内考试</legend>' + schoolExamFields.map(([key,label,type,max]) => `<label>${label}<input data-exam="${key}" type="${type}" ${max ? 'maxlength="'+max+'"' : ''} ${key === 'hours' ? 'min="0" max="60" step="0.5"' : ''}></label>`).join('') + '<button type="button" class="text-btn">移除此考试</button>';
  for (const [key] of schoolExamFields) row.querySelector('[data-exam="'+key+'"]').value = String(item[key] ?? '');
  row.querySelector('button').onclick = () => { row.remove(); scheduleFormDraftSave(); };
  $('#school-exams').appendChild(row);
}
function restoreSchoolExams(data) {
  $('#school-exams').replaceChildren();
  $('#teacher-notes').value = String(data.teacherNotes || '').split('\n').filter(line => !line.startsWith('【校内考试】')).join('\n');
  const exams = Array.isArray(data.schoolExams) ? data.schoolExams : schoolExamsFromNotes(data.teacherNotes);
  exams.forEach(addSchoolExam);
}
$('#add-school-exam').onclick = () => addSchoolExam();
let reviewedFeedbackKey = '';

$('#manual-feedback').addEventListener('click', () => {
  reviewedFeedbackKey = JSON.stringify(feedbackInputs());
  $('#feedback-review-status').textContent = '已跳过识别，原反馈已保留。请在下方填写或核对课堂记录，再生成规划。';
  scheduleFormDraftSave();
  $('#teacher-notes').focus();
});

$('#review-feedback').addEventListener('click', async () => {
  const input = feedbackInputs();
  const key = JSON.stringify(input);
  const status = $('#feedback-review-status');
  if (input.internal.length + input.family.length < 20) {
    status.textContent = '请粘贴至少 20 字的课堂反馈，可只用一份。';
    $('#feedback-internal').focus();
    return;
  }
  const previousNotes = $('#teacher-notes').value;
  if (previousNotes.trim() && !window.confirm('识别结果将替换当前核对记录。是否继续？')) return;
  const button = $('#review-feedback');
  button.disabled = true;
  status.textContent = '正在整理反馈…';
  $('#manual-feedback').disabled = true;
  try {
    const result = await requestReportJson('/api/review-feedback', input);
    if (key !== JSON.stringify(feedbackInputs()) || previousNotes !== $('#teacher-notes').value) {
      status.textContent = '填写内容已变动，请重新识别。';
      return;
    }
    $('#teacher-notes').value = result.notes;
    const existingExams = new Set(schoolExams().map(exam => JSON.stringify(exam)));
    for (const exam of result.schoolExams || []) {
      const key = JSON.stringify(Object.fromEntries(schoolExamFields.map(([field])=>[field,String(exam[field] ?? '')])));
      if (!existingExams.has(key)) { addSchoolExam(exam); existingExams.add(key); }
    }
    reviewedFeedbackKey = key;
    status.textContent = result.missing?.length
      ? `请核对下方记录并补充：${result.missing.join('；')}`
      : '识别完成。请核对下方记录，确认后生成规划。';
    scheduleFormDraftSave();
    $('#teacher-notes').focus();
  } catch (error) {
    const guidance = getWorkflowError(error).reason;
    status.textContent = `${guidance}。原反馈仍在，请重新识别；也可直接在下方填写课堂记录。`;
  } finally {
    $('#manual-feedback').disabled = false;
    button.disabled = false;
  }
});

$('#report-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (activeGenerationSource) return;
  const button = $('#generate-report');
  const notice = $('#generation-notice');
  const feedback = feedbackInputs();
  if ((feedback.internal || feedback.family) && reviewedFeedbackKey !== JSON.stringify(feedback)) {
    $('#feedback-review-status').textContent = '反馈尚未识别或已改动。请选择“识别反馈”，或跳过识别并手动填写课堂记录。';
    revealFormField($('#review-feedback'));
    $('#review-feedback').focus();
    return;
  }
  showFormModule('review');
  if (!validateGenerationInputs()) return;
  if (!await openGenerationChecklist()) return;
  const generationSource = planningSource;
  const generationInput = {
    source: generationSource,
    subjectCode: currentSubjectCode,
    formData: collectFormData(generationSource),
  };
  const nextInput = normalizeGenerationInput({ ...generationInput.formData, subjectCode: generationInput.subjectCode, source: generationSource });
  const forceNewPlan = generationSource === 'ai' && !$('#regeneration-options').classList.contains('hidden')
    && $('[name="regeneration-plan-mode"]:checked')?.value === 'replace';
  const examsChanged = JSON.stringify(schoolExamsFromNotes(reportGenerationBaseline?.teacherNotes)) !== JSON.stringify(schoolExamsFromNotes(nextInput.teacherNotes));
  let action = getGenerationAction(reportGenerationBaseline, nextInput, { forceNewPlan:forceNewPlan || (generationSource === 'ai' && examsChanged) });
  if (generationSource === 'upload' && !sameCoursePlan(currentReportData?.coursePlan, generationInput.formData.lockedCoursePlan)) action = 'new-plan';
  if (action === 'reuse' && currentReportData && !isQuickPreview) {
    const conclusion = $('#parent-conclusion').value.trim();
    const conclusionChanged = conclusion && conclusion !== currentReportData.overview;
    if (conclusionChanged) currentReportData.overview = conclusion;
    editingReportSource = false;
    changeView('report');
    setReportDisplayMode('workspace');
    renderReport(currentReportData);
    if (conclusionChanged) await saveReport({ automatic: true });
    else document.querySelector('#report-view .eyebrow').textContent = '输入未变化 · 已保留当前报告与人工修改';
    return;
  }
  if (action === 'summary-only' && generationSource === 'ai' && currentReportData && !isQuickPreview) {
    generationInput.preserveCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  }
  setGenerationControlsLocked(true, generationSource);
  button.disabled = true;
  notice.classList.remove('error', 'workflow-error');
  notice.textContent = '';
  showGenerationProgress('正在准备报告', generationSource === 'upload'
    ? '使用已确认的课程规划，整理试听反馈。'
    : '正在检查是否已有相同的报告。');
  try {
    if (!forceNewPlan && !generationInput.preserveCoursePlan && !editingReportSource && !$('#parent-conclusion').value.trim()) {
      let existing = {};
      try {
        existing = await requestGeneratedJson('/api/reports/reuse', {
          ...nextInput,
          ...(generationSource === 'upload' ? { lockedCoursePlan: generationInput.formData.lockedCoursePlan } : {}),
        });
      } catch (error) {
        if ([401, 403].includes(error.status) || ['UNAUTHORIZED', 'FORBIDDEN'].includes(error.message)) throw error;
        console.warn('report-reuse-check-unavailable', requestFailureMetadata(error, 'reuse-check'));
        showGenerationProgress('正在生成新报告', '暂时无法检查历史结果，继续使用本次填写的信息。');
      }
      if (existing.id) {
        try {
          await openHistoricalReport(existing.id);
          pendingRegenerationReportId = null;
          document.querySelector('#report-view .eyebrow').textContent = '输入未变化 · 已打开之前保存的报告';
          return;
        } catch (error) {
          if (!error.requestPath?.startsWith('/api/reports?') || [401, 403].includes(error.status)) throw error;
          console.warn('report-reuse-open-unavailable', requestFailureMetadata(error, 'reuse-open'));
          showGenerationProgress('正在生成新报告', '暂时无法读取历史报告，继续使用本次填写的信息。');
        }
      }
    }
    if (generationInput.preserveCoursePlan) showGenerationProgress('正在更新试听总结', '沿用当前课程规划。');
    const report = await generateAiReport(generationInput);
    showGenerationProgress('正在排版并保存报告', '排版完成后将打开报告工作台。');
    try {
      await presentGeneratedReport(report, generationSource, notice, generationInput);
    } catch (error) {
      error.generationStage = 'render';
      throw error;
    }
  } catch (error) {
    displayGenerationFailure(notice, error, generationInput);
  } finally {
    setGenerationControlsLocked(false);
    button.disabled = false;
    button.textContent = editingReportSource ? '更新报告' : '生成报告';
  }
});
document.querySelectorAll('[data-scenario-sample]').forEach((button) => button.addEventListener('click', () => {
  const scenario = resolvePlanningScenario(button.dataset.scenarioSample);
  $('#planning-scenario').value = scenario;
  $('#teacher-notes').value = getPlanningScenarioSample(scenario, currentSubjectCode);
  scheduleFormDraftSave();
}));
$('#subject-search').addEventListener('focus', (event) => {
  event.target.select();
  renderSubjectOptions(subjectSelectionConfirmed ? '' : event.target.value);
  openSubjectOptions();
});
$('#subject-combobox').addEventListener('click', (event) => {
  if (event.target.closest('[data-subject-code]')) return;
  if (event.target.closest('#subject-toggle')) return;
  renderSubjectOptions(subjectSelectionConfirmed ? '' : $('#subject-search').value);
  openSubjectOptions();
});
$('#subject-search').addEventListener('input', (event) => {
  subjectSelectionConfirmed = false;
  event.target.setCustomValidity('');
  renderSubjectOptions(event.target.value);
  openSubjectOptions();
});
$('#subject-search').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    subjectSelectionConfirmed = true;
    event.target.value = getSubjectShortName(currentSubjectCode);
    event.target.setCustomValidity('');
    closeSubjectOptions();
    event.target.blur();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
  event.preventDefault();
  openSubjectOptions();
  if (event.key === 'ArrowDown' && visibleSubjectCodes.length > 0) activeSubjectOptionIndex = (activeSubjectOptionIndex + 1) % visibleSubjectCodes.length;
  if (event.key === 'ArrowUp' && visibleSubjectCodes.length > 0) activeSubjectOptionIndex = (activeSubjectOptionIndex - 1 + visibleSubjectCodes.length) % visibleSubjectCodes.length;
  if (event.key === 'Enter' && visibleSubjectCodes[activeSubjectOptionIndex]) {
    chooseSubject(visibleSubjectCodes[activeSubjectOptionIndex]);
    return;
  }
  updateActiveSubjectOption();
  document.querySelector(`[data-subject-code="${visibleSubjectCodes[activeSubjectOptionIndex]}"]`)?.scrollIntoView({ block: 'nearest' });
});
$('#subject-toggle').addEventListener('click', () => {
  if ($('#subject-options').classList.contains('hidden')) {
    renderSubjectOptions(subjectSelectionConfirmed ? '' : $('#subject-search').value);
    openSubjectOptions();
    $('#subject-search').focus();
  } else {
    closeSubjectOptions();
  }
});
$('#subject-options').addEventListener('mousedown', (event) => event.preventDefault());
$('#subject-options').addEventListener('click', (event) => {
  const option = event.target.closest('[data-subject-code]');
  if (option) chooseSubject(option.dataset.subjectCode);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('#subject-combobox')) closeSubjectOptions();
});
$('#subject-select').addEventListener('change', onSubjectChange);
$('#subject-select').addEventListener('change', () => {
  if (planningSource !== 'upload') return;
  uploadedCoursePlan = null;
  uploadedCoursePlanConfirmed = false;
  $('#course-plan-upload-review').classList.add('hidden');
  $('#course-plan-upload-review').innerHTML = '';
  $('#course-plan-upload-status').className = 'course-plan-upload-status';
  $('#course-plan-upload-status').textContent = '科目已改变，请重新解析课程规划。';
  setPlanningSource('upload');
});
$('#current-score').addEventListener('input', (event) => event.target.setCustomValidity(''));
$('#target-score').addEventListener('input', (event) => event.target.setCustomValidity(''));
$('#total-hours').addEventListener('input', clearLessonCountValidity);
$('#total-hours').addEventListener('input', updateSatMathHoursSummary);
$('#lesson-count').addEventListener('input', (event) => event.target.setCustomValidity(''));
$('#language-test-type').addEventListener('change', updateLanguageAssessmentFields);
$('#language-score-scale').addEventListener('change', updateLanguageAssessmentFields);
$('#language-overall-score').addEventListener('input', (event) => event.target.setCustomValidity(''));
$('#language-reading-score').addEventListener('input', (event) => event.target.setCustomValidity(''));
$('#sat-math-hours-grid').addEventListener('input', (event) => {
  event.target.setCustomValidity('');
  updateSatMathHoursSummary();
});
$('#planning-focus-options').addEventListener('change', updatePlanningFocusState);
document.querySelectorAll('[name="planning-source"]').forEach((input) => input.addEventListener('change', (event) => {
  if (activeGenerationSource) {
    setPlanningSource(activeGenerationSource);
    return;
  }
  switchPlanningSource(event.target.value);
}));
$('#report-form').addEventListener('input', scheduleFormDraftSave);
$('#report-form').addEventListener('change', scheduleFormDraftSave);
$('#course-plan-file').addEventListener('change', (event) => selectCoursePlanFile(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => $('#course-plan-dropzone').addEventListener(eventName, (event) => {
  event.preventDefault();
  $('#course-plan-dropzone').classList.add('is-dragging');
}));
$('#course-plan-dropzone').addEventListener('dragleave', (event) => {
  if (!$('#course-plan-dropzone').contains(event.relatedTarget)) $('#course-plan-dropzone').classList.remove('is-dragging');
});
$('#course-plan-dropzone').addEventListener('drop', (event) => {
  event.preventDefault();
  $('#course-plan-dropzone').classList.remove('is-dragging');
  selectCoursePlanFile(event.dataTransfer.files[0]);
});
$('#course-plan-upload-review').addEventListener('input', () => {
  if (!uploadedCoursePlanConfirmed) return;
  uploadedCoursePlanConfirmed = false;
  uploadedCoursePlan = null;
  $('#course-plan-upload-status').className = 'course-plan-upload-status';
  $('#course-plan-upload-status').textContent = '规划内容已修改，请重新确认。';
  setPlanningSource('upload');
});
$('#course-plan-upload-review').addEventListener('click', async (event) => {
  if (event.target.dataset.uploadAction === 'reselect') {
    coursePlanParseVersion += 1;
    selectedCoursePlanFile = null;
    $('#course-plan-file').value = '';
    $('#course-plan-upload-panel').classList.remove('is-reviewing');
    $('#course-plan-upload-review').classList.add('hidden');
    $('#course-plan-file').click();
    return;
  }
  if (event.target.dataset.uploadAction !== 'confirm') return;
  try {
    confirmUploadedCoursePlan(collectUploadedCoursePlan());
  } catch (error) {
    $('#course-plan-upload-status').className = 'course-plan-upload-status error';
    $('#course-plan-upload-status').textContent = error.message;
  }
});
$('#generation-checklist-modal').addEventListener('click', (event) => {
  if (event.target.dataset.checklistAction === 'edit') closeGenerationChecklist(false);
  if (event.target.dataset.checklistAction === 'confirm') closeGenerationChecklist(true);
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && generationChecklistResolver) closeGenerationChecklist(false);
});
document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
  pendingRegenerationReportId = null;
  changeView(item.dataset.view);
  if (item.dataset.view === 'history') loadHistoryReports();
}));
$('#history-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-history-id]');
  if (!button) return;
  button.disabled = true;
  button.textContent = '正在打开…';
  try {
    await openHistoricalReport(button.dataset.historyId);
  } catch (error) {
    button.disabled = false;
    button.textContent = '重试打开';
    let notice = $('#history-open-error');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'history-open-error';
      $('#history-list').prepend(notice);
    }
    showWorkflowError(notice, error, 'history');
  }
});
$('#back-edit').addEventListener('click', () => {
  if (isQuickPreview) {
    isQuickPreview = false;
    changeView('new');
    return;
  }
  setReportDisplayMode('workspace', { resetEditors: false });
  window.scrollTo({ top: 0 });
});
async function prepareSourceEdit() {
  if (reportAutoSaveTimer) {
    clearTimeout(reportAutoSaveTimer);
    reportAutoSaveTimer = null;
    if (!await saveReport({ automatic: true })) return;
  }
  pendingRegenerationReportId = currentReportId;
  reportGenerationBaseline = currentReportData?.generationInput || normalizeGenerationInput({
    ...collectFormData(),
    subjectCode: currentSubjectCode,
    source: currentReportData?.planningContext?.source,
  });
  reportGenerationBaseline = {
    ...reportGenerationBaseline,
    totalHours: Number(currentReportData.coursePlan.totalHours),
    lessonCount: currentReportData.coursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0),
  };
  $('[name="regeneration-plan-mode"][value="preserve"]').checked = true;
  editingReportSource = true;
  clearTimeout(formDraftSaveTimer);
  $('#parent-conclusion').value = currentReportData.overview || '';
  showFormModule('feedback');
  const reportSource = currentReportData?.planningContext?.source === 'upload' ? 'upload' : 'ai';
  if (reportSource === 'upload') {
    uploadedCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
    uploadedCoursePlanConfirmed = true;
  }
  setPlanningSource(reportSource);
  if (reportSource === 'upload' && uploadedCoursePlanConfirmed) {
    const lessonCount = uploadedCoursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
    $('#course-plan-upload-status').className = 'course-plan-upload-status success';
    $('#course-plan-upload-status').textContent = `当前报告的课程规划已锁定：${lessonCount} 节，共 ${uploadedCoursePlan.totalHours} 小时。修改试听反馈后可直接重新生成。`;
  }
  $('#generation-notice').classList.remove('error');
  $('#generation-notice').innerHTML = currentReportId
    ? '<strong>重新生成当前报告：</strong>修改下方原始信息后再次生成，系统将更新当前历史报告，不会新增重复记录。'
    : '<strong>重新生成当前报告：</strong>修改下方原始信息后再次生成；生成成功后将保存为一条历史报告。';
  $('#generate-report').textContent = '更新报告';
  return true;
}
function cancelSourceEdit(snapshot) {
  const originalPlan = currentReportData?.coursePlan;
  applySavedFormData(snapshot);
  if (snapshot.planningSource === 'upload' && originalPlan) {
    uploadedCoursePlan = cloneCoursePlan(originalPlan);
    uploadedCoursePlanConfirmed = true;
    setPlanningSource('upload');
  }
  editingReportSource = false;
  pendingRegenerationReportId = null;
}

function getCoursePlanForEditing() {
  return {
    plan: cloneCoursePlan(currentReportData.coursePlan),
    original: originalAiCoursePlan ? cloneCoursePlan(originalAiCoursePlan) : null,
    uploaded: currentReportData.planningContext?.source === 'upload',
  };
}

function commitCoursePlanFromPaper(plan) {
  draftCoursePlan = cloneCoursePlan(plan);
  syncWorkspaceCoursePlan();
  setReportDisplayMode('layout');
}
$('#save-report').addEventListener('click', saveReport);
$('#quick-preview-report').addEventListener('click', () => {
  try {
    openQuickPreview();
  } catch {
    showWorkflowError($('#generation-notice'), new Error('QUICK_PREVIEW_FAILED'), 'preview');
  }
});
async function waitForReportImages() {
  const report = $('#parent-report');
  const isAp = report.classList.contains('ap-report');
  const images = [...report.querySelectorAll('img')].filter((image) => isAp || !image.closest('.ap-only'));
  const results = await Promise.allSettled(images.map((image) => waitForPrintImage(image, () => {
    $('#print-report').textContent = '正在重试加载图片…';
  })));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
}

function switchReportImageSources(mode) {
  const sourceKey = mode === 'print' ? 'printSrc' : 'screenSrc';
  document.querySelectorAll('#parent-report [data-print-src]').forEach((element) => {
    const source = element.dataset[sourceKey];
    if (!source) return;
    if (element.tagName === 'SOURCE') {
      element.srcset = source;
      element.type = element.dataset[mode === 'print' ? 'printType' : 'screenType'];
    } else {
      element.src = source;
    }
  });
}

function renderParentReading(data) {
  const { coursePlan } = data;
  const stages = coursePlan.stages;
  const lessonCount = stages.reduce((total, stage) => total + stage.lessons.length, 0);
  let lessonNumber = 0;
  $('#parent-reading').innerHTML = `
    <nav class="reading-nav" aria-label="报告章节">
      <a href="#reading-summary">试听反馈</a>
      <a href="#reading-plan">课程规划</a>
    </nav>
    <section class="reading-card" id="reading-summary">
      <h2>试听反馈</h2>
      <p>${escapeHtml(data.overview)}</p>
      <h3>优先提升</h3>
      <p>${escapeHtml(data.currentFocus)}</p>
      <p class="reading-totals">${escapeHtml(calculateTotalHours(coursePlan))} 小时 · ${stages.length} 个阶段 · ${lessonCount} 个课次</p>
      <details>
        <summary>查看课堂观察与学习成果</summary>
        <h3>${escapeHtml(data.lessonTitle)}</h3>
        <p>${escapeHtml(data.lessonSummary)}</p>
        <p>${escapeHtml(data.classroomStatus)}</p>
        <p>${escapeHtml(data.strength)}</p>
        <p>${escapeHtml(data.performance)}</p>
        <ul>${data.outcomes.map((outcome) => `<li>${escapeHtml(outcome)}</li>`).join('')}</ul>
      </details>
    </section>
    <section class="reading-card" id="reading-plan">
      <h2>课程规划</h2>
      ${stages.map((stage, index) => `
        <details class="reading-stage">
          <summary><strong>${index + 1}. ${escapeHtml(stage.title)}</strong><span>${stage.lessons.length} 课次 · ${calculateTotalHours({ stages: [stage] })} 小时</span></summary>
          <p>${escapeHtml(stage.description)}</p>
          <ol class="reading-lessons">${stage.lessons.map((lesson) => `
            <li><strong>第 ${++lessonNumber} 课 · ${escapeHtml(lesson.theme)} · ${escapeHtml(lesson.duration)}h</strong>
            ${lesson.goal ? `<p>${escapeHtml(lesson.goal)}</p>` : ''}</li>`).join('')}</ol>
          <aside class="report-stage-recap">${stageRecapHtml(stage)}</aside>
        </details>`).join('')}
    </section>`;
}

const layoutPlanFieldRules = {
  title: { label: '阶段名称', maximum: 100, required: true },
  description: { label: '阶段说明', maximum: 300 },
  theme: { label: '课次主题', maximum: 120, required: true },
  content: { label: '授课内容', maximum: 600 },
  goal: { label: '当课目标', maximum: 180 },
  difficulty: { label: '重难点', maximum: 180 },
  task: { label: '阶段测任务与评分依据', maximum: 120, required: true },
  examValue: { label: '对考试有什么用', maximum: 100, required: false },
  objective: { label: '阶段目标', maximum: 100, required: true },
  target: { label: '计划达标线', maximum: 100, required: true },
  adjustment: { label: '未达标时怎么调整', maximum: 120, required: true },
};
const layoutListFieldRules = {
  outcomes: { label: '本节课收获', maximum: 120, required: true },
  priorityAreas: { label: '后续优先提升', maximum: 80, required: true },
};
let activeLayoutEdit = null;
let editingReportSource = false;

function getLayoutField(path) {
  const [scope, ...parts] = path.split('.');
  const key = parts.at(-1);
  if (scope === 'student') {
    return key === 'name'
      ? { label: '学生姓名', maximum: 30, required: true, control: $('#student-name') }
      : { label: '目标分数', maximum: 10, control: $('#target-score') };
  }
  if (scope === 'summary') {
    const field = parts.length === 1
      ? { ...SUMMARY_FIELD_RULES[key], required: true } : layoutListFieldRules[parts[0]];
    return { ...field, parts };
  }
  const rules = layoutPlanFieldRules[key];
  const required = rules.required || (parts[1] === 'lessons' && currentReportData.planningContext?.source !== 'upload');
  return { ...rules, required, parts: ['coursePlan', 'stages', ...parts] };
}

function configureLayoutFields(enabled) {
  document.querySelectorAll('#parent-report [data-layout-path]').forEach((element) => {
    if (enabled) {
      element.tabIndex = 0;
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', `编辑${getLayoutField(element.dataset.layoutPath).label}`);
    } else {
      ['tabindex', 'role', 'aria-label'].forEach((attribute) => element.removeAttribute(attribute));
    }
  });
}

function findLayoutFieldTarget(report, parts) {
  return parts.slice(0, -1).reduce((target, part) => target[part], report);
}

const layoutEditDialog = $('#layout-edit-dialog');
const compactLayoutEditor = window.matchMedia('(max-width: 720px)');
const reportFrame = window.frameElement;
const editorViewport = reportFrame ? window.parent.visualViewport : window.visualViewport;

function positionLayoutEditor() {
  if (!layoutEditDialog.open || !activeLayoutEdit?.anchor) return;
  const anchor = activeLayoutEdit.anchor.getBoundingClientRect();
  const frame = reportFrame?.getBoundingClientRect();
  const viewportLeft = editorViewport ? editorViewport.offsetLeft - (frame?.left || 0) : 0;
  const viewportTop = editorViewport ? editorViewport.offsetTop - (frame?.top || 0) : 0;
  const left = Math.max(0, viewportLeft);
  const top = Math.max(0, viewportTop);
  const right = Math.min(innerWidth, viewportLeft + (editorViewport?.width || innerWidth));
  const bottom = Math.min(innerHeight, viewportTop + (editorViewport?.height || innerHeight));
  const inset = 12;
  layoutEditDialog.style.setProperty('--editor-width', `${Math.max(0, right - left - inset * 2)}px`);
  layoutEditDialog.style.setProperty('--editor-height', `${Math.max(0, bottom - top - inset * 2)}px`);
  const width = layoutEditDialog.offsetWidth;
  const x = compactLayoutEditor.matches ? (left + right - width) / 2 : anchor.left;
  const y = compactLayoutEditor.matches ? top + inset : anchor.bottom + 8;
  layoutEditDialog.style.left = `${Math.max(left + inset, Math.min(x, right - width - inset))}px`;
  layoutEditDialog.style.top = `${Math.max(top + inset, Math.min(y, bottom - layoutEditDialog.offsetHeight - inset))}px`;
}

function stopTrackingLayoutViewport() {
  editorViewport?.removeEventListener('resize', positionLayoutEditor);
  editorViewport?.removeEventListener('scroll', positionLayoutEditor);
  window.removeEventListener('resize', positionLayoutEditor);
}

function openLayoutEdit(anchor) {
  if (layoutEditDialog.open) return;
  const path = anchor.dataset.layoutPath;
  const field = getLayoutField(path);
  const input = $('#layout-edit-value');
  const value = field.control?.value ?? findLayoutFieldTarget(currentReportData, field.parts)[field.parts.at(-1)];
  activeLayoutEdit = { anchor, field, path, previousTop: anchor.getBoundingClientRect().top };
  $('#layout-edit-title').textContent = field.label;
  $('#layout-edit-error').hidden = true;
  input.value = value || '';
  if (path === 'student.target') input.placeholder = '留空使用科目默认值';
  else input.removeAttribute('placeholder');
  anchor.classList.add('layout-edit-selected');
  document.body.classList.add('layout-edit-open');
  layoutEditDialog.showModal();
  editorViewport?.addEventListener('resize', positionLayoutEditor);
  editorViewport?.addEventListener('scroll', positionLayoutEditor);
  window.addEventListener('resize', positionLayoutEditor);
  positionLayoutEditor();
  input.focus({ preventScroll: true });
  if (compactLayoutEditor.matches) input.setSelectionRange(input.value.length, input.value.length);
  else input.select();
}

$('#parent-report').addEventListener('click', (event) => {
  const anchor = event.target.closest('[data-layout-path]');
  if (anchor && $('#parent-report').classList.contains('layout-edit-mode')) openLayoutEdit(anchor);
});
$('#parent-report').addEventListener('keydown', (event) => {
  const anchor = event.target.closest('[data-layout-path]');
  if (anchor && $('#parent-report').classList.contains('layout-edit-mode') && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    openLayoutEdit(anchor);
  }
});
$('#layout-edit-cancel').addEventListener('click', () => $('#layout-edit-dialog').close());
layoutEditDialog.addEventListener('close', () => {
  stopTrackingLayoutViewport();
  const edit = activeLayoutEdit;
  activeLayoutEdit = null;
  document.body.classList.remove('layout-edit-open');
  if (!edit?.anchor) return;
  edit.anchor.classList.remove('layout-edit-selected');
  edit.anchor.focus({ preventScroll: true });
  window.scrollBy({ top: edit.anchor.getBoundingClientRect().top - edit.previousTop, behavior: 'instant' });
});
$('#layout-edit-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const { anchor, field, path } = activeLayoutEdit;
  const value = $('#layout-edit-value').value.trim();
  const errorText = $('#layout-edit-error');
  let error = value.length > field.maximum ? `${field.label}最多 ${field.maximum} 字。` : '';
  if (field.required && !value) error = `请填写${field.label}。`;
  if (!error && path === 'student.target' && value) {
    const validation = validateSubjectScores(currentSubjectCode, $('#current-score').value, value);
    error = validation.errors.find((item) => item.path === 'targetScore')?.message || '';
  }
  if (error) {
    errorText.textContent = error;
    errorText.hidden = false;
    positionLayoutEditor();
    return;
  }

  const selector = `#parent-report [data-layout-path="${path}"]`;
  const position = [...document.querySelectorAll(selector)].indexOf(anchor);
  const previousReport = currentReportData;
  const previousValue = field.control?.value;
  if (field.control) {
    field.control.value = value;
  } else {
    const nextReport = structuredClone(currentReportData);
    findLayoutFieldTarget(nextReport, field.parts)[field.parts.at(-1)] = value;
    currentReportData = nextReport;
  }
  try {
    renderReport(currentReportData);
    configureLayoutFields(true);
    initializeWorkspaceEditors();
  } catch {
    currentReportData = previousReport;
    if (field.control) field.control.value = previousValue;
    renderReport(currentReportData);
    configureLayoutFields(true);
    activeLayoutEdit.anchor = document.querySelectorAll(selector)[position] || $(selector);
    errorText.textContent = '修改后的报告暂时无法排版，请缩短文字后重试。';
    errorText.hidden = false;
    return;
  }

  const updated = document.querySelectorAll(selector)[position] || $(selector);
  activeLayoutEdit.anchor = updated;
  $('#layout-edit-dialog').close();
  document.querySelector('#report-view .eyebrow').textContent = '版面已编辑 · 未云端保存';
  scheduleReportAutoSave();
});

let teacherReportModule = 'summary';

function selectReportModule(module) {
  document.querySelectorAll('[data-report-tab]').forEach((button) => {
    if (button.dataset.reportTab === module) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

function setReportDisplayMode(mode, { resetEditors = true } = {}) {
  const isPreview = mode !== 'workspace';
  const isReading = mode === 'reading';
  const isLayout = mode === 'layout' && !isQuickPreview;
  const isUploadedPlan = currentReportData?.planningContext?.source === 'upload';
  const wasLayout = $('#parent-report').classList.contains('layout-edit-mode');
  $('#parent-report').classList.toggle('layout-edit-mode', isLayout);
  $('#parent-report').classList.toggle('paper-readonly', mode === 'preview');
  document.body.classList.toggle('editing-report-a4', isLayout || mode === 'preview');
  if (isPreview && currentReportData) renderReport(currentReportData);
  configureLayoutFields(isLayout);
  if (isLayout || wasLayout) switchReportImageSources(isLayout ? 'print' : 'screen');
  if (!isPreview && currentReportData && resetEditors) initializeWorkspaceEditors();
  if (isUploadedPlan) teacherReportModule = 'plan';
  $('[data-report-tab="summary"]').hidden = Boolean(isUploadedPlan) || isQuickPreview;
  $('[data-report-tab="plan"]').hidden = isQuickPreview;
  $('[data-report-tab="sales"]').hidden = isQuickPreview;
  $('[data-report-tab="layout"]').hidden = isQuickPreview;
  selectReportModule(isLayout ? 'layout' : isPreview ? 'parent' : teacherReportModule);
  $('#sales-card').classList.add('hidden');
  $('#report-mode-banner').classList.toggle('hidden', !isPreview);
  $('#print-report').classList.toggle('hidden', isQuickPreview);
  $('#back-edit').classList.toggle('hidden', !isPreview);
  $('#parent-report').classList.toggle('teacher-workspace-mode', !isPreview);
  $('#parent-report').classList.toggle('parent-preview-mode', isPreview);
  $('#parent-report').classList.toggle('hidden', !isPreview || isReading);
  $('#parent-reading').classList.toggle('hidden', !isReading);
  $('#parent-reading').dataset.active = String(isReading);
  if (isReading) renderParentReading(currentReportData);
  $('#teacher-workspace-editor').classList.toggle('hidden', isPreview);
  $('#summary-editor-modal').classList.toggle('hidden', isPreview || teacherReportModule !== 'summary');
  $('#course-plan-modal').classList.toggle('hidden', isPreview || teacherReportModule !== 'plan');
  $('#report-mode-banner').classList.toggle('preview-mode', isPreview);
  $('#report-mode-banner').innerHTML = isLayout
    ? '<div><strong>在 A4 版面上编辑</strong><span>点击带下划线的文字。应用修改后，报告按 PDF 页宽重新排版。</span></div><div class="layout-jumps"><button type="button" class="secondary-btn" data-layout-jump="summary">跳到试听总结</button><button type="button" class="secondary-btn" data-layout-jump="plan">跳到课程规划</button></div>'
    : isReading
    ? '<div><strong>家长版阅读预览</strong></div><button type="button" class="secondary-btn" data-preview-mode="preview">查看完整排版</button>'
    : isPreview
    ? '<div><strong>家长版预览</strong><span>当前展示完整交付版内容，导出的 PDF 将采用相同页面顺序。</span></div><button type="button" class="secondary-btn" data-preview-mode="reading">返回阅读预览</button>'
    : isUploadedPlan
      ? '<div><strong>课程规划调整</strong><span>AI 已完成文件解析，请直接调整阶段、课次、时长和文字，修改会同步到报告。</span></div><span class="report-mode-status">可编辑</span>'
      : '<div><strong>老师工作台</strong><span>请重点核对试听反馈与课程规划，品牌包装页将在家长预览和 PDF 中显示。</span></div><span class="report-mode-status">待老师核对</span>';
  $('#preview-report').textContent = isPreview ? '返回老师工作台' : '预览家长版';
  $('#preview-report').setAttribute('aria-pressed', String(isPreview));
}

$('#report-mode-banner').addEventListener('click', (event) => {
  const jump = event.target.closest('[data-layout-jump]')?.dataset.layoutJump;
  if (jump) {
    $(jump === 'summary' ? '.summary-page' : '.reference-plan-page')?.scrollIntoView({ block: 'start' });
    return;
  }
  const mode = event.target.closest('[data-preview-mode]')?.dataset.previewMode;
  if (!mode) return;
  try {
    setReportDisplayMode(mode);
    $('#report-mode-banner [data-preview-mode]')?.focus();
  } catch (error) {
    error.generationStage = 'render';
    showWorkflowError($('#report-operation-notice'), error, 'generate');
  }
});

$('#preview-report').addEventListener('click', () => {
  const isPreview = $('#parent-report').classList.contains('parent-preview-mode');
  try {
    setReportDisplayMode(isPreview ? 'workspace' : 'reading');
    $('#report-operation-notice').classList.add('hidden');
    $('#report-mode-banner').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    error.generationStage = 'render';
    showWorkflowError($('#report-operation-notice'), error, 'generate');
  }
});

$('#print-report').addEventListener('click', async () => {
  const printButton = $('#print-report');
  const previousButtonText = printButton.textContent;
  const previousMode = $('#parent-report').classList.contains('layout-edit-mode') ? 'layout'
    : !$('#parent-reading').classList.contains('hidden') ? 'reading'
    : $('#parent-report').classList.contains('parent-preview-mode') ? 'preview' : 'workspace';
  let restored = false;
  const restorePrintState = () => {
    if (restored) return;
    restored = true;
    try {
      switchReportImageSources('screen');
      setReportDisplayMode(previousMode, { resetEditors: false });
    } catch {
      $('#parent-report').classList.add('hidden');
      $('#teacher-workspace-editor').classList.remove('hidden');
    } finally {
      printButton.disabled = false;
      printButton.textContent = previousButtonText;
    }
  };
  printButton.disabled = true;
  printButton.textContent = '正在准备 PDF…';
  try {
    $('#report-operation-notice').classList.add('hidden');
    setReportDisplayMode('preview');
    switchReportImageSources('print');
    await waitForReportImages();
    window.addEventListener('afterprint', restorePrintState, { once: true });
    window.print();
  } catch (error) {
    restorePrintState();
    showWorkflowError($('#report-operation-notice'), error, 'export');
  }
});
$('#edit-summary').addEventListener('click', openSummaryEditor);
$('#summary-editor-content').addEventListener('input', (event) => {
  if (event.target.dataset.summaryPath) setSummaryDraftValue(event.target.dataset.summaryPath, event.target.value);
});
$('#summary-editor-modal').addEventListener('click', (event) => {
  const action = event.target.dataset.summaryAction;
  const field = event.target.dataset.summaryField;
  if (action === 'add') {
    draftSummary[field].push('');
    syncWorkspaceSummary();
    renderSummaryEditor();
    $(`[data-summary-path="${field}.${draftSummary[field].length - 1}"]`)?.focus();
  }
  if (action === 'delete') {
    draftSummary[field].splice(Number(event.target.dataset.summaryIndex), 1);
    syncWorkspaceSummary();
    renderSummaryEditor();
  }
  if (action === 'cancel') cancelSummaryEditor();
  if (action === 'apply') applySummaryEdits();
});
$('#edit-course-plan').addEventListener('click', openPlanEditor);
$('#plan-editor-content').addEventListener('input', (event) => {
  if (event.target.dataset.path) setDraftValue(event.target.dataset.path, event.target.value);
});
$('#plan-editor-content').addEventListener('change', (event) => {
  if (event.target.dataset.path) setDraftValue(event.target.dataset.path, event.target.value);
  if (event.target.dataset.moveLesson) {
    const [stageIndex, lessonIndex] = event.target.dataset.moveLesson.split('.').map(Number);
    const targetStageIndex = Number(event.target.value);
    if (targetStageIndex !== stageIndex && draftCoursePlan.stages[stageIndex].lessons.length === 1 && !window.confirm('移动后原阶段将没有课时，应用前必须补充课时。仍要移动吗？')) {
      event.target.value = String(stageIndex);
      return;
    }
    const [lesson] = draftCoursePlan.stages[stageIndex].lessons.splice(lessonIndex, 1);
    draftCoursePlan.stages[targetStageIndex].lessons.push(lesson);
    markEditorDirty();
    renderPlanEditor();
  }
});
$('#plan-editor-content').addEventListener('click', (event) => {
  const stageAction = event.target.dataset.stageAction;
  const lessonAction = event.target.dataset.lessonAction;
  if (stageAction) {
    const stageIndex = Number(event.target.dataset.stageIndex);
    const stage = draftCoursePlan.stages[stageIndex];
    if (stageAction === 'collapse') {
      const wasCollapsed = collapsedStages.has(stage);
      collapsedStages = new WeakSet(draftCoursePlan.stages.filter((item) => !wasCollapsed || item !== stage));
      renderPlanEditor();
      $(`[data-stage-editor="${stageIndex}"] [data-stage-action="collapse"]`)?.focus();
      return;
    }
    if (stageAction === 'up' || stageAction === 'down') draftCoursePlan.stages = moveItem(draftCoursePlan.stages, stageIndex, stageIndex + (stageAction === 'up' ? -1 : 1));
    if (stageAction === 'delete') {
      if (!window.confirm(`确定删除该阶段及其中 ${stage.lessons.length} 个课次吗？`)) return;
      draftCoursePlan.stages.splice(stageIndex, 1);
    }
    markEditorDirty();
    renderPlanEditor();
  }
  if (lessonAction) {
    const stageIndex = Number(event.target.dataset.stageIndex);
    const lessonIndex = Number(event.target.dataset.lessonIndex);
    const lessons = draftCoursePlan.stages[stageIndex].lessons;
    if (lessonAction === 'toggle') {
      const lesson = lessons[lessonIndex];
      const open = !expandedLessons.has(lesson);
      if (open) expandedLessons.add(lesson);
      else expandedLessons.delete(lesson);
      event.target.setAttribute('aria-expanded', String(open));
      const card = event.target.closest('.plan-lesson-editor');
      card.classList.toggle('is-expanded', open);
      card.querySelector('.plan-lesson-fields').hidden = !open;
      return;
    }
    if (lessonAction === 'up' || lessonAction === 'down') draftCoursePlan.stages[stageIndex].lessons = moveItem(lessons, lessonIndex, lessonIndex + (lessonAction === 'up' ? -1 : 1));
    if (lessonAction === 'copy') lessons.splice(lessonIndex + 1, 0, cloneCoursePlan(lessons[lessonIndex]));
    if (lessonAction === 'delete') {
      if (!window.confirm('确定删除该课次吗？')) return;
      lessons.splice(lessonIndex, 1);
    }
    markEditorDirty();
    renderPlanEditor();
  }
  if (event.target.dataset.addLesson !== undefined) {
    const stageIndex = Number(event.target.dataset.addLesson);
    const lesson = createLesson();
    draftCoursePlan.stages[stageIndex].lessons.push(lesson);
    expandedLessons.add(lesson);
    markEditorDirty();
    renderPlanEditor();
    const theme = $(`[data-path="stages.${stageIndex}.lessons.${draftCoursePlan.stages[stageIndex].lessons.length - 1}.theme"]`);
    theme?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    theme?.focus();
  }
});
$('#workspace-stage-shortcuts').addEventListener('click', (event) => {
  const stageIndex = Number(event.target.dataset.workspaceStage);
  if (!Number.isInteger(stageIndex) || !draftCoursePlan?.stages?.[stageIndex]) return;
  collapsedStages = new WeakSet(draftCoursePlan.stages.filter((_, index) => index !== stageIndex));
  renderPlanEditor();
  $(`[data-stage-editor="${stageIndex}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
window.addEventListener('beforeunload', (event) => {
  if (!isCoursePlanDirty() && !isSummaryEditorDirty()) return;
  event.preventDefault();
  event.returnValue = '';
});
$('#course-plan-modal').addEventListener('click', (event) => {
  const action = event.target.dataset.editorAction;
  if (action === 'add-stage') {
    const stage = createStage();
    collapsedStages = new WeakSet(draftCoursePlan.stages);
    draftCoursePlan.stages.push(stage);
    expandedLessons.add(stage.lessons[0]);
    markEditorDirty();
    renderPlanEditor();
    const stageIndex = draftCoursePlan.stages.length - 1;
    const theme = $(`[data-path="stages.${stageIndex}.lessons.0.theme"]`);
    theme?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    theme?.focus();
  }
  if (action === 'cancel') cancelPlanEditor();
  if (action === 'apply') applyCoursePlan();
  if (action === 'restore') restoreOriginalCoursePlan();
});
$('.report-module-nav').addEventListener('click', (event) => {
  const module = event.target.closest('[data-report-tab]')?.dataset.reportTab;
  if (!module || module === $('[data-report-tab][aria-current]')?.dataset.reportTab) return;
  try {
    if (module === 'parent' || module === 'layout') {
      setReportDisplayMode(module === 'layout' ? 'layout' : 'reading', { resetEditors: false });
    } else if (module === 'sales') {
      $('#parent-report').classList.remove('layout-edit-mode');
      document.body.classList.remove('editing-report-a4');
      selectReportModule(module);
      ['#parent-report', '#parent-reading', '#teacher-workspace-editor', '#report-mode-banner'].forEach((selector) => $(selector).classList.add('hidden'));
      $('#sales-card').classList.remove('hidden');
      $('#print-report').classList.add('hidden');
      $('#back-edit').classList.add('hidden');
    } else {
      teacherReportModule = module;
      setReportDisplayMode('workspace', { resetEditors: false });
    }
    if (module === 'layout') $('.summary-page')?.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  } catch (error) {
    error.generationStage = 'render';
    showWorkflowError($('#report-operation-notice'), error, 'generate');
  }
});
$('#copy-script').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#sales-script').textContent);
    $('#copy-script').textContent = '已复制';
    setTimeout(() => { $('#copy-script').textContent = '复制话术'; }, 1200);
  } catch {
    showWorkflowError($('#report-operation-notice'), new Error('COPY_FAILED'), 'copy');
  }
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-workflow-action]');
  if (!button) return;
  const action = button.dataset.workflowAction;
  const notice = button.closest('.workflow-error, .notice') || $('#generation-notice');
  try {
    if (action === 'generate') $('#report-form').requestSubmit();
    if (action === 'render') {
      renderReport(currentReportData);
      if (editingReportSource) {
        editingReportSource = false;
        setReportDisplayMode('workspace');
      }
      notice.classList.add('hidden');
    }
    if (action === 'save') {
      const saved = await saveReport();
      if (saved && $('#new-view').classList.contains('active')) {
        notice.classList.remove('error', 'workflow-error');
        notice.innerHTML = '<strong>报告已保存。</strong>请点击左侧“历史报告”重新打开，无需再次生成。';
      }
    }
    if (action === 'upload') await parseUploadedCoursePlan();
    if (action === 'history') { changeView('history'); await loadHistoryReports(); }
    if (action === 'profile') await loadTeacherProfile();
    if (action === 'export') $('#print-report').click();
    if (action === 'quick-preview') $('#quick-preview-report').click();
    if (action === 'edit-plan') $('#edit-course-plan').click();
    if (action === 'edit-summary') $('#edit-summary').click();
    if (action === 'input') {
      changeView('new');
      if (button.dataset.workflowOperation === 'save') {
        $('#generation-notice').innerHTML = '<strong>请修改刚才提示的填写项。</strong>完成后保存当前报告，无需重新生成。<button type="button" class="secondary-btn" data-workflow-action="save">保存当前报告</button>';
      }
      const target = $(button.dataset.workflowFocus || '#student-name');
      revealFormField(target);
      (target?.matches('input, select, textarea') ? target : target?.querySelector('input, select, textarea'))?.focus();
    }
  } catch (error) {
    showWorkflowError(notice || $('#generation-notice'), error, action === 'export' ? 'export' : action === 'history' ? 'history' : 'generate');
  }
});
const defaultCoursePlan = getDefaultCoursePlan();

function initializeApp() {
  renderSatMathHoursInputs();
  populateSubjectSelect();
  const initialData = collectFormData();
  currentReportData = buildFallbackReport(currentSubjectCode, initialData);
  originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  mountTeacherWorkspaceEditors();
  renderReport(currentReportData);
  initializeWorkspaceEditors();
  setReportDisplayMode('workspace');
  loadTeacherProfile().then(async () => {
    if (formHasUserInput) {
      saveFormDraft();
      return;
    }
    restoreGenerationRecovery();
    currentReportData = buildFallbackReport(currentSubjectCode, collectFormData());
    originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
    renderReport(currentReportData);
  });
}

mountPaperWorkspace({
  setReportDisplayMode, prepareSourceEdit, cancelSourceEdit, collectFormDraft,
  getCoursePlan: getCoursePlanForEditing, commitCoursePlan: commitCoursePlanFromPaper,
  isQuickPreview: () => isQuickPreview,
  reportError: (error) => showWorkflowError($('#report-operation-notice'), error, 'generate'),
});
initializeApp();
