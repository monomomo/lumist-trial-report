import { mountPlanEditor } from './paper-plan-editor.js?v=10';
import { SUMMARY_FIELD_RULES } from './summary-editor-utils.js';

export function mountPaperWorkspace({
  setReportDisplayMode, prepareSourceEdit, cancelSourceEdit,
  collectFormDraft, getCoursePlan, commitCoursePlan, isQuickPreview, reportError,
}) {
  const $ = (selector) => document.querySelector(selector);
  const form = $('#report-form');
  const documentPages = $('#parent-report');
  const reportView = $('#report-view');
  const toolbar = $('.report-navigation');
  const originalTab = (key) => $(`[data-report-tab="${key}"]`);
  let sourceSnapshot = null;
  $('#history-view').classList.add('paper-view');
  const sidebar = $('.sidebar');
  const sidebarToggle = $('.sidebar-toggle');
  const sidebarPreference = 'report-sidebar-collapsed';

  function setSidebarCollapsed(collapsed) {
    sidebar.classList.toggle('sidebar-collapsed', collapsed);
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? '展开导航' : '收起导航';
    sidebarToggle.setAttribute('aria-label', label);
    sidebarToggle.title = label;
    sidebarToggle.firstElementChild.textContent = collapsed ? '→' : '←';
  }

  try {
    setSidebarCollapsed(localStorage.getItem(sidebarPreference) === 'true');
  } catch {
    setSidebarCollapsed(false);
  }
  sidebarToggle.addEventListener('click', () => {
    const collapsed = !sidebar.classList.contains('sidebar-collapsed');
    setSidebarCollapsed(collapsed);
    try {
      localStorage.setItem(sidebarPreference, String(collapsed));
    } catch {
      // The current page still keeps the selected navigation state.
    }
  });


  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function button(text, action, className = 'secondary-btn') {
    const control = element('button', className, text);
    control.type = 'button';
    control.addEventListener('click', action);
    return control;
  }

  function paper(heading, kicker, id) {
    const page = element('article', 'report-page draft-paper');
    page.id = id;
    page.append($('.summary-page .report-brand-header').cloneNode(true), element('div', 'page-kicker', kicker), element('h2', '', heading));
    return page;
  }

  function disclosure(title, content) {
    const details = element('details', 'paper-options');
    details.append(element('summary', '', title), content);
    return details;
  }

  const summary = paper('试听课堂观察与学习建议', '01 / 学生信息与试听课总结', 'draft-summary');
  const plan = paper('个性化课程规划', '02 / 课程规划', 'draft-plan');
  const student = $('#form-student');
  const feedback = $('#form-feedback');
  const planning = $('#form-planning');

  const studentGrid = student.querySelector('.field-grid');
  studentGrid.id = 'draft-student';
  studentGrid.classList.add('paper-student-grid');
  const extraStudentFields = element('div', 'field-grid');
  extraStudentFields.append($('#current-score').closest('label'), $('#exam-date').closest('label'), $('#sat-english-context'));
  studentGrid.after(disclosure('当前成绩、考试日期与语言基础', extraStudentFields));

  const sourceNotes = $('#teacher-notes').closest('label');
  const conclusion = element('textarea', '');
  conclusion.id = 'parent-conclusion';
  conclusion.name = 'parentConclusion';
  conclusion.maxLength = SUMMARY_FIELD_RULES.overview.maximum;
  conclusion.hidden = true;
  sourceNotes.querySelector('textarea').placeholder = '记录课堂内容、学生表现和建议，供生成报告参考…';
  sourceNotes.querySelector('textarea').setAttribute('aria-label', '课堂原始记录');
  const feedbackReview = $('.feedback-review');
  const schoolExams = element('div', '');
  schoolExams.append($('#school-exams'), $('#add-school-exam'));
  planning.querySelector('.generation-mode-tabs').after(disclosure('校内考试安排（选填）', schoolExams));
  const feedbackImport = disclosure('推荐：从两份群反馈自动整理课堂记录', feedbackReview);
  feedbackImport.classList.add('recommended-feedback-import');
  feedbackImport.open = true;
  sourceNotes.before(conclusion, feedbackImport);
  sourceNotes.after(element('p', 'paper-help', '请核对自动整理结果，也可以直接补充或修改。AI 将根据这份课堂记录生成家长版试听总结。'));

  const draftContent = $('.form-module-main');
  draftContent.prepend(summary, plan);
  summary.append(student, feedback);
  plan.append(planning);
  for (const panel of [student, feedback, planning]) panel.hidden = false;
  const generate = $('#generate-report');
  generate.setAttribute('form', form.id);
  const draftToolbar = $('#new-view .form-toolbar');
  draftToolbar.append(generate);
  $('#new-view h1').textContent = '新建试听报告';

  function stickyOffset(view) {
    return ['.paper-chrome', '.paper-mobile-controls, .paper-mobile-nav'].reduce((height, selector) => {
      const node = view.querySelector(selector);
      return height + (getComputedStyle(node).position === 'sticky' ? node.getBoundingClientRect().height : 0);
    }, 0);
  }

  function jump(target) {
    if (!target) return;
    requestAnimationFrame(() => {
      const view = target.closest('.view');
      const top = scrollY + target.getBoundingClientRect().top - stickyOffset(view) - 14;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    });
  }

  function workspace(view, host, options) {
    const wrapper = element('div', 'paper-workspace');
    const rail = element('nav', 'paper-rail');
    rail.setAttribute('aria-label', '报告内目录');
    const select = element('select', 'paper-mobile-nav');
    select.setAttribute('aria-label', '报告内目录');
    host.before(select, wrapper);
    wrapper.append(rail, host);
    const buttons = new Map();
    rail.append(element('p', 'paper-nav-label', '报告目录'));
    let selected = options[0][0];
    for (const [key, label] of options) {
      if (key === 'quality') rail.append(element('p', 'paper-nav-label paper-nav-divider', '内部工具'));
      select.add(new Option(label, key));
      const entry = button(label, () => activate(key), 'paper-nav-item');
      entry.dataset.paperChapter = key;
      buttons.set(key, entry);
      rail.append(entry);
    }
    function highlight(key) {
      selected = key;
      select.value = key;
      for (const [id, entry] of buttons) {
        if (id === key) entry.setAttribute('aria-current', 'location');
        else entry.removeAttribute('aria-current');
      }
      wrapper.dataset.chapter = key;
    }
    function activate(key) {
      const option = options.find(([id]) => id === key);
      if (!option) return;
      highlight(key);
      option[2]();
    }
    select.addEventListener('change', () => activate(select.value));
    view.classList.add('paper-view');
    const chrome = view.querySelector('.paper-chrome, .topbar');
    new ResizeObserver(() => {
      view.style.setProperty('--paper-toolbar-height', `${chrome.getBoundingClientRect().height}px`);
    }).observe(chrome);
    highlight(selected);
    return { rail, highlight, activate, current: () => selected };
  }

  const draftNav = workspace($('#new-view'), $('.workspace'), [
    ['summary', '试听总结', () => jump(summary)],
    ['plan', '课程规划', () => jump(plan)],
  ]);
  form.addEventListener('focusin', (event) => {
    const panel = event.target.closest('[data-form-panel]');
    if (panel && panel.dataset.formPanel !== 'review') {
      (sourceSnapshot ? reportNav : draftNav).highlight(panel === planning ? 'plan' : 'summary');
    }
  });
  $('#new-view .topbar').classList.add('paper-chrome');
  toolbar.classList.add('paper-chrome');
  $('.report-module-nav').hidden = true;
  const modeButton = button('家长版预览', () => {
    if (currentMode() === 'layout') setMode('preview');
    else setMode('layout');
    const chapter = ['quality', 'sales'].includes(reportNav.current()) ? 'summary' : reportNav.current();
    reportNav.activate(chapter);
  });
  modeButton.classList.add('paper-mode-button');
  $('#print-report').before(modeButton);
  const reportBody = element('div', 'paper-report-body');
  toolbar.after(reportBody);
  while (reportBody.nextElementSibling) {
    const next = reportBody.nextElementSibling;
    if (next.tagName === 'DIALOG') break;
    reportBody.append(next);
  }
  const originalFormHost = form.parentElement;
  const sourceHost = element('div', 'paper-source-host workspace');
  reportBody.prepend(sourceHost);

  function currentMode() {
    if (documentPages.classList.contains('layout-edit-mode')) return 'layout';
    if (documentPages.classList.contains('parent-preview-mode') && !documentPages.classList.contains('hidden')) return 'preview';
    return 'other';
  }

  function setMode(mode) {
    setReportDisplayMode(mode, { resetEditors: false });
  }

  function goToChapter(selector) {
    if (currentMode() === 'other') setMode('layout');
    jump($(selector));
  }

  const reportNav = workspace(reportView, reportBody, [
    ['summary', '试听总结', () => sourceSnapshot ? jump(summary) : goToChapter('.summary-page')],
    ['plan', '课程规划', () => sourceSnapshot ? jump(plan) : goToChapter('.reference-plan-page')],
    ['cover', '封面与附页', () => goToChapter('.cover-page')],
    ['quality', '质量检查', () => {
      const quality = $('#report-quality-notice');
      quality.querySelector('details').open = true;
      jump(quality);
    }],
    ['sales', '销售跟进卡', () => originalTab('sales').click()],
  ]);

  const courseBar = element('div', 'paper-course-bar');
  courseBar.append(element('strong', '', '课程规划'));
  const courseActions = element('div', 'paper-course-actions');
  courseBar.append(courseActions);
  const stageJump = element('details', 'paper-stage-jump');
  const stageToggle = element('summary', '', '跳转阶段');
  const stageChoices = element('div', 'paper-stage-choices');
  stageJump.append(stageToggle, stageChoices);
  courseActions.append(stageJump);

  let selectedCourseStage = 0;
  function markCurrentCourseStage() {
    for (const choice of stageChoices.children) {
      if (Number(choice.dataset.stageIndex) === selectedCourseStage) choice.setAttribute('aria-current', 'true');
      else choice.removeAttribute('aria-current');
    }
  }

  function jumpToStage(stageIndex) {
    if (currentMode() === 'other') setMode('layout');
    const section = documentPages.querySelector(`.plan-stage-group[data-stage-index="${stageIndex}"]`);
    if (section) {
      selectedCourseStage = Number(stageIndex);
      markCurrentCourseStage();
      reportNav.highlight('plan');
      jump(section);
    }
  }

  document.addEventListener('pointerdown', event => {
    if (stageJump.open && !stageJump.contains(event.target)) stageJump.open = false;
  });
  stageJump.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !stageJump.open) return;
    stageJump.open = false;
    stageToggle.focus();
  });
  documentPages.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#report-"]');
    if (!link || link.hash.length < 2) return;
    const destination = document.getElementById(link.hash.slice(1));
    if (!destination) return;
    event.preventDefault();
    const stage = destination.querySelector('.plan-stage-group') || destination.closest('.plan-stage-group');
    if (stage) {
      selectedCourseStage = Number(stage.dataset.stageIndex);
      markCurrentCourseStage();
    }
    reportNav.highlight(destination.matches('.summary-page') ? 'summary' : 'plan');
    jump(stage && destination.matches('.report-page') ? stage : destination);
  });
  const openPlan = mountPlanEditor({ getCoursePlan, commitCoursePlan, onApply: () => reportNav.activate('plan') });
  const planTools = button('调整课次结构', () => openPlan(selectedCourseStage), 'secondary-btn paper-course-edit');
  courseActions.append(planTools);
  const regenerate = $('#regenerate-report');
  regenerate.addEventListener('click', async () => {
    const snapshot = collectFormDraft();
    regenerate.disabled = true;
    try {
      if (!await prepareSourceEdit()) return;
      if (currentMode() === 'other') setMode('layout');
      sourceSnapshot = snapshot;
      reportView.classList.add('paper-source-editing');
      sourceHost.append(form);
      $('.report-actions').append(generate);
      generate.textContent = '更新报告';
      reportNav.activate(reportNav.current() === 'plan' ? 'plan' : 'summary');
    } catch (error) {
      reportError(error);
    } finally {
      regenerate.disabled = false;
    }
  });
  const cancelSource = button('取消修改', () => {
    if (form.getAttribute('aria-busy') === 'true') return;
    const chapter = reportNav.current();
    leaveSource(true);
    setMode('layout');
    reportNav.activate(chapter);
  }, 'secondary-btn paper-source-cancel');
  $('.report-actions').prepend(cancelSource);
  $('#report-title').before(element('p', 'eyebrow paper-source-status', '正在修改生成资料'));

  function leaveSource(cancel) {
    const snapshot = sourceSnapshot;
    sourceSnapshot = null;
    reportView.classList.remove('paper-source-editing');
    originalFormHost.append(form);
    draftToolbar.append(generate);
    if (cancel) cancelSourceEdit(snapshot);
    generate.textContent = '生成报告';
  }

  const mobileNavigation = $('#report-view .paper-mobile-nav');

  function updateStageChoices() {
    const labels = new Map();
    for (const stage of documentPages.querySelectorAll('.plan-stage-group[data-stage-index]')) {
      const index = stage.dataset.stageIndex;
      if (!labels.has(index)) labels.set(index, stage.dataset.stageName);
    }
    stageChoices.replaceChildren();
    for (const [index, name] of labels) {
      const choice = button('', () => {
        stageJump.open = false;
        stageToggle.focus({ preventScroll: true });
        jumpToStage(index);
      }, 'paper-stage-choice');
      choice.append(element('span', 'paper-stage-number', String(Number(index) + 1).padStart(2, '0')),
        element('span', 'paper-stage-choice-label', name || `阶段 ${Number(index) + 1}`));
      choice.dataset.stageIndex = index;
      stageChoices.append(choice);
    }
    markCurrentCourseStage();
    stageJump.hidden = labels.size === 0;
  }
  new MutationObserver(updateStageChoices).observe(documentPages, { childList: true });
  updateStageChoices();
  const mobileControls = element('div', 'paper-mobile-controls');
  mobileNavigation.before(mobileControls);
  mobileControls.append(mobileNavigation);
  const zoomControls = element('div', 'paper-zoom');
  zoomControls.setAttribute('role', 'group');
  zoomControls.setAttribute('aria-label', '报告缩放');

  let zoomSteps = 0;
  const fullPageWidth = 210 * 96 / 25.4;
  const zoomOut = button('−', () => changeZoom(zoomSteps - 1));
  const zoomIn = button('+', () => changeZoom(zoomSteps + 1));
  const fitWidth = button('适宽', () => changeZoom(0));
  zoomOut.setAttribute('aria-label', '缩小报告');
  zoomIn.setAttribute('aria-label', '放大报告');
  fitWidth.setAttribute('aria-label', '报告适配屏宽');
  zoomControls.append(zoomOut, fitWidth, zoomIn);
  mobileControls.append(zoomControls);
  const compactCourseBar = window.matchMedia('(max-width: 1050px)');
  function placeCourseBar() {
    (compactCourseBar.matches ? mobileControls : toolbar).append(courseBar);
  }
  compactCourseBar.addEventListener('change', placeCourseBar);
  placeCourseBar();

  function applyZoom() {
    const width = documentPages.clientWidth;
    if (!width) return;
    const scale = Math.min(1, width / fullPageWidth * 1.25 ** zoomSteps);
    documentPages.style.setProperty('--report-screen-zoom', String(scale));
    zoomOut.disabled = zoomSteps === 0;
    zoomIn.disabled = scale >= 1;
    fitWidth.textContent = zoomSteps === 0 ? '适宽' : `${Math.round(scale * 100)}%`;
    if (zoomSteps === 0) documentPages.scrollLeft = 0;
  }

  function changeZoom(steps) {
    const readingLine = Math.max(80, mobileControls.getBoundingClientRect().bottom + 16);
    const page = [...documentPages.querySelectorAll('.report-page')].find(sheet => {
      const bounds = sheet.getBoundingClientRect();
      return bounds.height > 0 && bounds.bottom > readingLine;
    });
    const before = page?.getBoundingClientRect();
    zoomSteps = steps;
    applyZoom();
    if (page && before.height) {
      const after = page.getBoundingClientRect();
      const offset = Math.max(0, readingLine - before.top) / before.height;
      window.scrollBy({ top: after.top + offset * after.height - before.top - offset * before.height, behavior: 'instant' });
    }
  }
  new ResizeObserver(applyZoom).observe(documentPages);

  let wasReport = false;
  function updateReport() {
    const active = reportView.classList.contains('active');
    if (sourceSnapshot && (!active || currentMode() === 'other')) {
      const chapter = reportNav.current();
      leaveSource(!active);
      if (active) {
        setMode('layout');
        reportNav.activate(chapter);
      }
    }
    if (active && !wasReport) {
      wasReport = true;
      selectedCourseStage = 0;
      markCurrentCourseStage();
      if (!isQuickPreview()) {
        setMode('layout');
        reportNav.activate('summary');
      }
    }
    reportView.classList.toggle('paper-sample', active && isQuickPreview());
    if (!active && wasReport) {
      wasReport = false;
      zoomSteps = 0;
      applyZoom();
    }
    const mode = currentMode();
    zoomControls.hidden = mode === 'other';
    const label = mode === 'preview' ? '继续编辑' : mode === 'other' ? '返回报告' : '家长版预览';
    if (modeButton.textContent !== label) modeButton.textContent = label;
  }

  const observer = new MutationObserver(updateReport);
  observer.observe(reportView, { attributes: true, attributeFilter: ['class'] });
  observer.observe(documentPages, { attributes: true, attributeFilter: ['class'] });
  const generationState = new MutationObserver(() => {
    cancelSource.disabled = form.getAttribute('aria-busy') === 'true';
  });
  generationState.observe(form, { attributes: true, attributeFilter: ['aria-busy'] });
  $('.sidebar nav').addEventListener('click', (event) => {
    if (sourceSnapshot && form.getAttribute('aria-busy') === 'true') event.stopPropagation();
  }, { capture: true });
  updateReport();

  let scrollFrame = 0;
  function syncChapterOnScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const draftView = $('#new-view');
      const inDraft = draftView.classList.contains('active');
      const view = inDraft ? draftView : reportView;
      if (!view.classList.contains('active')) return;
      if (!inDraft && !sourceSnapshot && currentMode() === 'other') return;
      const nav = inDraft ? draftNav : reportNav;
      const marker = stickyOffset(view) + Math.min(innerHeight * 0.16, 115);
      const candidates = inDraft || sourceSnapshot
        ? [[summary, 'summary'], [plan, 'plan']]
        : [...documentPages.querySelectorAll('.report-page')].map((page) => [
          page, page.matches('.summary-page') ? 'summary' : page.matches('.reference-plan-page') ? 'plan' : 'cover',
        ]);
      const quality = $('#report-quality-notice');
      const qualityBounds = quality.getBoundingClientRect();
      if (!inDraft && !sourceSnapshot && quality.querySelector('details[open]') && qualityBounds.top <= marker && qualityBounds.bottom >= marker) {
        if (nav.current() !== 'quality') nav.highlight('quality');
        return;
      }
      let chapter = null;
      for (const [page, key] of candidates) {
        if (!page.getClientRects().length) continue;
        if (page.getBoundingClientRect().top > marker) break;
        chapter = key;
      }
      if (chapter && chapter !== nav.current()) nav.highlight(chapter);
    });
  }
  window.addEventListener('scroll', syncChapterOnScroll, { passive: true });
  window.addEventListener('resize', syncChapterOnScroll);
}
