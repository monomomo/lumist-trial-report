import { mountPlanEditor } from './paper-plan-editor.js?v=1';
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
  const observation = element('div', 'analysis-box paper-observation');
  observation.id = 'draft-feedback';
  const conclusion = element('textarea', '');
  conclusion.id = 'parent-conclusion';
  conclusion.name = 'parentConclusion';
  conclusion.maxLength = SUMMARY_FIELD_RULES.overview.maximum;
  conclusion.placeholder = '留空时，AI 根据课堂记录起草结论';
  const conclusionLabel = element('label', 'textarea-label', '家长版试听结论（选填）');
  conclusionLabel.append(conclusion);
  observation.append(conclusionLabel);
  sourceNotes.querySelector('textarea').placeholder = '记录课堂内容、学生表现和建议，供生成报告参考…';
  sourceNotes.querySelector('textarea').setAttribute('aria-label', '课堂原始记录');
  const feedbackReview = $('.feedback-review');
  const schoolExams = element('div', '');
  schoolExams.append($('#school-exams'), $('#add-school-exam'));
  planning.querySelector('.generation-mode-tabs').after(disclosure('校内考试安排（选填）', schoolExams));
  feedbackReview.before(observation, sourceNotes);
  sourceNotes.after(element('p', 'paper-help', '课堂原始记录用于生成报告。家长看到上方填写或生成的结论。'));
  sourceNotes.after(disclosure('从群反馈整理课堂记录', feedbackReview));

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
    return ['.paper-chrome', '.paper-mobile-nav'].reduce((height, selector) => {
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

  const openPlan = mountPlanEditor({ getCoursePlan, commitCoursePlan, onApply: () => reportNav.activate('plan') });
  const planTools = button('调整课次结构', openPlan, 'paper-nav-item paper-context-action');
  reportNav.rail.querySelectorAll('.paper-nav-item')[1].after(planTools);
  const regenerate = $('#regenerate-report');
  regenerate.textContent = '修改生成资料';
  regenerate.className = 'paper-nav-item paper-source-action';
  reportNav.rail.append(regenerate);
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
  const tools = element('optgroup', '');
  tools.label = '报告操作';
  tools.append(new Option('调整课次结构', 'adjust'), new Option('修改生成资料', 'source'));
  mobileNavigation.append(tools);
  mobileNavigation.addEventListener('change', () => {
    if (mobileNavigation.value === 'adjust') {
      reportNav.highlight('plan');
      planTools.click();
    } else if (mobileNavigation.value === 'source') {
      reportNav.highlight('summary');
      regenerate.click();
    }
  });

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
      if (!isQuickPreview()) {
        setMode('layout');
        reportNav.activate('summary');
      }
    }
    reportView.classList.toggle('paper-sample', active && isQuickPreview());
    if (!active) wasReport = false;
    const mode = currentMode();
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
