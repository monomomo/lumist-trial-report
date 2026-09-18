import { ALLOWED_DURATIONS, cloneCoursePlan, calculateTotalHours, validateCoursePlan, moveItem, moveLesson, rebalanceFinalPage, createStage, createLesson } from './course-plan-utils.js';
import { SUBJECT_CODES, SUBJECT_CATALOG, resolveSubject, validateSubjectScores } from './catalog.js';
import { createSubjectViewModel, normalizeTeacherProfile, buildFallbackReport, resolveTargetScore } from './report-domain.js';
import { SUMMARY_FIELD_RULES, cloneReportSummary, validateReportSummary } from './summary-editor-utils.js';
import { buildGenerationChecklist, buildReportQualityChecks, humanizeReportWarning } from './report-quality-utils.js';
import { PLANNING_SCENARIOS, MAX_PLANNING_FOCUS_AREAS, getPlanningFocusOptions, normalizePlanningFocusAreas, resolvePlanningScenario, getLessonCountRange } from './planning-context.js';

const $ = (selector) => document.querySelector(selector);
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
const UPLOAD_REPORT_NOTE = '老师已上传并确认完整课程规划，本报告仅对老师提供的原规划进行结构化整理与排版。';

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

function applySubjectSelection(code) {
  const selectedFocusAreas = getSelectedPlanningFocusAreas();
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
  renderPlanningFocusOptions(selectedFocusAreas);
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
    const response = await fetch('/api/me');
    if (!response.ok) return;
    const data = await response.json();
    teacherProfile = normalizeTeacherProfile(data);
    if (teacherProfile) {
      renderSidebarTeacher();
      renderTeacherProfile();
      setText('#info-teacher', getActiveTeacherProfile().displayName);
    }
  } catch {
    // 静默忽略，保持默认占位
  }
}

function renderSidebarTeacher() {
  if (!teacherProfile) return;
  const footer = $('#sidebar-teacher');
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
  const learningSection = existingContinuation?.querySelector('.summary-learning-section') || page.querySelector('.summary-learning-section');
  if (existingContinuation) {
    pageContent.appendChild(learningSection);
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
  continuation.innerHTML = '<div class="summary-page-content"><img class="report-brand-header" src="assets/lumist-report-header-black.png" alt="路觅教育" /><div class="page-kicker">02 / 试听课总结 · 续</div><h2>试听反馈与学习成果</h2></div>';
  continuation.querySelector('.summary-page-content').appendChild(learningSection);
  page.after(continuation);
  if (!pageFits(page)) page.classList.add('summary-page-condensed');
  if (!pageFits(continuation)) continuation.classList.add('summary-page-condensed');
  summaryPageCount = 2;
  measurementHost.remove();
}

function updateFollowingPageNumbers(planPageCount) {
  const teacherNumber = summaryPageCount + planPageCount + 1;
  document.querySelector('.teacher-page .page-kicker').textContent = `${String(teacherNumber).padStart(2, '0')} / 任课教师`;
}

function renderCoursePlan(coursePlan) {
  const isUploadedPlan = currentReportData?.planningContext?.source === 'upload';
  const teacherPage = document.querySelector('.teacher-page');
  const measurementHost = document.createElement('div');
  measurementHost.className = 'plan-measurement-host';
  document.body.appendChild(measurementHost);
  const pages = [];
  let lessonIndex = 0;
  let oversizedLesson = null;

  const createPage = () => {
    const page = document.createElement('article');
    page.className = 'report-page hour-plan reference-plan-page';
    const introduction = isUploadedPlan ? '严格按照老师确认的课程规划排版。' : '依据学生试听表现与目标动态编排，相邻阶段将按页面容量连续呈现。';
    const note = isUploadedPlan || !coursePlan.rationale ? '' : `<div class="plan-note plan-note-reserve"><strong>动态调整原则：</strong>${escapeHtml(coursePlan.rationale)} 课时可按 0.5h、1h、1.5h 或 2h 灵活调整。</div>`;
    const planTitleHtml = `<div class="plan-page-body"><img class="report-brand-header" src="assets/lumist-report-header-black.png" alt="路觅教育" /><div class="page-kicker"></div><div class="plan-page-heading"><div><h2>${escapeHtml(createSubjectViewModel(currentSubjectCode).displayName)}个性化课程规划</h2><p>${introduction}</p></div><div class="plan-total-hours"><span>${isUploadedPlan ? '规划总课时' : '建议总课时'}</span><b>${escapeHtml(coursePlan.totalHours)}h</b></div></div><table><thead><tr><th>课次</th><th>时长</th><th>授课内容、目标与重难点</th></tr></thead><tbody></tbody></table>${note}</div>`;
    page.innerHTML = planTitleHtml;
    measurementHost.appendChild(page);
    pages.push(page);
    return page;
  };

  const createStageLabel = (stage, continued) => {
    const label = document.createElement('div');
    label.className = 'plan-stage-inline';
    label.innerHTML = `<strong>${escapeHtml(stage.title)}${continued ? ' · 续' : ''}</strong>${stage.description ? `<span>${escapeHtml(stage.description)}</span>` : ''}`;
    return label;
  };

  const createLessonRow = (lesson, stageIndex, stageLessonIndex) => {
    lessonIndex += 1;
    const row = document.createElement('tr');
    row.className = 'plan-lesson-row';
    row.dataset.stageIndex = String(stageIndex);
    row.dataset.stageLessonIndex = String(stageLessonIndex);
    const details = [
      lesson.goal ? `<p><span>目标：</span>${escapeHtml(lesson.goal)}</p>` : '',
      lesson.content ? `<p><span>内容：</span>${escapeHtml(lesson.content)}</p>` : '',
      lesson.difficulty ? `<p><span>重难点：</span>${escapeHtml(lesson.difficulty)}</p>` : ''
    ].join('');
    row.innerHTML = `<td class="plan-sequence-cell"><b>${String(lessonIndex).padStart(2, '0')}</b><span>课次</span></td><td class="plan-duration-cell">${escapeHtml(lesson.duration)}h</td><td class="plan-detail-cell"><b>${escapeHtml(lesson.theme)}</b>${details}</td>`;
    return row;
  };

  const pageOverflows = (page) => {
    const body = page.querySelector('.plan-page-body');
    return body.scrollHeight > PLAN_PAGE_AVAILABLE_HEIGHT;
  };

  const fitSingleLessonPage = (page) => {
    for (const className of ['plan-page-compact', 'plan-page-condensed']) {
      page.classList.add(className);
      if (!pageOverflows(page)) return true;
    }
    return true;
  };

  const rebuildPageRows = (page, lessonRows) => {
    const tableBody = page.querySelector('tbody');
    tableBody.innerHTML = '';
    let previousStageIndex = -1;
    lessonRows.forEach((row) => {
      const stageIndex = Number(row.dataset.stageIndex);
      row.querySelector('.plan-stage-inline')?.remove();
      if (stageIndex !== previousStageIndex) row.querySelector('.plan-detail-cell').prepend(createStageLabel(coursePlan.stages[stageIndex], Number(row.dataset.stageLessonIndex) > 0));
      tableBody.appendChild(row);
      previousStageIndex = stageIndex;
    });
  };

  let currentPage = createPage();
  coursePlan.stages.forEach((stage, stageIndex) => {
    stage.lessons.forEach((lesson, stageLessonIndex) => {
      if (oversizedLesson) return;
      const row = createLessonRow(lesson, stageIndex, stageLessonIndex);
      const rows = Array.from(currentPage.querySelectorAll('.plan-lesson-row'));
      rebuildPageRows(currentPage, [...rows, row]);
      if (!pageOverflows(currentPage)) return;
      if (!rows.length) {
        if (!fitSingleLessonPage(currentPage)) oversizedLesson = { stageIndex, stageLessonIndex };
        return;
      }
      rebuildPageRows(currentPage, rows);
      currentPage = createPage();
      rebuildPageRows(currentPage, [row]);
      if (pageOverflows(currentPage) && !fitSingleLessonPage(currentPage)) oversizedLesson = { stageIndex, stageLessonIndex };
    });
  });

  if (!oversizedLesson && pages.length > 1) {
    const groups = pages.map((page) => Array.from(page.querySelectorAll('.plan-lesson-row')));
    const balanced = rebalanceFinalPage(groups, (pageIndex, rows) => {
      rebuildPageRows(pages[pageIndex], rows);
      return !pageOverflows(pages[pageIndex]);
    });
    balanced.forEach((rows, pageIndex) => rebuildPageRows(pages[pageIndex], rows));
  }

  if (!oversizedLesson) {
    pages.slice(0, -1).forEach((page) => page.querySelector('.plan-note-reserve')?.remove());
    pages.at(-1).querySelector('.plan-note-reserve')?.classList.remove('plan-note-reserve');
  }

  if (oversizedLesson) {
    measurementHost.remove();
    return { oversizedLesson };
  }
  pages.forEach((page, pageIndex) => {
    const pageNumber = String(pageIndex + summaryPageCount + 1).padStart(2, '0');
    page.querySelector('.page-kicker').textContent = `${pageNumber} / 详细课程规划 · ${String(pageIndex + 1).padStart(2, '0')}`;
  });
  document.querySelectorAll('.reference-plan-page').forEach((page) => page.remove());
  pages.forEach((page) => teacherPage.before(page));
  updateFollowingPageNumbers(pages.length);
  measurementHost.remove();
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
  setText('#overview-text', data.overview);
  setText('#classroom-text', data.classroomStatus);
  setText('#strength-text', data.strength);
  setText('#priority-text', data.currentFocus);
  setText('#lesson-title', data.lessonTitle);
  setText('#lesson-text', data.lessonSummary);
  setText('#performance-text', data.performance);
  $('#outcomes-list').innerHTML = data.outcomes.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  $('#needs-list').innerHTML = data.priorityAreas.map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  setText('#sales-positive', data.salesFollowUp.positive);
  setText('#sales-urgent', data.salesFollowUp.urgent);
  setText('#sales-angle', data.salesFollowUp.angle);
  setText('#sales-script', data.salesFollowUp.script);
  renderTeacherProfile();
  layoutSummaryPages();
  renderCoursePlan(data.coursePlan);
  layoutTeacherProfilePages();
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
  qualityNotice.innerHTML = `<div class="quality-notice-header"><strong>报告质量检查</strong><span class="quality-notice-summary">${checks.length - warnings.length} 项通过${warnings.length ? ` · ${warnings.length} 项建议检查` : ''}</span></div><ul class="quality-check-list">${checks.map((check) => `<li class="${check.status}"><span class="quality-check-icon">${check.status === 'passed' ? '✓' : '!'}</span><span class="quality-check-label">${escapeHtml(check.label)}</span><span class="quality-check-message">${escapeHtml(check.message)}</span></li>`).join('')}</ul>`;
}

function setQuickPreviewActions(enabled) {
  ['#save-report', '#edit-summary', '#edit-course-plan', '#print-report'].forEach((selector) => $(selector).classList.toggle('hidden', enabled));
  $('#back-edit').textContent = enabled ? '返回继续填写' : '返回老师工作台';
}

function openQuickPreview() {
  const formData = collectFormData();
  currentReportData = buildFallbackReport(currentSubjectCode, formData);
  currentReportId = null;
  historicalTeacherProfile = null;
  originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  isQuickPreview = true;
  renderReport(currentReportData);
  setQuickPreviewActions(true);
  setReportDisplayMode('preview');
  changeView('report');
  document.querySelector('#report-view .eyebrow').textContent = '快速预览 · 未生成、未保存';
  $('#report-mode-banner').innerHTML = '<div><strong>报告样式预览</strong><span>当前内容为即时示例，不会发送给 AI、不会保存，也不能导出。正式生成后可逐段编辑并导出 PDF。</span></div><span class="report-mode-status">仅预览</span>';
}

function changeView(id) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${id}-view`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === id));
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
  textarea.rows = field === 'overview' || field === 'lessonSummary' || field === 'performance' ? 5 : 3;
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
  content.innerHTML = '';
  const summary = document.createElement('section');
  summary.className = 'summary-editor-section';
  summary.innerHTML = '<header><span>01</span><div><b>试听课堂观察与学习建议</b><p>集中核对课堂表现、本节课内容、学习收获和后续安排</p></div></header>';
  const observationFields = document.createElement('div');
  observationFields.className = 'summary-editor-fields';
  ['lessonTitle', 'overview', 'classroomStatus', 'strength', 'currentFocus', 'lessonSummary', 'performance'].forEach((field) => observationFields.appendChild(createSummaryEditorField(field, SUMMARY_FIELD_RULES[field])));
  summary.append(observationFields, createSummaryListEditor('outcomes', '本节课收获', 5), createSummaryListEditor('priorityAreas', '后续需要优先提升的内容', 6));
  content.append(summary);
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
  content.innerHTML = '';
  draftCoursePlan.stages.forEach((stage, stageIndex) => {
    const section = document.createElement('section');
    section.className = 'plan-stage-editor';
    section.tabIndex = -1;
    section.dataset.stageEditor = String(stageIndex);
    const header = document.createElement('div');
    header.className = 'plan-stage-editor-header';
    header.innerHTML = `<div><span>阶段 ${String(stageIndex + 1).padStart(2, '0')}</span><b>${escapeHtml(stage.title || '未命名阶段')}</b></div><div class="editor-icon-actions"><button type="button" data-stage-action="up" data-stage-index="${stageIndex}" ${stageIndex === 0 ? 'disabled' : ''}>上移</button><button type="button" data-stage-action="down" data-stage-index="${stageIndex}" ${stageIndex === draftCoursePlan.stages.length - 1 ? 'disabled' : ''}>下移</button><button type="button" data-stage-action="collapse" data-stage-index="${stageIndex}">${collapsedStages.has(stage) ? '展开' : '折叠'}</button><button type="button" data-stage-action="delete" data-stage-index="${stageIndex}" ${draftCoursePlan.stages.length === 1 ? 'disabled' : ''}>删除</button></div>`;
    section.appendChild(header);
    if (!collapsedStages.has(stage)) {
      const fields = document.createElement('div');
      fields.className = 'plan-stage-fields';
      fields.append(createEditorField('阶段名称', stage.title, `stages.${stageIndex}.title`), createEditorField('阶段说明', stage.description, `stages.${stageIndex}.description`, true));
      section.appendChild(fields);
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
  shortcuts.innerHTML = `<span>课程阶段</span>${draftCoursePlan.stages.map((stage, index) => `<button type="button" data-workspace-stage="${index}">阶段 ${index + 1} · ${escapeHtml(stage.title || '未命名阶段')}</button>`).join('')}`;
}

function createLessonEditor(lesson, stageIndex, lessonIndex) {
  const card = document.createElement('article');
  card.className = 'plan-lesson-editor';
  const globalIndex = draftCoursePlan.stages.slice(0, stageIndex).reduce((total, stage) => total + stage.lessons.length, 0) + lessonIndex + 1;
  card.innerHTML = `<header><b>课次 ${String(globalIndex).padStart(2, '0')}</b><div class="editor-icon-actions"><button type="button" data-lesson-action="up" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}" ${lessonIndex === 0 ? 'disabled' : ''}>上移</button><button type="button" data-lesson-action="down" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}" ${lessonIndex === draftCoursePlan.stages[stageIndex].lessons.length - 1 ? 'disabled' : ''}>下移</button><button type="button" data-lesson-action="copy" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}">复制</button><button type="button" data-lesson-action="delete" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}">删除</button></div></header>`;
  const grid = document.createElement('div');
  grid.className = 'plan-lesson-fields';
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
  if (parts.at(-1) === 'title') {
    const stageIndex = Number(parts[1]);
    const title = value.trim() || '未命名阶段';
    $(`[data-scroll-stage="${stageIndex}"]`).textContent = `${stageIndex + 1}. ${title}`;
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
  renderSummaryEditor();
  renderPlanEditor();
}

function openPlanEditor() {
  draftCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  editorBaseline = JSON.stringify(draftCoursePlan);
  collapsedStages = new WeakSet(draftCoursePlan.stages.slice(1));
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
    const stage = draftCoursePlan.stages[Number(error.path.split('.')[1])];
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
    if (field) field.insertAdjacentElement('afterend', reason);
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
  reportAutoSaveTimer = setTimeout(() => { saveReport({ automatic: true }); }, 900);
}

async function saveReport({ automatic = false } = {}) {
  if (!currentReportData) return false;
  const reportStatus = document.querySelector('#report-view .eyebrow');
  const saveButton = $('#save-report');
  const lessonCount = currentReportData.coursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
  currentReportData.planningContext = buildCurrentPlanningContext(lessonCount);
  const { coursePlan, salesFollowUp, ...reportData } = currentReportData;
  const payload = {
    id: currentReportId,
    studentName: $('#student-name').value.trim(),
    currentScore: $('#current-score').value.trim(),
    targetScore: resolveTargetScore(currentSubjectCode, $('#target-score').value),
    examDate: getSelectedExamDate(),
    teacherNotes: planningSource === 'upload' ? UPLOAD_REPORT_NOTE : $('#teacher-notes').value.trim(),
    subject: createSubjectViewModel(currentSubjectCode).displayName,
    reportData,
    coursePlan,
    salesFollowUp,
  };
  reportStatus.textContent = automatic ? '正在自动保存报告' : '正在保存报告';
  saveButton.disabled = true;
  saveButton.textContent = '保存中…';
  try {
    const response = await fetch('/api/reports', {
      method: currentReportId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'REPORT_SAVE_FAILED');
    if (result.id) currentReportId = result.id;
    reportStatus.textContent = result.saved ? (automatic ? '报告已自动保存' : '报告已生成 · 已保存') : '报告未保存 · 当前为本地演示';
    saveButton.textContent = currentReportId ? '更新历史报告' : '保存报告';
    return Boolean(result.saved);
  } catch {
    reportStatus.textContent = automatic ? '自动保存失败 · 请手动保存' : '报告保存失败 · 请稍后重试';
    saveButton.textContent = '重新保存';
    return false;
  } finally {
    saveButton.disabled = false;
  }
}

function collectFormData() {
  return {
    studentName: $('#student-name').value.trim(),
    currentScore: $('#current-score').value.trim(),
    targetScore: resolveTargetScore(currentSubjectCode, $('#target-score').value),
    examDate: getSelectedExamDate(),
    totalHours: $('#total-hours').value,
    lessonCount: $('#lesson-count').value,
    planningScenario: resolvePlanningScenario($('#planning-scenario').value),
    planningFocusAreas: getSelectedPlanningFocusAreas(),
    includeExamTraining: planningSource === 'ai' && $('#include-exam-training').checked,
    teacherNotes: planningSource === 'upload' ? UPLOAD_REPORT_NOTE : $('#teacher-notes').value.trim(),
    ...(planningSource === 'upload' && uploadedCoursePlanConfirmed ? { lockedCoursePlan: uploadedCoursePlan } : {}),
  };
}

function setPlanningSource(value) {
  planningSource = value === 'upload' ? 'upload' : 'ai';
  document.querySelectorAll('[name="planning-source"]').forEach((input) => { input.checked = input.value === planningSource; });
  $('#course-plan-upload-panel').classList.toggle('hidden', planningSource !== 'upload');
  $('#ai-generation-fields').classList.toggle('hidden', planningSource === 'upload');
  document.querySelectorAll('.ai-workflow-only').forEach((element) => element.classList.toggle('hidden', planningSource === 'upload'));
  $('#teacher-notes').required = planningSource === 'ai';
  $('#planning-scenario').required = planningSource === 'ai';
  $('#total-hours').required = planningSource === 'ai';
  $('#lesson-count').required = planningSource === 'ai';
  $('#total-hours').readOnly = planningSource === 'upload' && uploadedCoursePlanConfirmed;
  $('#lesson-count').readOnly = planningSource === 'upload' && uploadedCoursePlanConfirmed;
  $('#include-exam-training').disabled = planningSource === 'upload';
  $('#generation-notice').innerHTML = planningSource === 'upload'
    ? '<strong>上传模式：</strong>无需填写试听记录。系统只整理文件格式，课程规划严格使用老师确认的内容。'
    : '<strong>生成原则：</strong>总课时由老师决定，AI 仅负责规划内容与课时分配。';
  $('#generate-report').innerHTML = planningSource === 'upload' ? '生成课程规划报告 <span>→</span>' : 'AI 生成个性化报告 <span>→</span>';
  $('#generate-report').classList.toggle('hidden', planningSource === 'upload');
  $('#quick-preview-report').classList.toggle('hidden', planningSource === 'upload');
  $('#generation-notice').classList.toggle('hidden', planningSource === 'upload');
  $('#student-info-hint').textContent = planningSource === 'upload'
    ? '填写报告封面信息，课时和课次将从上传文件中自动读取。'
    : '只填写 AI 无法从课堂描述中可靠获取的信息。';
  $('#workflow-steps').innerHTML = planningSource === 'upload'
    ? '<li><b>上传已有规划</b><span>支持 DOCX、XLSX 和文本型 PDF</span></li><li><b>核对解析结果</b><span>确认课次、顺序、时长与文字</span></li><li><b>导出并交付</b><span>生成完整品牌报告与 PDF</span></li>'
    : '<li><b>自然语言记录</b><span>无需填写冗长表单</span></li><li><b>确认 AI 整理结果</b><span>可逐段编辑，避免虚构</span></li><li><b>导出并交付</b><span>家长报告与销售卡分开</span></li>';
  $('#workflow-title').textContent = planningSource === 'upload' ? '上传模式' : '本版功能';
  $('#workflow-description').textContent = planningSource === 'upload'
    ? '不要求试听记录，不重新设计课程，只对老师已有规划进行整理和排版。'
    : '支持 SAT、AP 等 32 个考试科目；动态课程规划与路觅数据页。';
}

function renderUploadedCoursePlan(result) {
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const corrections = Array.isArray(result.extraction?.corrections) ? result.extraction.corrections : [];
  const stages = Array.isArray(result.extraction?.stages) ? result.extraction.stages : [];
  $('#course-plan-upload-review').innerHTML = `<header><div><p class="eyebrow">需要补充信息</p><h3>调整课程规划</h3><p>${escapeHtml(result.extraction?.title || result.fileName || '已解析课程规划')} · AI 未能确认部分时长，请补全后进入学习报告。</p></div><div class="course-plan-review-actions"><button type="button" class="secondary-btn" data-upload-action="reselect">重新上传</button><button type="button" class="primary-btn" data-upload-action="confirm">补全后进入学习报告</button></div></header>${warnings.length ? `<ul class="course-plan-upload-warnings">${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}${corrections.length ? `<details><summary>查看 ${corrections.length} 项文字修正</summary><ul class="course-plan-upload-warnings">${corrections.map((item) => `<li>${escapeHtml(item.original)} → ${escapeHtml(item.corrected)}</li>`).join('')}</ul></details>` : ''}<div>${stages.map((stage, stageIndex) => `<section class="uploaded-stage" data-upload-stage="${stageIndex}"><input aria-label="阶段名称" value="${escapeHtml(stage.title)}" maxlength="100" required><textarea aria-label="阶段说明" maxlength="300">${escapeHtml(stage.description || '')}</textarea><div class="uploaded-lessons">${stage.lessons.map((lesson, lessonIndex) => `<div class="uploaded-lesson" data-upload-lesson="${lessonIndex}"><select aria-label="课时时长"><option value="">未填写</option>${[0.5, 1, 1.5, 2].map((duration) => `<option value="${duration}"${Number(lesson.duration) === duration ? ' selected' : ''}>${duration}h</option>`).join('')}</select><input aria-label="课程主题" value="${escapeHtml(lesson.theme)}" maxlength="120" required><textarea aria-label="课程内容" maxlength="600">${escapeHtml(lesson.content || '')}</textarea></div>`).join('')}</div></section>`).join('')}</div>`;
  $('#course-plan-upload-panel').classList.add('is-reviewing');
  $('#course-plan-upload-review').classList.remove('hidden');
  uploadedCoursePlanConfirmed = false;
  uploadedCoursePlan = null;
  $('#course-plan-upload-review').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openUploadedPlanReport(coursePlan) {
  uploadedCoursePlan = cloneCoursePlan(coursePlan);
  uploadedCoursePlanConfirmed = true;
  const lessonCount = coursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
  $('#total-hours').value = String(coursePlan.totalHours);
  $('#lesson-count').value = String(lessonCount);
  if (!$('#student-name').value.trim()) $('#student-name').value = '学生';
  $('#course-plan-upload-status').className = 'course-plan-upload-status';
  $('#course-plan-upload-status').textContent = 'AI 解析完成，正在打开学习报告…';
  currentReportData = await generateAiReport();
  currentReportId = null;
  historicalTeacherProfile = null;
  isQuickPreview = false;
  originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  renderReport(currentReportData);
  setQuickPreviewActions(false);
  setReportDisplayMode('workspace');
  changeView('report');
  document.querySelector('#report-view .eyebrow').textContent = '上传规划已整理 · 可直接调整并导出';
  $('#save-report').textContent = '保存报告';
  await saveReport({ automatic: true });
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
    const response = await fetch('/api/parse-course-plan', { method: 'POST', body: form });
    const result = await response.json();
    if (parseVersion !== coursePlanParseVersion) return;
    if (!response.ok) throw new Error(result.error || 'COURSE_PLAN_PARSE_FAILED');
    if (result.lockedPlan) {
      await openUploadedPlanReport(result.lockedPlan);
      return;
    }
    renderUploadedCoursePlan(result);
    status.className = 'course-plan-upload-status error';
    status.textContent = '部分课时时长无法确认，请补全后继续。';
  } catch (error) {
    if (parseVersion !== coursePlanParseVersion) return;
    status.className = 'course-plan-upload-status error';
    status.textContent = error.message === 'UNAUTHORIZED' ? '登录已过期，请刷新页面重新登录。' : '文件解析失败，请检查文件格式或稍后重试。';
  }
}

function selectCoursePlanFile(file) {
  const status = $('#course-plan-upload-status');
  coursePlanParseVersion += 1;
  const validExtension = /\.(docx|xlsx|pdf)$/i.test(file?.name || '');
  if (!file || !validExtension || file.size > 8 * 1024 * 1024) {
    selectedCoursePlanFile = null;
    $('#course-plan-dropzone').classList.remove('has-file');
    $('#course-plan-file-name').textContent = '尚未选择文件';
    status.className = 'course-plan-upload-status error';
    status.textContent = !validExtension ? '仅支持 DOCX、XLSX 或 PDF 文件。' : '文件不能超过 8MB。';
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

function buildCurrentPlanningContext(lessonCount) {
  const reportContext = currentReportData?.planningContext;
  return {
    scenario: resolvePlanningScenario(reportContext?.scenario || $('#planning-scenario').value),
    lessonCount,
    focusAreas: normalizePlanningFocusAreas(reportContext?.focusAreas ?? getSelectedPlanningFocusAreas(), currentSubjectCode),
    includeExamTraining: planningSource === 'ai' && (reportContext?.includeExamTraining === true || $('#include-exam-training').checked),
    source: reportContext?.source === 'upload' || planningSource === 'upload' ? 'upload' : 'ai',
  };
}

function updateLessonCountHint() {
  const range = getLessonCountRange($('#total-hours').value);
  $('#lesson-count-hint').textContent = range
    ? `当前总课时支持 ${range.minimum}–${range.maximum} 节，每节 0.5–2 小时`
    : '填写总课时后自动建议，可继续修改';
}

function suggestLessonCount() {
  const range = getLessonCountRange($('#total-hours').value);
  if (range) $('#lesson-count').value = String(range.minimum);
  else $('#lesson-count').value = '';
  $('#lesson-count').setCustomValidity('');
  updateLessonCountHint();
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
  if (planningSource !== 'upload') return items;
  return [
    ...items.filter((item) => !['辅导场景', '课程侧重点', '试听记录'].includes(item.label)),
    { label: '生成方式', value: '老师上传已有规划', status: 'ready' },
  ];
}

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
  $('#generation-checklist-content').innerHTML = items.map((item) => `<div class="generation-checklist-item ${escapeHtml(item.status)}"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.value)}</b></div>`).join('');
  $('#generation-checklist-modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  window.setTimeout(() => $('[data-checklist-action="confirm"]')?.focus(), 0);
  return new Promise((resolve) => {
    generationChecklistResolver = resolve;
  });
}

function validateGenerationInputs() {
  const notice = $('#generation-notice');
  if (!subjectSelectionConfirmed) {
    $('#subject-search').setCustomValidity('请从下拉列表中选择课程科目');
    notice.classList.add('error');
    notice.innerHTML = '<strong>科目未确认：</strong>请从搜索结果中点击或按 Enter 选择课程科目。';
    $('#subject-search').reportValidity();
    return false;
  }
  if (planningSource === 'upload' && !uploadedCoursePlanConfirmed) {
    notice.classList.add('error');
    notice.innerHTML = '<strong>课程规划尚未就绪：</strong>请上传文件，AI 解析完成后会自动进入学习报告。';
    $('#course-plan-upload-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  const currentScore = $('#current-score');
  const targetScore = $('#target-score');
  const lessonCount = $('#lesson-count');
  currentScore.setCustomValidity('');
  targetScore.setCustomValidity('');
  lessonCount.setCustomValidity('');
  const lessonCountRange = getLessonCountRange($('#total-hours').value);
  const requestedLessonCount = Number(lessonCount.value);
  if (!lessonCountRange || !Number.isInteger(requestedLessonCount)
    || requestedLessonCount < lessonCountRange.minimum || requestedLessonCount > lessonCountRange.maximum) {
    const rangeText = lessonCountRange ? `${lessonCountRange.minimum}–${lessonCountRange.maximum}` : '有效';
    lessonCount.setCustomValidity(`当前总课时下，预计课次应为 ${rangeText} 节`);
    notice.classList.add('error');
    notice.innerHTML = `<strong>课次填写有误：</strong>当前总课时下，预计课次应为 ${escapeHtml(rangeText)} 节。`;
    lessonCount.reportValidity();
    return false;
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
    const response = await fetch('/api/reports');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'REPORT_LIST_FAILED');
    if (!result.reports?.length) {
      container.innerHTML = '<div class="history-empty">还没有保存过报告。生成报告后点击“保存报告”，这里就会出现历史记录。</div>';
      return;
    }
    container.innerHTML = result.reports.map((report) => `<article class="history-card"><div><span class="history-chip">${escapeHtml(report.status === 'completed' ? '已完成' : report.status)}</span><h2>${escapeHtml(report.student_name)} · ${escapeHtml(report.subject)}</h2><p>更新于 ${escapeHtml(formatHistoryDate(report.updated_at))}</p></div><button type="button" class="secondary-btn" data-history-id="${escapeHtml(report.id)}">打开报告</button></article>`).join('');
  } catch {
    container.innerHTML = '<div class="history-empty">历史报告读取失败，请刷新页面后重试。</div>';
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
  const response = await fetch(`/api/reports?id=${encodeURIComponent(reportId)}`);
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    const error = new Error('AI_GATEWAY_ERROR');
    error.requestId = response.headers.get('x-request-id') || '';
    error.reason = `AI 服务返回异常（HTTP ${response.status}）。`;
    error.suggestion = '请稍后重新生成；如果反复出现，请联系管理员检查 Vercel Function 日志。';
    throw error;
  }
  if (!response.ok || !result.report) throw new Error(result.error || 'REPORT_NOT_FOUND');
  const record = result.report;
  const subjectCode = resolveStoredSubjectCode(record.subject);
  applySubjectSelection(subjectCode);
  $('#student-name').value = record.student_name || '';
  $('#current-score').value = record.current_score || '';
  $('#target-score').value = record.target_score || '';
  $('#teacher-notes').value = record.original_notes || '';
  $('#total-hours').value = record.course_plan?.totalHours || '';
  const savedPlanningContext = record.report_data?.planningContext || {};
  $('#planning-scenario').value = resolvePlanningScenario(savedPlanningContext.scenario);
  renderPlanningFocusOptions(savedPlanningContext.focusAreas || []);
  const savedLessons = record.course_plan?.stages?.flatMap((stage) => stage.lessons || []) || [];
  $('#lesson-count').value = savedPlanningContext.lessonCount || savedLessons.length || Math.ceil(Number(record.course_plan?.totalHours || 0) / 2) || '';
  $('#include-exam-training').checked = savedPlanningContext.includeExamTraining === true;
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
  const fallback = buildFallbackReport(subjectCode, collectFormData());
  currentReportData = {
    ...fallback,
    ...(record.report_data || {}),
    coursePlan: record.course_plan || fallback.coursePlan,
    salesFollowUp: {
      ...fallback.salesFollowUp,
      ...(record.sales_follow_up || {}),
    },
  };
  currentReportId = record.id;
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
  setReportDisplayMode('workspace');
  changeView('report');
  document.querySelector('#report-view .eyebrow').textContent = '历史报告 · 已保存';
  $('#save-report').textContent = '更新历史报告';
}

async function generateAiReport() {
  const formData = collectFormData();
  if (planningSource === 'upload') {
    const result = await requestGeneratedJson('/api/generate-report', {
      ...formData,
      subjectCode: currentSubjectCode,
    });
    return result.report;
  }
  const commonPayload = {
    ...formData,
    subjectCode: currentSubjectCode,
  };
  const outlineResult = await retryGenerationStep(
    () => requestGeneratedJson('/api/generate-report-batch', { ...commonPayload, operation: 'outline' }),
    2,
  );
  const outline = outlineResult.outline;
  const stages = outline.stages;
  let completedStages = 0;
  let stageCursor = 0;
  const generatedStages = new Array(stages.length);
  const updateProgress = () => {
    $('#generation-notice').innerHTML = `<strong>正在分批生成：</strong>阶段规划已完成，正在生成详细课次（${completedStages}/${stages.length} 个阶段）。请不要关闭页面。`;
  };
  updateProgress();
  const worker = async () => {
    while (stageCursor < stages.length) {
      const stageIndex = stageCursor;
      stageCursor += 1;
      const stage = stages[stageIndex];
      const stageResult = await retryGenerationStep(
        () => requestGeneratedJson('/api/generate-report-batch', {
          ...commonPayload,
          operation: 'stage',
          stage: {
            title: stage.title,
            description: stage.description,
            lessonCount: stage.lessonCount,
          },
          stageIndex,
          stageCount: stages.length,
          startLessonNumber: stage.startLessonNumber,
          durations: stage.durations,
          previousStageTitle: stages[stageIndex - 1]?.title || '',
          nextStageTitle: stages[stageIndex + 1]?.title || '',
        }),
        3,
      );
      generatedStages[stageIndex] = {
        title: stage.title,
        description: stage.description,
        lessons: stageResult.lessons,
      };
      completedStages += 1;
      updateProgress();
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, stages.length) }, () => worker()));
  const generatedLessonCount = generatedStages.reduce((total, stage) => total + stage.lessons.length, 0);
  if (generatedLessonCount !== Number(formData.lessonCount)) {
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
      const error = new Error('EXAM_TRAINING_LESSON_COUNT_MISMATCH');
      error.reason = `已勾选考试训练，但规划中只有 ${examTrainingHours}h 考试训练，至少需要 ${minimumExamTrainingHours}h。`;
      error.suggestion = '请重新生成，系统会补充 MCQ、FRQ、模考或错题讲评安排。';
      throw error;
    }
  }
  const { stages: unusedStages, rationale, ...summary } = outline;
  const targetScore = outlineResult.targetScore || formData.targetScore || '';
  const subjectName = createSubjectViewModel(currentSubjectCode).displayName;
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

async function requestGeneratedJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get('content-type') || '';
  let result;
  if (contentType.includes('application/json')) {
    result = await response.json();
  } else {
    const error = new Error('AI_GATEWAY_ERROR');
    error.requestId = response.headers.get('x-request-id') || '';
    error.reason = response.status === 502 || response.status === 504
      ? 'AI 生成时间超过当前平台限制，本次请求已超时。'
      : 'AI 服务暂时未返回有效结果。';
    error.suggestion = '请直接重新生成；如果反复出现，请把发生时间发给管理员。';
    throw error;
  }
  if (!response.ok) {
    const error = new Error(result.error || 'AI_GENERATION_FAILED');
    error.requestId = result.requestId || response.headers.get('x-request-id') || '';
    error.reason = result.reason || '';
    error.suggestion = result.suggestion || '';
    throw error;
  }
  return result;
}

async function retryGenerationStep(task, attempts) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
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

$('#report-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#generate-report');
  const notice = $('#generation-notice');
  if (!validateGenerationInputs()) return;
  if (!await openGenerationChecklist()) return;
  button.disabled = true;
  button.textContent = planningSource === 'upload' ? '正在生成课程规划报告…' : 'AI 正在分析并生成课程规划…';
  notice.classList.remove('error');
    notice.innerHTML = planningSource === 'upload'
      ? '<strong>正在生成：</strong>课程规划已锁定，系统正在整理完整报告，请不要重复提交或关闭页面。'
      : '<strong>正在生成：</strong>通常需要 30–90 秒，详细课时规划可能更久，请不要重复提交或关闭页面。';
  try {
    currentReportData = await generateAiReport();
    currentReportId = null;
    historicalTeacherProfile = null;
    isQuickPreview = false;
    originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
    renderReport(currentReportData);
    setQuickPreviewActions(false);
    setReportDisplayMode('workspace');
    changeView('report');
    document.querySelector('#report-view .eyebrow').textContent = 'AI 报告已生成 · 未云端保存';
    $('#save-report').textContent = '保存报告';
    await saveReport({ automatic: true });
    notice.innerHTML = planningSource === 'upload'
      ? '<strong>上传模式：</strong>课程规划来自老师确认的上传文件，系统未改动课次、顺序和时长。'
      : '<strong>生成原则：</strong>总课时由老师决定，AI 仅负责规划内容与课时分配。';
  } catch (error) {
    if (error.message === 'INVALID_INPUT') {
      notice.classList.add('error');
      notice.innerHTML = '<strong>信息不足：</strong>请至少填写 20 个字的试听课反馈。';
      return;
    }
    if (error.message === 'UNAUTHORIZED') {
      notice.classList.add('error');
      notice.innerHTML = '<strong>登录已过期：</strong>请刷新页面后重新登录。';
      return;
    }
    notice.classList.add('error');
    const messages = {
      AI_GENERATION_FAILED: 'AI 服务暂时无响应，请稍后重试。',
      AI_GATEWAY_ERROR: 'AI 服务请求超时或平台暂时异常，请稍后重试。',
      INVALID_SCORE: '当前成绩或目标成绩不符合所选科目的分数范围。',
      INVALID_LESSON_COUNT: '预计课次与总课时不匹配，请返回检查。',
      SYLLABUS_COVERAGE_VIOLATION: '课程规划遗漏或错误标记了 Calculus 官方 Unit，请重新生成。',
      SUBJECT_SCOPE_VIOLATION: 'AI 内容出现跨科目术语，请重新生成。',
      UNEXPECTED_LANGUAGE: 'AI 内容出现异常语言文字，系统已阻止生成，请重新生成。',
      COURSE_PLAN_STYLE_REPETITION: '连续课时使用了重复的大纲式句型，请重新生成。',
      REPORT_QUALITY_FAILED: 'AI 连续两次未达到报告质量要求，请重新生成。'
    };
    const reason = error.reason || messages[error.message] || `报告渲染异常（${error.message || 'UNKNOWN_ERROR'}），请重试。`;
    const suggestion = error.suggestion ? `<br><span>建议：${escapeHtml(error.suggestion)}</span>` : '';
    const reference = error.requestId ? ` <span>参考编号：${escapeHtml(error.requestId)}</span>` : '';
    notice.innerHTML = `<strong>生成失败：</strong>${escapeHtml(reason)}${suggestion}${reference}`;
  } finally {
    button.disabled = false;
    button.innerHTML = planningSource === 'upload' ? '生成课程规划报告 <span>→</span>' : 'AI 生成个性化报告 <span>→</span>';
  }
});
document.querySelectorAll('[data-scenario-sample]').forEach((button) => button.addEventListener('click', () => {
  const scenario = resolvePlanningScenario(button.dataset.scenarioSample);
  $('#planning-scenario').value = scenario;
  $('#teacher-notes').value = PLANNING_SCENARIOS[scenario].sample;
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
$('#total-hours').addEventListener('input', suggestLessonCount);
$('#lesson-count').addEventListener('input', (event) => {
  event.target.setCustomValidity('');
  updateLessonCountHint();
});
$('#planning-focus-options').addEventListener('change', updatePlanningFocusState);
document.querySelectorAll('[name="planning-source"]').forEach((input) => input.addEventListener('change', (event) => setPlanningSource(event.target.value)));
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
    await openUploadedPlanReport(collectUploadedCoursePlan());
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
  } catch {
    button.disabled = false;
    button.textContent = '重试打开';
  }
});
$('#back-edit').addEventListener('click', () => {
  if (isQuickPreview) {
    isQuickPreview = false;
    changeView('new');
    return;
  }
  setReportDisplayMode('workspace');
  $('#report-mode-banner').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#save-report').addEventListener('click', saveReport);
$('#quick-preview-report').addEventListener('click', openQuickPreview);
async function waitForReportImages() {
  const images = [...document.querySelectorAll('#parent-report img')];
  await Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }
    if (image.decode) await image.decode().catch(() => {});
  }));
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

function setReportDisplayMode(mode) {
  const isPreview = mode === 'preview';
  const isUploadedPlan = currentReportData?.planningContext?.source === 'upload';
  if (isPreview && currentReportData) renderReport(currentReportData);
  if (!isPreview && currentReportData) initializeWorkspaceEditors();
  $('#parent-report').classList.toggle('teacher-workspace-mode', !isPreview);
  $('#parent-report').classList.toggle('parent-preview-mode', isPreview);
  $('#parent-report').classList.toggle('hidden', !isPreview);
  $('#teacher-workspace-editor').classList.toggle('hidden', isPreview);
  $('#summary-editor-modal').classList.toggle('hidden', !isPreview && isUploadedPlan);
  $('#report-mode-banner').classList.toggle('preview-mode', isPreview);
  $('#report-mode-banner').innerHTML = isPreview
    ? '<div><strong>家长版预览</strong><span>当前展示完整交付版内容，导出的 PDF 将采用相同页面顺序。</span></div><span class="report-mode-status">完整报告</span>'
    : isUploadedPlan
      ? '<div><strong>课程规划调整</strong><span>AI 已完成文件解析，请直接调整阶段、课次、时长和文字，修改会同步到报告。</span></div><span class="report-mode-status">可编辑</span>'
      : '<div><strong>老师工作台</strong><span>请重点核对试听反馈与课程规划，品牌包装页将在家长预览和 PDF 中显示。</span></div><span class="report-mode-status">待老师核对</span>';
  $('#preview-report').textContent = isPreview ? '返回老师工作台' : '预览家长版';
  $('#preview-report').setAttribute('aria-pressed', String(isPreview));
}

$('#preview-report').addEventListener('click', () => {
  const isPreview = $('#parent-report').classList.contains('parent-preview-mode');
  setReportDisplayMode(isPreview ? 'workspace' : 'preview');
  $('#report-mode-banner').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#print-report').addEventListener('click', async () => {
  const printButton = $('#print-report');
  const previousButtonText = printButton.textContent;
  const previousMode = $('#parent-report').classList.contains('parent-preview-mode') ? 'preview' : 'workspace';
  let restored = false;
  const restorePrintState = () => {
    if (restored) return;
    restored = true;
    switchReportImageSources('screen');
    setReportDisplayMode(previousMode);
    printButton.disabled = false;
    printButton.textContent = previousButtonText;
  };
  printButton.disabled = true;
  printButton.textContent = '正在准备 PDF…';
  try {
    setReportDisplayMode('preview');
    switchReportImageSources('print');
    await waitForReportImages();
    window.addEventListener('afterprint', restorePrintState, { once: true });
    window.print();
  } catch (error) {
    restorePrintState();
    throw error;
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
    if (stageAction === 'collapse') collapsedStages.has(stage) ? collapsedStages.delete(stage) : collapsedStages.add(stage);
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
    draftCoursePlan.stages[stageIndex].lessons.push(createLesson());
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
  collapsedStages.delete(draftCoursePlan.stages[stageIndex]);
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
    draftCoursePlan.stages.push(createStage());
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
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  const isParent = tab.dataset.reportTab === 'parent';
  document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab));
  $('#parent-report').classList.toggle('hidden', !isParent);
  $('#sales-card').classList.toggle('hidden', isParent);
  $('#report-mode-banner').classList.toggle('hidden', !isParent);
  $('#preview-report').classList.toggle('hidden', !isParent);
  $('#print-report').classList.toggle('hidden', !isParent);
}));
$('#copy-script').addEventListener('click', async () => { await navigator.clipboard.writeText($('#sales-script').textContent); $('#copy-script').textContent = '已复制'; setTimeout(() => { $('#copy-script').textContent = '复制话术'; }, 1200); });
const defaultCoursePlan = getDefaultCoursePlan();

// 初始化
populateSubjectSelect();
loadTeacherProfile();
const initialData = collectFormData();
currentReportData = buildFallbackReport(currentSubjectCode, initialData);
originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
mountTeacherWorkspaceEditors();
renderReport(currentReportData);
initializeWorkspaceEditors();
setReportDisplayMode('workspace');
