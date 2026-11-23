import { ALLOWED_DURATIONS, calculateTotalHours, createLesson, createStage, moveItem, validateCoursePlan } from './course-plan-utils.js';

export function mountPlanEditor({ getCoursePlan, commitCoursePlan, onApply }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'paper-plan-dialog';
  dialog.setAttribute('aria-labelledby', 'paper-plan-heading');
  dialog.innerHTML = `
    <header><div><h2 id="paper-plan-heading">调整课次结构</h2><p class="paper-plan-total"></p></div>
      <button type="button" class="secondary-btn paper-plan-add-stage" data-add-stage>＋ 新增阶段</button>
    </header>
    <div class="paper-plan-body">
      <nav class="paper-plan-stage-list" aria-label="选择和排序阶段"></nav>
      <div class="paper-plan-scroll"></div>
    </div>
    <footer><button type="button" class="secondary-btn paper-plan-restore" data-restore-plan>恢复原始规划</button><p class="paper-plan-error" role="alert" hidden></p>
      <button type="button" class="secondary-btn" data-cancel-plan>取消</button>
      <button type="button" class="secondary-btn paper-plan-apply" data-apply-plan>应用到报告</button>
    </footer>`;
  document.body.append(dialog);
  const list = dialog.querySelector('.paper-plan-scroll');
  const stageList = dialog.querySelector('.paper-plan-stage-list');
  const total = dialog.querySelector('.paper-plan-total');
  const message = dialog.querySelector('.paper-plan-error');
  let plan, original, uploaded, startingHours, expandedLessons;
  let activeStage = 0;


  function updateTotals() {
    plan.totalHours = calculateTotalHours(plan);
    const lessons = plan.stages.reduce((sum, stage) => sum + stage.lessons.length, 0);
    total.textContent = `${plan.totalHours} 小时 · ${plan.stages.length} 个阶段 · ${lessons} 节课`;
  }

  function input(value, label, update, multiline = false) {
    const field = document.createElement(multiline ? 'textarea' : 'input');
    field.setAttribute('aria-label', label);
    field.value = value ?? '';
    if (multiline) field.rows = 2;
    field.addEventListener('input', () => update(field.value));
    return field;
  }

  function action(text, label, handler, disabled = false) {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = text;
    control.className = 'secondary-btn';
    control.setAttribute('aria-label', label);
    control.title = label;
    control.disabled = disabled;
    control.addEventListener('click', handler);
    return control;
  }

  function refresh(focusSelector) {
    const scrollTop = list.scrollTop;
    render();
    list.scrollTop = scrollTop;
    if (focusSelector) list.querySelector(focusSelector)?.focus();
  }

  function reorderStage(from, to, focusGrip = false) {
    if (from === to || to < 0 || to >= plan.stages.length) return;
    const selected = plan.stages[activeStage];
    plan.stages = moveItem(plan.stages, from, to);
    activeStage = plan.stages.indexOf(selected);
    const stageScroll = stageList.scrollTop;
    const stageScrollLeft = stageList.scrollLeft;
    refresh();
    stageList.scrollTop = stageScroll;
    stageList.scrollLeft = stageScrollLeft;
    if (focusGrip) stageList.querySelector(`[data-stage-grip="${to}"]`)?.focus({ preventScroll: true });
  }

  let drag = null;

  // Gaps between stage rows are valid drop targets too.
  function closestStage(x, y) {
    const bounds = stageList.getBoundingClientRect();
    if (x < bounds.left - 16 || x > bounds.right + 16 || y < bounds.top - 16 || y > bounds.bottom + 16) return null;
    const horizontal = matchMedia('(max-width: 720px)').matches;
    const cursor = horizontal ? x : y;
    let nearest = null;
    let distance = Infinity;
    for (const row of stageList.children) {
      const rect = row.getBoundingClientRect();
      const gap = Math.abs(cursor - (horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2));
      if (gap < distance) {
        nearest = row;
        distance = gap;
      }
    }
    return nearest;
  }

  function updateDropTarget() {
    if (!drag?.started) return;
    const bounds = stageList.getBoundingClientRect();
    const { x, y } = drag;
    const inside = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    if (inside) {
      if (stageList.scrollHeight > stageList.clientHeight + 1) {
        if (y - bounds.top < 30) stageList.scrollTop -= 8;
        if (bounds.bottom - y < 30) stageList.scrollTop += 8;
      }
      if (stageList.scrollWidth > stageList.clientWidth + 1) {
        if (x - bounds.left < 30) stageList.scrollLeft -= 8;
        if (bounds.right - x < 30) stageList.scrollLeft += 8;
      }
    }
    const target = inside ? closestStage(x, y) : null;
    if (drag.target !== target) {
      drag.target?.removeAttribute('data-drop');
      drag.target = target;
      if (target) {
        const index = Number(target.dataset.stageItem);
        if (index !== drag.from) target.dataset.drop = index < drag.from ? 'before' : 'after';
      }
    }
    drag.frame = requestAnimationFrame(updateDropTarget);
  }

  stageList.addEventListener('pointerdown', event => {
    const grip = event.target.closest('[data-stage-grip]');
    if (!grip || event.button !== 0 || drag || plan.stages.length < 2) return;
    drag = { grip, from: Number(grip.dataset.stageGrip), pointer: event.pointerId,
      originX: event.clientX, originY: event.clientY, started: false, target: null, frame: 0 };
    grip.setPointerCapture(event.pointerId);
  });

  stageList.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.started || Math.hypot(drag.x - drag.originX, drag.y - drag.originY) < 5) return;
    drag.started = true;
    drag.grip.closest('.paper-plan-stage-item').classList.add('paper-plan-dragging');
    updateDropTarget();
  });

  function finishStageDrag(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const { grip, from, started, target, frame } = drag;
    drag = null;
    cancelAnimationFrame(frame);
    grip.closest('.paper-plan-stage-item')?.classList.remove('paper-plan-dragging');
    target?.removeAttribute('data-drop');
    if (event.type !== 'pointerup' || !started) return;
    const destination = closestStage(event.clientX, event.clientY);
    const suppressClick = (event) => {
      if (event.detail === 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    stageList.addEventListener('click', suppressClick, true);
    setTimeout(() => stageList.removeEventListener('click', suppressClick, true), 0);
    if (destination && stageList.contains(destination)) reorderStage(from, Number(destination.dataset.stageItem), true);
  }

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stageList.addEventListener(type, finishStageDrag);
  }

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openMenu = dialog.querySelector('.ant-dropdown-trigger[aria-expanded="true"], .ant-select [role="combobox"][aria-expanded="true"]');
    if (openMenu) event.preventDefault();
  }, true);

  dialog.addEventListener('close', () => {
    if (drag) finishStageDrag({ type: 'pointercancel', pointerId: drag.pointer });
  });

  stageList.addEventListener('keydown', event => {
    const grip = event.target.closest('[data-stage-grip]');
    const delta = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key];
    if (!grip || !delta) return;
    event.preventDefault();
    const from = Number(grip.dataset.stageGrip);
    reorderStage(from, from + delta, true);
  });

  function render() {
    updateTotals();
    message.hidden = true;
    list.replaceChildren();
    activeStage = Math.min(activeStage, plan.stages.length - 1);
    stageList.replaceChildren();
    for (const [index, stage] of plan.stages.entries()) {
      const stageControl = action('', `编辑阶段 ${index + 1}`, () => {
        activeStage = index;
        render();
        list.scrollTop = 0;
        stageList.querySelector('[aria-current]')?.focus({ preventScroll: true });
      });
      stageControl.className = 'paper-plan-stage-choice';
      stageControl.dataset.stageGrip = index;
      stageControl.setAttribute('aria-description', '可拖动整行，也可用方向键排序');
      stageControl.title = stage.title;
      if (index === activeStage) stageControl.setAttribute('aria-current', 'true');
      const number = document.createElement('span');
      number.className = 'paper-stage-number';
      number.textContent = String(index + 1).padStart(2, '0');
      const label = document.createElement('span');
      label.className = 'paper-stage-choice-label';
      label.textContent = stage.title || `阶段 ${index + 1}`;
      stageControl.append(number, label);
      const item = document.createElement('div');
      item.className = 'paper-plan-stage-item';
      item.dataset.stageItem = index;
      const arrows = document.createElement('div');
      arrows.className = 'paper-plan-arrows';
      for (const [delta, label] of [[-1, '上移'], [1, '下移']]) {
        const next = index + delta;
        arrows.append(action(delta < 0 ? '↑' : '↓', `${label}阶段 ${index + 1}`,
          () => reorderStage(index, next, true), next < 0 || next >= plan.stages.length));
      }
      item.append(arrows, stageControl);
      stageList.append(item);
    }
    const stageIndex = activeStage;
    const stage = plan.stages[stageIndex];
    let lessonNumber = plan.stages.slice(0, stageIndex).reduce((number, entry) => number + entry.lessons.length, 0);
    const group = document.createElement('section');
    group.dataset.planStage = stageIndex;
    const title = document.createElement('header');
    title.className = 'paper-plan-stage';
    const badge = document.createElement('strong');
    badge.textContent = `阶段 ${stageIndex + 1}`;
    const stageName = input(stage.title, `阶段 ${stageIndex + 1} 名称`, (value) => { stage.title = value; });
    stageName.dataset.stageName = '';
    stageName.maxLength = 100;
    stageName.addEventListener('input', () => {
      stageList.querySelector('[aria-current] .paper-stage-choice-label').textContent = stageName.value || `阶段 ${stageIndex + 1}`;
    });
    title.append(badge, stageName);
    title.append(action('删除阶段', `删除阶段 ${stageIndex + 1}`, () => {
      if (!window.confirm(`删除「${stage.title}」及其中 ${stage.lessons.length} 节课？`)) return;
      plan.stages.splice(stageIndex, 1);
      refresh(`[data-plan-stage="${Math.min(stageIndex, plan.stages.length - 1)}"] [data-stage-name]`);
    }, plan.stages.length === 1));
    group.append(title);
    const columns = document.createElement('div');
    columns.className = 'paper-plan-columns';
    columns.setAttribute('aria-hidden', 'true');
    columns.innerHTML = '<span>课次</span><span>课题</span><span>时长</span><span>操作</span>';
    group.append(columns);

    for (const [index, lesson] of stage.lessons.entries()) {
      lessonNumber += 1;
      const number = lessonNumber;
      const row = document.createElement('div');
      row.className = 'paper-plan-row';
      row.dataset.lessonRow = index;
      const order = document.createElement('span');
      order.textContent = `第 ${number} 课`;
      const theme = input(lesson.theme, `第 ${number} 课主题`, (value) => { lesson.theme = value; });
      theme.dataset.lessonTheme = '';
      theme.placeholder = '填写课题';
      theme.maxLength = 120;
      const duration = document.createElement('select');
      duration.setAttribute('aria-label', `第 ${number} 课时长`);
      for (const hours of ALLOWED_DURATIONS) duration.add(new Option(`${hours} 小时`, String(hours)));
      duration.value = String(lesson.duration);
      duration.addEventListener('change', () => {
        lesson.duration = Number(duration.value);
        updateTotals();
      });
      const actions = document.createElement('div');
      actions.className = 'paper-plan-lesson-actions';
      const arrows = document.createElement('div');
      arrows.className = 'paper-plan-arrows';
      const focusRow = (next) => `[data-plan-stage="${stageIndex}"] [data-lesson-row="${next}"] [data-lesson-theme]`;
      for (const [offset, label] of [[-1, '上移'], [1, '下移']]) {
        const next = index + offset;
        arrows.append(action(offset < 0 ? '↑' : '↓', `${label}第 ${number} 课`, () => {
          stage.lessons = moveItem(stage.lessons, index, next);
          refresh(focusRow(next));
        }, next < 0 || next >= stage.lessons.length));
      }
      actions.append(arrows);
      const detailToggle = action(expandedLessons.has(lesson) ? '收起' : '详情', `第 ${number} 课详情`, () => {
        if (expandedLessons.has(lesson)) expandedLessons.delete(lesson);
        else expandedLessons.add(lesson);
        refresh(`[data-lesson-row="${index}"] [data-lesson-details]`);
      });
      detailToggle.dataset.lessonDetails = '';
      detailToggle.setAttribute('aria-expanded', String(expandedLessons.has(lesson)));
      actions.append(detailToggle);
      actions.append(action('复制', `复制第 ${number} 课`, () => {
          const copy = structuredClone(lesson);
          delete copy.id;
          stage.lessons.splice(index + 1, 0, copy);
          if (expandedLessons.has(lesson)) expandedLessons.add(copy);
          refresh(focusRow(index + 1));
        }));
      actions.append(action('删除', `删除第 ${number} 课`, () => {
          stage.lessons.splice(index, 1);
          refresh(focusRow(Math.min(index, stage.lessons.length - 1)));
        }, stage.lessons.length === 1));
      const destination = document.createElement('select');
      destination.setAttribute('aria-label', `移动第 ${number} 课到其他阶段`);
      destination.add(new Option('移至阶段', ''));
      destination.options[0].disabled = true;
      destination.disabled = plan.stages.length < 2 || stage.lessons.length < 2;
      for (const [target, entry] of plan.stages.entries()) {
        if (entry !== stage) destination.add(new Option(`${target + 1}. ${entry.title || '未命名阶段'}`, String(target)));
      }
      destination.addEventListener('change', () => {
        if (!destination.value || destination.disabled) return;
        const target = Number(destination.value);
        stage.lessons.splice(index, 1);
        const newLength = plan.stages[target].lessons.push(lesson);
        activeStage = target;
        refresh(`[data-plan-stage="${target}"] [data-lesson-row="${newLength - 1}"] [data-lesson-theme]`);
      });
      actions.append(destination);
      row.append(order, theme, duration, actions);
      if (expandedLessons.has(lesson)) {
        const fields = document.createElement('div');
        fields.className = 'paper-plan-new-fields';
        for (const [key, label] of [['content', '课堂内容'], ['goal', '当课目标'], ['difficulty', '重难点']]) {
          const control = input(lesson[key], `第 ${number} 课${label}`, (value) => { lesson[key] = value; }, true);
          control.placeholder = label;
          control.maxLength = key === 'content' ? 600 : 180;
          const field = document.createElement('label');
          const caption = document.createElement('span');
          caption.textContent = label;
          field.append(caption, control);
          fields.append(field);
        }
        row.append(fields);
      }
      group.append(row);
    }
    group.append(action('+ 新增一课', `阶段 ${stageIndex + 1} 新增一课`, () => {
      const lesson = createLesson();
      expandedLessons.add(lesson);
      stage.lessons.push(lesson);
      refresh(`[data-plan-stage="${stageIndex}"] [data-lesson-row="${stage.lessons.length - 1}"] [data-lesson-theme]`);
    }));
    list.append(group);
  }

  dialog.querySelector('[data-add-stage]').addEventListener('click', () => {
    const stage = createStage();
    expandedLessons.add(stage.lessons[0]);
    plan.stages.push(stage);
    activeStage = plan.stages.length - 1;
    refresh(`[data-plan-stage="${plan.stages.length - 1}"] [data-stage-name]`);
  });
  const restore = dialog.querySelector('[data-restore-plan]');
  restore.addEventListener('click', () => {
    if (!window.confirm('用原始规划替换这张清单里的内容？')) return;
    plan = structuredClone(original);
    expandedLessons = new WeakSet();
    refresh();
  });
  dialog.querySelector('[data-cancel-plan]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-apply-plan]').addEventListener('click', () => {
    const checks = validateCoursePlan(plan, { allowSparseLessons: uploaded });
    if (!checks.valid) {
      message.textContent = checks.errors[0].message;
      message.hidden = false;
      return;
    }
    if (checks.warnings.length && !window.confirm(`${checks.warnings[0].message}。仍要应用吗？`)) return;
    if (plan.totalHours !== startingHours && !window.confirm(`总课时将从 ${startingHours} 小时改为 ${plan.totalHours} 小时。确认应用？`)) return;
    commitCoursePlan(plan);
    dialog.close();
    onApply();
  });

  return (stageIndex = 0) => {
    ({ plan, original, uploaded } = getCoursePlan());
    activeStage = stageIndex;
    restore.hidden = !original;
    startingHours = calculateTotalHours(plan);
    expandedLessons = new WeakSet();
    render();
    dialog.showModal();
    list.scrollTop = 0;
  };
}
