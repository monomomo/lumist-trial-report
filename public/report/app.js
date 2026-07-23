const sampleOne = '我刚上了一节SAT数学试听课。根据课前沟通，学生已经不记得SAT数学的知识点了。所以我们计划从头开始梳理知识点，同学上课互动很积极，做题的正确率也挺好的，中等难度的题也可以做对，没有她自己说的那么基础差。但是确实是有些知识点有遗忘。所以我计划接下来先从头补知识点，让同学建立SAT数学知识图谱。';
const sampleTwo = '学生课上挺活泼的，爱互动，愿意思考，做题的准确率其实很不错。因为学生不了解SAT考点，第一节课带学生看了SAT的4章内容。学生现在在学微积分，所以Algebra的内容比较熟练，但因为比较久没有接触概率、几何的东西，这两章相对薄弱。';

const $ = (selector) => document.querySelector(selector);
const setText = (selector, value) => { $(selector).textContent = value; };

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

function formatHourPlanTables() {
  const sourcePages = Array.from(document.querySelectorAll('.hour-plan'));
  const lessons = sourcePages.flatMap((page) => Array.from(page.querySelectorAll('tbody tr')).map((row) => {
    const cells = row.querySelectorAll('td');
    return { theme: cells[1].textContent, content: cells[2].textContent, goal: cells[3].textContent };
  }));
  const pagePlans = [
    [0, 10, '阶段一 · 知识框架与基础恢复', '建立 SAT 数学知识地图，恢复代数、函数、数据与基础几何'],
    [10, 10, '阶段二 · 专项突破与工具提速', '补齐几何与三角模块，建立 Desmos、错因定位和限时策略'],
    [20, 10, '阶段三 · 高分稳定与考前闭环', '通过高难题、套题复盘、完整模考和考前清单稳定考试表现']
  ];
  sourcePages.forEach((page) => page.remove());
  const teacherPage = document.querySelector('.teacher-page');
  pagePlans.forEach(([start, count, title, description], pageIndex) => {
    const chunk = lessons.slice(start, start + count);
    const page = document.createElement('article');
    const totalCell = pageIndex === 0 ? '<b>30h</b><span>建议总课时</span>' : '<span>课程规划<br />续</span>';
    const rows = chunk.map((lesson, index) => {
      const lessonNumber = String(start + index + 1).padStart(2, '0');
      const duration = '1h';
      const total = index === 0 ? `<td class="plan-total-cell" rowspan="${chunk.length}">${totalCell}</td>` : '';
      return `<tr>${total}<td class="plan-duration-cell">${duration}</td><td class="plan-detail-cell"><b>考点 ${lessonNumber} · ${lesson.theme}</b><p><span>目标：</span>${lesson.goal}</p><p><span>内容：</span>${lesson.content}</p><p><span>重难点：</span>${hourPlanDifficulties[start + index]}</p></td></tr>`;
    }).join('');
    page.className = 'report-page hour-plan reference-plan-page';
    page.innerHTML = `<div class="page-kicker">02 / 详细课程规划 · ${String(pageIndex + 1).padStart(2, '0')}</div><h2>${title}</h2><p class="reference-plan-intro">${description}</p><table><thead><tr><th>总建议课时</th><th>课时分配</th><th>课堂安排</th></tr></thead><tbody>${rows}</tbody></table>${pageIndex === pagePlans.length - 1 ? '<div class="plan-note"><strong>动态调整原则：</strong>课时可按 0.5h、1h、1.5h 或 2h 灵活拆分；以套题错因、用时与实际掌握度为准动态调整。</div>' : ''}</article>`;
    teacherPage.before(page);
  });
}

function deriveReport(notes, name, target) {
  const hasCalculus = /微积分|Algebra|代数/.test(notes);
  const hasForget = /不记得|遗忘|从头|基础差/.test(notes);
  const hasGeometry = /几何/.test(notes);
  const hasProbability = /概率|数据/.test(notes);
  const positive = /活泼|互动积极|爱互动/.test(notes) ? '课堂互动积极，愿意主动表达与思考' : '课堂投入度良好，能够跟随讲解完成思考';
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
  return { overview, positive, accuracy, strength, priorities, lessonText, outcomes, needs, urgent, script, target: target || '待老师确认' };
}

function renderReport() {
  const name = $('#student-name').value.trim() || '学生';
  const target = $('#target-score').value.trim();
  const notes = $('#teacher-notes').value.trim();
  const data = deriveReport(notes, name, target);
  setText('#report-title', `${name}个性化学习报告`);
  setText('#info-name', name);
  setText('#info-target', data.target);
  setText('#overview-text', data.overview);
  setText('#classroom-text', data.positive);
  setText('#strength-text', data.strength);
  setText('#priority-text', data.priorities.join('、'));
  setText('#lesson-title', /四章|4章/.test(notes) ? 'SAT 数学四大章节框架与诊断' : 'SAT 数学知识图谱与诊断');
  setText('#lesson-text', data.lessonText);
  setText('#performance-text', `${data.positive}；${data.accuracy}。`);
  $('#outcomes-list').innerHTML = data.outcomes.map((item) => `<li>${item}</li>`).join('');
  $('#needs-list').innerHTML = data.needs.map((item) => `<span>${item}</span>`).join('');
  setText('#sales-positive', `${data.positive}，${data.accuracy}。`);
  setText('#sales-urgent', data.urgent);
  setText('#sales-angle', '建议以“先建立完整框架，再针对真实薄弱点专项补强”为续课切入点，突出课程会依据套题错题与用时动态调整。');
  setText('#sales-script', data.script);
}

function changeView(id) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${id}-view`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function collectCoursePlan() {
  return Array.from(document.querySelectorAll('.reference-plan-page')).map((page) => ({
    stage: page.querySelector('h2').textContent,
    description: page.querySelector('.reference-plan-intro').textContent,
    lessons: Array.from(page.querySelectorAll('tbody tr')).map((row) => ({
      duration: row.querySelector('.plan-duration-cell').textContent,
      detail: row.querySelector('.plan-detail-cell').textContent.trim()
    }))
  }));
}

async function saveReport() {
  const reportStatus = document.querySelector('#report-view .eyebrow');
  reportStatus.textContent = '正在保存报告';
  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentName: $('#student-name').value.trim(),
      currentScore: $('#current-score').value.trim(),
      targetScore: $('#target-score').value.trim(),
      examDate: $('#exam-date').value.trim(),
      teacherNotes: $('#teacher-notes').value.trim(),
      subject: 'SAT 数学',
      reportData: {
        overview: $('#overview-text').textContent,
        classroom: $('#classroom-text').textContent,
        strength: $('#strength-text').textContent,
        priority: $('#priority-text').textContent,
        outcomes: Array.from($('#outcomes-list').children).map((item) => item.textContent)
      },
      coursePlan: { totalHours: 30, stages: collectCoursePlan() },
      salesFollowUp: {
        positive: $('#sales-positive').textContent,
        urgent: $('#sales-urgent').textContent,
        angle: $('#sales-angle').textContent,
        script: $('#sales-script').textContent
      }
    })
  });
  const result = await response.json();
  reportStatus.textContent = result.saved ? '报告已生成 · 已保存' : '报告已生成 · 本地演示';
}

$('#report-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  renderReport();
  changeView('report');
  try {
    await saveReport();
  } catch {
    document.querySelector('#report-view .eyebrow').textContent = '报告已生成 · 保存失败';
  }
});
$('#sample-one').addEventListener('click', () => { $('#teacher-notes').value = sampleOne; });
$('#sample-two').addEventListener('click', () => { $('#teacher-notes').value = sampleTwo; });
document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => changeView(item.dataset.view)));
$('#open-history').addEventListener('click', () => { renderReport(); changeView('report'); });
$('#back-edit').addEventListener('click', () => changeView('new'));
$('#print-report').addEventListener('click', () => window.print());
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  const isParent = tab.dataset.reportTab === 'parent';
  document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab));
  $('#parent-report').classList.toggle('hidden', !isParent);
  $('#sales-card').classList.toggle('hidden', isParent);
}));
$('#copy-script').addEventListener('click', async () => { await navigator.clipboard.writeText($('#sales-script').textContent); $('#copy-script').textContent = '已复制'; setTimeout(() => { $('#copy-script').textContent = '复制话术'; }, 1200); });
formatHourPlanTables();

document.querySelectorAll('.hour-plan .page-kicker').forEach((label, index) => {
  label.textContent = `02 / 详细课程规划 · ${String(index + 1).padStart(2, '0')}`;
});

document.querySelector('.teacher-page .page-kicker').textContent = '03 / 任课教师';

document.querySelector('.teacher-intro').innerHTML = `<p class="teacher-label">SAT 数学 / AP 数学与计算机课程导师</p><h2>Amber 老师</h2><p class="teacher-summary">用清晰的知识框架与真实题目训练，帮助学生把已有数学基础稳定转化为考试表现。</p><div class="teacher-sections"><section><h3>教育背景</h3><p>华盛顿大学数学专业本科，佐治亚理工大学计算机硕士；专业课程平均绩点 3.8/4.0。AP Calculus BC 5 分，SAT 数学满分。</p></section><section><h3>擅长领域</h3><p>AP Precalculus、AP Calculus AB/BC、SAT 数学，以及 Java/Python、数据结构与算法等计算机课程。</p></section><section><h3>教学风格</h3><p>以真题与典型题搭建解题路径；围绕学生薄弱点制定个性化计划，并兼顾考试表现与长期学科发展。</p></section></div><div class="teacher-tags"><span>SAT 数学</span><span>AP Calculus</span><span>APCSA</span></div>`;

document.querySelector('.data-impact-page').innerHTML = '<img src="assets/lumist-data-page-6.png" alt="路觅教育数据" />';

renderReport();
