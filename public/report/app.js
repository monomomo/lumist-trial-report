import { ALLOWED_DURATIONS, cloneCoursePlan, calculateTotalHours, validateCoursePlan, moveItem, moveLesson, rebalanceFinalPage, createStage, createLesson } from './course-plan-utils.js';
import { SUBJECT_CODES, SUBJECT_CATALOG, resolveSubject } from './catalog.js';
import { createSubjectViewModel, normalizeTeacherProfile, buildPdfFileName, canUseFallback, buildFallbackReport } from './report-domain.js';

const sampleOne = '我刚上了一节SAT数学试听课。根据课前沟通，学生已经不记得SAT数学的知识点了。所以我们计划从头开始梳理知识点，同学上课互动很积极，做题的正确率也挺好的，中等难度的题也可以做对，没有她自己说的那么基础差。但是确实是有些知识点有遗忘。所以我计划接下来先从头补知识点，让同学建立SAT数学知识图谱。';
const sampleTwo = '学生课上挺活泼的，爱互动，愿意思考，做题的准确率其实很不错。因为学生不了解SAT考点，第一节课带学生看了SAT的4章内容。学生现在在学微积分，所以Algebra的内容比较熟练，但因为比较久没有接触概率、几何的东西，这两章相对薄弱。';

const $ = (selector) => document.querySelector(selector);
const setText = (selector, value) => { $(selector).textContent = value; };
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const CSS_PIXELS_PER_INCH = 96;
const MILLIMETERS_PER_INCH = 25.4;
const A4_PAGE_HEIGHT_MM = 297;
const PLAN_PAGE_VERTICAL_PADDING = 84;
const PLAN_PAGE_SAFETY_MARGIN = 32;
const PLAN_PAGE_AVAILABLE_HEIGHT = A4_PAGE_HEIGHT_MM / MILLIMETERS_PER_INCH * CSS_PIXELS_PER_INCH
  - PLAN_PAGE_VERTICAL_PADDING
  - PLAN_PAGE_SAFETY_MARGIN;

/* ── 科目选择 ── */

let currentSubjectCode = 'sat_math';
let currentReportData = null;
let currentReportId = null;
let historicalTeacherProfile = null;
let summaryPageCount = 1;

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
  configureExamDateField(currentSubjectCode);
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
  currentSubjectCode = code;
  const vm = createSubjectViewModel(code);
  $('#subject-select').value = code;
  $('#form-eyebrow').textContent = `${vm.displayName}试听`;
  $('#score-label-current').textContent = `当前${vm.scoreLabel}（可选）`;
  $('#score-label-target').textContent = `目标${vm.scoreLabel}（可选）`;
  $('#current-score').placeholder = vm.scoreMax > 100 ? `例如：${Math.round((vm.scoreMin + vm.scoreMax) / 2)}` : `例如：${Math.round((vm.scoreMin + vm.scoreMax) / 2)}`;
  $('#target-score').placeholder = vm.scoreMax > 100 ? `例如：${vm.scoreMax}` : `例如：${vm.scoreMax}`;
  configureExamDateField(code);
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
  continuation.innerHTML = '<div class="summary-page-content"><div class="page-kicker">02 / 试听课总结 · 续</div><h2>试听反馈与学习成果</h2></div>';
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
    const planTitleHtml = `<div class="plan-page-body"><div class="page-kicker"></div><div class="plan-page-heading"><div><h2>${escapeHtml(createSubjectViewModel(currentSubjectCode).displayName)}个性化课程规划</h2><p>依据学生试听表现与目标动态编排，相邻阶段将按页面容量连续呈现。</p></div><div class="plan-total-hours"><span>建议总课时</span><b>${escapeHtml(coursePlan.totalHours)}h</b></div></div><table><thead><tr><th>课时</th><th>时长</th><th>授课内容、目标与重难点</th></tr></thead><tbody></tbody></table><div class="plan-note plan-note-reserve"><strong>动态调整原则：</strong>${escapeHtml(coursePlan.rationale)} 课时可按 0.5h、1h、1.5h 或 2h 灵活调整。</div></div>`;
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
    row.innerHTML = `<td class="plan-sequence-cell"><b>${String(lessonIndex).padStart(2, '0')}</b><span>课时</span></td><td class="plan-duration-cell">${escapeHtml(lesson.duration)}h</td><td class="plan-detail-cell"><b>${escapeHtml(lesson.theme)}</b><p><span>目标：</span>${escapeHtml(lesson.goal)}</p><p><span>内容：</span>${escapeHtml(lesson.content)}</p><p><span>重难点：</span>${escapeHtml(lesson.difficulty)}</p></td>`;
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
    target: target || '待老师确认'
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

function renderReport(data) {
  const name = $('#student-name').value.trim() || '学生';
  const target = $('#target-score').value.trim();
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
  const qualityNotice = $('#report-quality-notice');
  qualityNotice.textContent = data.teacherNotice || '';
  qualityNotice.classList.toggle('hidden', !data.teacherNotice);
}

function changeView(id) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${id}-view`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const nav = $('#plan-stage-nav-list');
  const content = $('#plan-editor-content');
  nav.innerHTML = '';
  content.innerHTML = '';
  draftCoursePlan.stages.forEach((stage, stageIndex) => {
    const navButton = document.createElement('button');
    navButton.type = 'button';
    navButton.dataset.scrollStage = String(stageIndex);
    navButton.textContent = `${stageIndex + 1}. ${stage.title || '未命名阶段'}`;
    nav.appendChild(navButton);

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
      addLesson.textContent = '新增课时';
      section.appendChild(addLesson);
    }
    content.appendChild(section);
  });
  updateEditorSummary();
}

function createLessonEditor(lesson, stageIndex, lessonIndex) {
  const card = document.createElement('article');
  card.className = 'plan-lesson-editor';
  const globalIndex = draftCoursePlan.stages.slice(0, stageIndex).reduce((total, stage) => total + stage.lessons.length, 0) + lessonIndex + 1;
  card.innerHTML = `<header><b>课时 ${String(globalIndex).padStart(2, '0')}</b><div class="editor-icon-actions"><button type="button" data-lesson-action="up" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}" ${lessonIndex === 0 ? 'disabled' : ''}>上移</button><button type="button" data-lesson-action="down" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}" ${lessonIndex === draftCoursePlan.stages[stageIndex].lessons.length - 1 ? 'disabled' : ''}>下移</button><button type="button" data-lesson-action="copy" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}">复制</button><button type="button" data-lesson-action="delete" data-stage-index="${stageIndex}" data-lesson-index="${lessonIndex}">删除</button></div></header>`;
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

function openPlanEditor() {
  draftCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  editorBaseline = JSON.stringify(draftCoursePlan);
  collapsedStages = new WeakSet();
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
  const validation = validateCoursePlan(draftCoursePlan);
  if (!validation.valid) {
    showValidationErrors(validation.errors);
    setPlanEditorMessage(`共有 ${validation.errors.length} 项需要修改：${validation.errors[0].message}`, 'error');
    focusValidationError(validation.errors[0]);
    return;
  }
  clearValidationErrors();
  if (validation.warnings.length && !window.confirm(`有 ${validation.warnings.length} 项内容较长，可能影响排版。仍要应用吗？`)) return;
  renderCoursePlan(draftCoursePlan);
  currentReportData.coursePlan = cloneCoursePlan(draftCoursePlan);
  document.querySelector('#report-view .eyebrow').textContent = '课程规划已编辑 · 未云端保存';
  closePlanEditor();
  document.querySelector('.reference-plan-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function restoreOriginalCoursePlan() {
  if (!originalAiCoursePlan) return;
  if (!window.confirm('确定恢复为本次 AI 生成的原始课程规划吗？当前课程规划修改将被覆盖。')) return;
  currentReportData.coursePlan = cloneCoursePlan(originalAiCoursePlan);
  renderCoursePlan(currentReportData.coursePlan);
  document.querySelector('#report-view .eyebrow').textContent = '已恢复 AI 原始课程规划 · 未云端保存';
  closePlanEditor();
  document.querySelector('.reference-plan-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveReport() {
  if (!currentReportData) return;
  const reportStatus = document.querySelector('#report-view .eyebrow');
  const saveButton = $('#save-report');
  const { coursePlan, salesFollowUp, ...reportData } = currentReportData;
  const payload = {
    id: currentReportId,
    studentName: $('#student-name').value.trim(),
    currentScore: $('#current-score').value.trim(),
    targetScore: $('#target-score').value.trim(),
    examDate: getSelectedExamDate(),
    teacherNotes: $('#teacher-notes').value.trim(),
    subject: createSubjectViewModel(currentSubjectCode).displayName,
    reportData,
    coursePlan,
    salesFollowUp,
  };
  reportStatus.textContent = '正在保存报告';
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
    reportStatus.textContent = result.saved ? '报告已生成 · 已保存' : '报告已生成 · 本地演示';
    saveButton.textContent = currentReportId ? '更新历史报告' : '保存报告';
  } catch {
    reportStatus.textContent = '报告保存失败 · 请稍后重试';
    saveButton.textContent = '重新保存';
  } finally {
    saveButton.disabled = false;
  }
}

function collectFormData() {
  return {
    studentName: $('#student-name').value.trim(),
    currentScore: $('#current-score').value.trim(),
    targetScore: $('#target-score').value.trim(),
    examDate: getSelectedExamDate(),
    totalHours: $('#total-hours').value,
    teacherNotes: $('#teacher-notes').value.trim(),
  };
}

function getSelectedExamDate() {
  return currentSubjectCode.startsWith('ap_') ? $('#ap-exam-date').value : $('#exam-date').value.trim();
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
  const result = await response.json();
  if (!response.ok || !result.report) throw new Error(result.error || 'REPORT_NOT_FOUND');
  const record = result.report;
  const subjectCode = resolveStoredSubjectCode(record.subject);
  applySubjectSelection(subjectCode);
  $('#student-name').value = record.student_name || '';
  $('#current-score').value = record.current_score || '';
  $('#target-score').value = record.target_score || '';
  $('#teacher-notes').value = record.original_notes || '';
  $('#total-hours').value = record.course_plan?.totalHours || '';
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
  historicalTeacherProfile = buildHistoricalTeacherProfile(record.teacher_snapshot);
  originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
  renderReport(currentReportData);
  changeView('report');
  document.querySelector('#report-view .eyebrow').textContent = '历史报告 · 已保存';
  $('#save-report').textContent = '更新历史报告';
}

async function generateAiReport() {
  const formData = collectFormData();
  const response = await fetch('/api/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...formData,
      subjectCode: currentSubjectCode,
    })
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'AI_GENERATION_FAILED');
  }
  return result.report;
}

$('#report-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#generate-report');
  const notice = $('#generation-notice');
  button.disabled = true;
  button.textContent = 'AI 正在分析并生成课程规划…';
  notice.classList.remove('error');
  notice.innerHTML = '<strong>正在生成：</strong>通常需要 30–90 秒，详细课时规划可能更久，请不要重复提交或关闭页面。';
  try {
    currentReportData = await generateAiReport();
    currentReportId = null;
    historicalTeacherProfile = null;
    originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
    renderReport(currentReportData);
    changeView('report');
    document.querySelector('#report-view .eyebrow').textContent = 'AI 报告已生成 · 未云端保存';
    $('#save-report').textContent = '保存报告';
    notice.innerHTML = '<strong>生成原则：</strong>总课时由老师决定，AI 仅负责规划内容与课时分配。';
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
    if (canUseFallback(error.message)) {
      currentReportData = buildFallbackReport(currentSubjectCode, collectFormData());
      currentReportId = null;
      historicalTeacherProfile = null;
      originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
      renderReport(currentReportData);
      changeView('report');
      document.querySelector('#report-view .eyebrow').textContent = '本地兜底版 · AI 暂不可用';
      $('#save-report').textContent = '保存报告';
    } else {
      notice.classList.add('error');
      const messages = {
        AI_GENERATION_FAILED: 'AI 服务暂时无响应，请稍后重试。',
        SUBJECT_SCOPE_VIOLATION: 'AI 内容出现跨科目术语，请重新生成。'
      };
      notice.innerHTML = `<strong>生成失败：</strong>${messages[error.message] || `报告渲染异常（${escapeHtml(error.message || 'UNKNOWN_ERROR')}），请重试。`}`;
    }
  } finally {
    button.disabled = false;
    button.innerHTML = 'AI 生成个性化报告 <span>→</span>';
  }
});
$('#sample-one').addEventListener('click', () => { $('#teacher-notes').value = sampleOne; });
$('#sample-two').addEventListener('click', () => { $('#teacher-notes').value = sampleTwo; });
$('#subject-select').addEventListener('change', onSubjectChange);
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
$('#back-edit').addEventListener('click', () => changeView('new'));
$('#save-report').addEventListener('click', saveReport);
$('#print-report').addEventListener('click', () => {
  const previousOverflow = document.body.style.overflow;
  const previousTitle = document.title;
  const subjectName = createSubjectViewModel(currentSubjectCode).displayName;
  const studentName = $('#student-name').value.trim();
  let restored = false;
  document.title = buildPdfFileName(subjectName, studentName);
  const restorePrintState = () => {
    if (restored) return;
    restored = true;
    document.body.style.overflow = previousOverflow;
    document.title = previousTitle;
    window.removeEventListener('afterprint', restorePrintState);
  };
  window.addEventListener('afterprint', restorePrintState);
  window.print();
  window.setTimeout(restorePrintState, 1000);
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
      if (!window.confirm(`确定删除该阶段及其中 ${stage.lessons.length} 个课时吗？`)) return;
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
      if (!window.confirm('确定删除该课时吗？')) return;
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
$('#plan-stage-nav-list').addEventListener('click', (event) => {
  if (event.target.dataset.scrollStage !== undefined) $(`[data-stage-editor="${event.target.dataset.scrollStage}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
window.addEventListener('beforeunload', (event) => {
  if (!isCoursePlanDirty()) return;
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
}));
$('#copy-script').addEventListener('click', async () => { await navigator.clipboard.writeText($('#sales-script').textContent); $('#copy-script').textContent = '已复制'; setTimeout(() => { $('#copy-script').textContent = '复制话术'; }, 1200); });
const defaultCoursePlan = getDefaultCoursePlan();

// 初始化
populateSubjectSelect();
loadTeacherProfile();
const initialData = collectFormData();
currentReportData = buildFallbackReport(currentSubjectCode, initialData);
originalAiCoursePlan = cloneCoursePlan(currentReportData.coursePlan);
renderReport(currentReportData);
