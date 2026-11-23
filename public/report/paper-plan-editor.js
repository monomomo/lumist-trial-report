import { ALLOWED_DURATIONS, calculateTotalHours, createLesson, createStage, moveItem, validateCoursePlan } from './course-plan-utils.js';

export function mountPlanEditor({ getCoursePlan, commitCoursePlan, onApply }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'paper-plan-dialog';
  dialog.setAttribute('aria-labelledby', 'paper-plan-heading');
  dialog.innerHTML = `
    <header><div><h2 id="paper-plan-heading">调整课次结构</h2><p class="paper-plan-total"></p></div>
      <button type="button" class="secondary-btn" data-add-stage>新增阶段</button>
    </header>
    <div class="paper-plan-scroll"></div>
    <footer><button type="button" class="secondary-btn paper-plan-restore" data-restore-plan>恢复原始规划</button><p class="paper-plan-error" role="alert" hidden></p>
      <button type="button" class="secondary-btn" data-cancel-plan>取消</button>
      <button type="button" class="secondary-btn paper-plan-apply" data-apply-plan>应用到报告</button>
    </footer>`;
  document.body.append(dialog);
  const list = dialog.querySelector('.paper-plan-scroll');
  const total = dialog.querySelector('.paper-plan-total');
  const message = dialog.querySelector('.paper-plan-error');
  let plan, original, uploaded, startingHours, newLessons;

  function updateTotals() {
    plan.totalHours = calculateTotalHours(plan);
    const lessons = plan.stages.reduce((sum, stage) => sum + stage.lessons.length, 0);
    total.textContent = `${plan.totalHours} 小时 · ${plan.stages.length} 个阶段 · ${lessons} 节课`;
  }

  function input(value, label, update, multiline = false) {
    const field = document.createElement(multiline ? 'textarea' : 'input');
    field.setAttribute('aria-label', label);
    field.value = value;
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
    render();
    if (focusSelector) list.querySelector(focusSelector)?.focus();
  }

  function render() {
    updateTotals();
    message.hidden = true;
    list.replaceChildren();
    let lessonNumber = 0;
    for (const [stageIndex, stage] of plan.stages.entries()) {
      const group = document.createElement('section');
      group.dataset.planStage = stageIndex;
      const title = document.createElement('div');
      title.className = 'paper-plan-stage';
      const badge = document.createElement('strong');
      badge.textContent = `阶段 ${stageIndex + 1}`;
      const stageName = input(stage.title, `阶段 ${stageIndex + 1} 名称`, (value) => { stage.title = value; });
      stageName.dataset.stageName = '';
      title.append(badge, stageName);
      for (const [offset, symbol, label] of [[-1, '↑', '上移'], [1, '↓', '下移']]) {
        const next = stageIndex + offset;
        title.append(action(symbol, `${label}阶段 ${stageIndex + 1}`, () => {
          plan.stages = moveItem(plan.stages, stageIndex, next);
          refresh(`[data-plan-stage="${next}"] [data-stage-name]`);
        }, next < 0 || next >= plan.stages.length));
      }
      title.append(action('删除', `删除阶段 ${stageIndex + 1}`, () => {
        if (!window.confirm(`删除「${stage.title}」及其中 ${stage.lessons.length} 节课？`)) return;
        plan.stages.splice(stageIndex, 1);
        refresh(`[data-plan-stage="${Math.min(stageIndex, plan.stages.length - 1)}"] [data-stage-name]`);
      }, plan.stages.length === 1));
      group.append(title);

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
        const duration = document.createElement('select');
        duration.setAttribute('aria-label', `第 ${number} 课时长`);
        for (const hours of ALLOWED_DURATIONS) duration.add(new Option(`${hours} 小时`, String(hours)));
        duration.value = String(lesson.duration);
        duration.addEventListener('change', () => {
          lesson.duration = Number(duration.value);
          updateTotals();
        });
        const actions = document.createElement('div');
        actions.className = 'paper-plan-row-actions';
        const focusRow = (next) => `[data-plan-stage="${stageIndex}"] [data-lesson-row="${next}"] [data-lesson-theme]`;
        for (const [offset, symbol, label] of [[-1, '↑', '上移'], [1, '↓', '下移']]) {
          const next = index + offset;
          actions.append(action(symbol, `${label}第 ${number} 课`, () => {
            stage.lessons = moveItem(stage.lessons, index, next);
            refresh(focusRow(next));
          }, next < 0 || next >= stage.lessons.length));
        }
        actions.append(
          action('复制', `复制第 ${number} 课`, () => {
            const copy = structuredClone(lesson);
            stage.lessons.splice(index + 1, 0, copy);
            if (newLessons.has(lesson)) newLessons.add(copy);
            refresh(focusRow(index + 1));
          }),
          action('删除', `删除第 ${number} 课`, () => {
            stage.lessons.splice(index, 1);
            refresh(focusRow(Math.min(index, stage.lessons.length - 1)));
          }, stage.lessons.length === 1),
        );
        if (plan.stages.length > 1 && stage.lessons.length > 1) {
          const destination = document.createElement('select');
          destination.setAttribute('aria-label', `移动第 ${number} 课到其他阶段`);
          destination.add(new Option('移至阶段…', ''));
          plan.stages.forEach((target, targetIndex) => {
            if (target !== stage) destination.add(new Option(`阶段 ${targetIndex + 1}`, String(targetIndex)));
          });
          destination.addEventListener('change', () => {
            if (!destination.value) return;
            const target = Number(destination.value);
            stage.lessons.splice(index, 1);
            const newLength = plan.stages[target].lessons.push(lesson);
            refresh(`[data-plan-stage="${target}"] [data-lesson-row="${newLength - 1}"] [data-lesson-theme]`);
          });
          actions.append(destination);
        }
        row.append(order, theme, duration, actions);
        if (newLessons.has(lesson)) {
          const fields = document.createElement('div');
          fields.className = 'paper-plan-new-fields';
          for (const [key, label] of [['content', '课堂内容'], ['goal', '当课目标'], ['difficulty', '重难点']]) {
            const control = input(lesson[key], `第 ${number} 课${label}`, (value) => { lesson[key] = value; }, true);
            control.placeholder = label;
            fields.append(control);
          }
          row.append(fields);
        }
        group.append(row);
      }
      group.append(action('+ 新增一课', `阶段 ${stageIndex + 1} 新增一课`, () => {
        const lesson = createLesson();
        newLessons.add(lesson);
        stage.lessons.push(lesson);
        refresh(`[data-plan-stage="${stageIndex}"] [data-lesson-row="${stage.lessons.length - 1}"] [data-lesson-theme]`);
      }));
      list.append(group);
    }
  }

  dialog.querySelector('[data-add-stage]').addEventListener('click', () => {
    const stage = createStage();
    newLessons.add(stage.lessons[0]);
    plan.stages.push(stage);
    refresh(`[data-plan-stage="${plan.stages.length - 1}"] [data-stage-name]`);
  });
  const restore = dialog.querySelector('[data-restore-plan]');
  restore.addEventListener('click', () => {
    if (!window.confirm('用原始规划替换这张清单里的内容？')) return;
    plan = structuredClone(original);
    newLessons = new WeakSet();
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

  return () => {
    ({ plan, original, uploaded } = getCoursePlan());
    restore.hidden = !original;
    startingHours = calculateTotalHours(plan);
    newLessons = new WeakSet();
    render();
    dialog.showModal();
    list.scrollTop = 0;
  };
}
