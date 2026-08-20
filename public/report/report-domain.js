/**
 * 浏览器端领域函数：科目视图模型、教师资料归一化、兜底报告生成。
 * 纯函数，不依赖 DOM 或 fetch，方便测试和复用。
 */
import { SUBJECT_CATALOG, SUBJECT_CODES, resolveSubject } from './catalog.js';
import { PLANNING_FOCUS_AREAS, buildLessonDurationSlots, normalizePlanningFocusAreas, resolvePlanningScenario } from './planning-context.js';

/**
 * 创建科目视图模型，用于 HTML 渲染。
 * @param {string} subjectCode
 * @returns {SubjectViewModel}
 */
export function createSubjectViewModel(subjectCode) {
  const subject = resolveSubject(subjectCode);
  return {
    code: subject.code,
    displayName: subject.displayName,
    scoreLabel: subject.scoreLabel,
    scoreMin: subject.scoreMin,
    scoreMax: subject.scoreMax,
    scoreStep: subject.scoreStep,
    modules: subject.modules,
    moduleList: subject.modules.join('、'),
  };
}

/**
 * @typedef {ReturnType<createSubjectViewModel>} SubjectViewModel
 */

/**
 * 标准化教师 API 响应为展示数据；API 不可用或返回错误时返回 null。
 * @param {{ displayName?: string; title?: string; summary?: string; bio?: string[]; sections?: Array<{ title?: string; content?: string[] }>; subjects?: string[]; photoUrl?: string; qrUrl?: string } | null} apiData
 * @returns {TeacherDisplayData | null}
 */
export function normalizeTeacherProfile(apiData) {
  if (!apiData || typeof apiData !== 'object' || apiData.error) return null;
  const name = apiData.displayName || '老师';
  return {
    displayName: name,
    displayPlaceholder: name.charAt(0),
    title: apiData.title || '',
    summary: apiData.summary || '',
    bio: Array.isArray(apiData.bio) ? apiData.bio : [],
    sections: Array.isArray(apiData.sections)
      ? apiData.sections
        .filter((section) => section && section.title && section.title.trim() !== '语言能力' && Array.isArray(section.content))
        .map((section) => ({ title: section.title, content: section.content.filter(Boolean) }))
      : [],
    subjects: Array.isArray(apiData.subjects) ? apiData.subjects.filter(Boolean) : [],
    photoUrl: apiData.photoUrl || null,
    qrUrl: apiData.qrUrl || null,
  };
}

export function resolveTargetScore(subjectCode, targetScore) {
  const provided = String(targetScore || '').trim();
  if (provided) return provided;
  return subjectCode.startsWith('ap_') ? '5' : '';
}

/**
 * @typedef {{ displayName: string; displayPlaceholder: string; title: string; summary: string; bio: string[]; sections: Array<{ title: string; content: string[] }>; subjects: string[]; photoUrl: string | null; qrUrl: string | null }} TeacherDisplayData
 */

/**
 * 判断某个 API 错误码是否可以走本地兜底生成。
 * @param {string} errorCode
 * @returns {boolean}
 */
export function canUseFallback(errorCode) {
  return ['AI_GENERATION_FAILED', 'EMPTY_MODEL_OUTPUT', 'AI_SERVICE_NOT_CONFIGURED', 'SYSTEM_NOT_CONFIGURED']
    .includes(errorCode);
}

/**
 * 构建科目感知的兜底学情报告，在 AI 不可用时使用本地规则生成。
 *
 * @param {string} subjectCode 科目编码。
 * @param {{ studentName: string; currentScore: string; targetScore: string; examDate: string; teacherNotes: string }} formData 表单原始数据。
 * @returns {object} 与 AI 生成报告结构兼容的报告数据。
 */
export function buildFallbackReport(subjectCode, formData) {
  const vm = createSubjectViewModel(subjectCode);
  const name = formData.studentName || '学生';
  const target = resolveTargetScore(subjectCode, formData.targetScore) || '待老师确认';
  const notes = formData.teacherNotes || '';
  const totalHours = normalizeFallbackTotalHours(formData.totalHours);
  const planningScenario = resolvePlanningScenario(formData.planningScenario);
  const planningFocusAreas = normalizePlanningFocusAreas(formData.planningFocusAreas, subjectCode);
  const lessonDurations = buildLessonDurationSlots(totalHours, formData.lessonCount);
  const coursePlan = applyFallbackPlanningFocus(
    resizeFallbackCoursePlan(buildGenericCoursePlan(vm), totalHours, lessonDurations),
    planningFocusAreas,
  );

  const positive = /活泼|互动积极|爱互动/.test(notes)
    ? '学生课堂互动积极，愿意主动表达与思考'
    : '学生能够跟随课堂讲解完成思考';
  const accuracy = /正确率|准确率|做对|中等难度/.test(notes)
    ? '我观察到学生能够完成部分中等难度题目'
    : '我会通过后续具体练习继续确认学生的实际掌握情况';

  return {
    overview: `本次试听课中，我先了解了${name}与${vm.displayName}课程的衔接情况。${positive}；${accuracy}。接下来我会结合具体作答过程定位易错点，并据此调整后续课程重点。`,
    classroomStatus: `课堂上，${positive}`,
    strength: /正确率|准确率|做对|中等难度/.test(notes) ? '我观察到学生具备继续提升的作答基础' : '我会在后续练习中确认学生已经稳定掌握的内容',
    currentFocus: `接下来我会先完成${vm.displayName}基础诊断，再按具体错因安排训练`,
    lessonTitle: `${vm.displayName}试听诊断与学习规划`,
    lessonSummary: `本节课中，我先从${vm.displayName}知识框架切入，了解学生目前的课程衔接与作答习惯。后续我会通过可复核的课堂任务继续确认各模块掌握情况。`,
    performance: `${positive}；${accuracy}。`,
    outcomes: [`我已初步了解学生与${vm.displayName}课程的衔接情况`, accuracy, '学生明确了接下来课堂练习的重点', `我会继续细化${vm.displayName}后续训练顺序`],
    priorityAreas: ['建立完整知识框架', ...(vm.modules.length > 2 ? vm.modules.slice(0, 2) : vm.modules)],
    planningContext: {
      scenario: planningScenario,
      lessonCount: lessonDurations.length,
      focusAreas: planningFocusAreas,
    },
    coursePlan,
    salesFollowUp: {
      positive: `${positive}，${accuracy}。`,
      urgent: `最需要优先解决的是建立${vm.displayName}知识框架以及对题型体系的熟悉度。如果缺少系统框架，学生即使有基础，也容易在陌生模块和限时作答中产生不必要失分。`,
      angle: '建议以"先建立完整框架，再针对真实薄弱点专项补强"为续课切入点，突出课程会依据诊断题错题与用时动态调整。',
      script: `今天老师反馈，${name}课堂上的状态很好，互动和思考都比较主动。\n\n当前最需要尽快解决的是建立完整的${vm.displayName}知识框架。老师建议先完成整体知识框架梳理，再针对薄弱模块做专项训练和题型适应，这样才能把已有基础更稳定地转化为考试表现。\n\n后续课程会结合每次诊断题的错题和用时动态调整，不会重复占用已经掌握模块的课时。`,
    },
    target,
  };
}

function applyFallbackPlanningFocus(coursePlan, focusAreas) {
  if (!focusAreas.length) return coursePlan;
  const focuses = focusAreas.map((code) => PLANNING_FOCUS_AREAS[code]).filter(Boolean);
  let lessonIndex = 0;
  const stages = coursePlan.stages.map((stage) => ({
    ...stage,
    lessons: stage.lessons.map((lesson) => {
      const focus = focuses[lessonIndex];
      lessonIndex += 1;
      if (!focus) return lesson;
      return {
        ...lesson,
        content: `${lesson.content}；${focus.guidance}`,
      };
    }),
  }));
  return {
    ...coursePlan,
    rationale: `${coursePlan.rationale} 本地兜底规划优先体现：${focuses.map((focus) => focus.label).join('、')}。`,
    stages,
  };
}

function normalizeFallbackTotalHours(value) {
  const totalHours = Number(value);
  return Number.isFinite(totalHours) && totalHours >= 2 && totalHours <= 60 && Number.isInteger(totalHours * 2)
    ? totalHours
    : 30;
}

function resizeFallbackCoursePlan(coursePlan, totalHours, durations) {
  const templates = coursePlan.stages.flatMap((stage) => stage.lessons);
  const lessons = durations.map((duration, index) => {
    const templateIndex = durations.length <= templates.length
      ? Math.round(index * (templates.length - 1) / Math.max(1, durations.length - 1))
      : index % templates.length;
    const cycle = Math.floor(index / templates.length);
    const template = templates[templateIndex];
    return {
      ...template,
      duration,
      theme: cycle > 0 ? `${template.theme} · 复测 ${cycle + 1}` : template.theme,
    };
  });
  const stageCount = Math.min(coursePlan.stages.length, lessons.length);
  const stages = Array.from({ length: stageCount }, (_, stageIndex) => {
    const start = Math.floor(stageIndex * lessons.length / stageCount);
    const end = Math.floor((stageIndex + 1) * lessons.length / stageCount);
    const sourceStage = coursePlan.stages[stageIndex];
    return {
      title: sourceStage.title,
      description: sourceStage.description,
      lessons: lessons.slice(start, end),
    };
  });
  return {
    ...coursePlan,
    totalHours,
    stages,
  };
}

/**
 * 按科目生成通用兜底课程规划。
 * @param {SubjectViewModel} vm
 * @returns {object}
 */
function buildGenericCoursePlan(vm) {
  const moduleCount = vm.modules.length;

  if (vm.code === 'sat_math') {
    // SAT 数学保留原有详细兜底
    return buildSatMathFallbackPlan();
  }

  // 通用兜底：3 个阶段，根据模块数分布课时
  const firstStageModules = vm.modules.slice(0, Math.min(4, moduleCount));
  const remainingModules = vm.modules.slice(firstStageModules.length);
  const remainingCount = remainingModules.length;

  const lessonsPerStage = Math.max(3, Math.min(6, Math.ceil(12 / 3)));

  function moduleLesson(module, order) {
    return {
      duration: 1,
      theme: `${module}基础梳理`,
      content: `核心概念讲解与${module}基础题型训练`,
      difficulty: `掌握${module}基本框架与核心思路`,
      goal: `建立${module}基础知识体系`,
    };
  }

  /** @type {{ title: string; description: string; lessons: { duration: number; theme: string; content: string; difficulty: string; goal: string }[] }[]} */
  const stages = [
    {
      title: '阶段一 · 知识框架与基础诊断',
      description: `建立${vm.displayName}知识地图，诊断薄弱模块`,
      lessons: firstStageModules.map((m) => moduleLesson(m, 0)),
    },
  ];

  if (remainingCount > 0 || lessonsPerStage > firstStageModules.length) {
    const stage2Lessons = remainingModules.length > 0
      ? remainingModules.slice(0, 4).map((m) => moduleLesson(m, 1))
      : Array.from({ length: 2 }, (_, i) => ({
          duration: 1,
          theme: `薄弱模块专项补强 ${i + 1}`,
          content: '针对诊断结果安排小专题训练与错题重做',
          difficulty: '消除重复性失分，建立个人避错清单',
          goal: '验证专项补强效果',
        }));

    stages.push({
      title: '阶段二 · 专项突破与查漏补缺',
      description: '针对诊断结果做专项补强与题型训练',
      lessons: stage2Lessons,
    });
  }

  stages.push({
    title: '阶段三 · 综合训练与考前准备',
    description: '通过完整模考、错题复盘和考前准备稳定考试表现',
    lessons: [
      {
        duration: 1,
        theme: '套题诊断与错因分析',
        content: '完整限时套题，按错题类型定位知识、方法、审题或时间问题',
        difficulty: '建立个人错题分类与追因框架',
        goal: '确认当前水平与薄弱模块优先级',
      },
      {
        duration: 1,
        theme: '薄弱点动态补强',
        content: '根据套题错因安排针对性小专题与限时重测',
        difficulty: '确保薄弱模块已闭环',
        goal: '确认薄弱点改善幅度',
      },
      {
        duration: 1,
        theme: '考前清单与考场策略',
        content: '整理错题、公式、时间分配与应考节奏',
        difficulty: '形成可执行的考前 Checklist',
        goal: '以稳定状态进入考试',
      },
    ],
  });

  const totalHours = stages.reduce((sum, stage) => sum + stage.lessons.reduce((s, l) => s + l.duration, 0), 0);

  return {
    totalHours,
    rationale: '先建立完整知识框架，再根据诊断题错因、用时与实际掌握度动态调整专项训练。',
    stages,
  };
}

/**
 * 保留 SAT 数学原有详细兜底规划。
 * @returns {object}
 */
function buildSatMathFallbackPlan() {
  const lessonData = [
    { theme: 'SAT 框架与首套题诊断', content: '四大模块、Bluebook 操作、诊断题', difficulty: '建立知识图谱与考试流程', goal: '建立知识图谱与考试流程' },
    { theme: '核心代数查漏', content: '方程、方程组、不等式', difficulty: '定位代数概念缺口', goal: '定位代数概念缺口' },
    { theme: '函数与图像', content: '函数表示、交点、表格', difficulty: '熟悉函数题的建模路径', goal: '熟悉函数题的建模路径' },
    { theme: '高阶数学 I', content: '二次函数、多项式、零点', difficulty: '提升复杂代数题处理能力', goal: '提升复杂代数题处理能力' },
    { theme: '高阶数学 II', content: '指数函数、非线性函数、含参题', difficulty: '掌握图像验证策略', goal: '掌握图像验证策略' },
    { theme: '数据分析与概率 I', content: '百分比、比率、单位换算', difficulty: '恢复常用应用题模型', goal: '恢复常用应用题模型' },
    { theme: '数据分析与概率 II', content: '条件概率、抽样推断、统计量', difficulty: '建立概率与数据题框架', goal: '建立概率与数据题框架' },
    { theme: '几何 I：角度与平行线', content: '角度关系、平行线、三角形', difficulty: '恢复基础图形关系', goal: '恢复基础图形关系' },
    { theme: '几何 II：全等与相似', content: '比例、面积比、体积比', difficulty: '掌握相似模型的识别', goal: '掌握相似模型的识别' },
    { theme: '几何 III：特殊三角形', content: '30-60-90、45-45-90、勾股', difficulty: '提高典型模型反应速度', goal: '提高典型模型反应速度' },
    { theme: '几何 IV：圆与弧', content: '圆心角、圆周角、切线、弧长', difficulty: '恢复圆相关定理与应用', goal: '恢复圆相关定理与应用' },
    { theme: '几何 V：坐标几何', content: '距离、中点、斜率、圆方程', difficulty: '建立坐标图形解题路径', goal: '建立坐标图形解题路径' },
    { theme: '几何 VI：三角比', content: '正弦、余弦、正切、弧度', difficulty: '解决三角函数基础遗忘', goal: '解决三角函数基础遗忘' },
    { theme: '几何 VII：综合题', content: '几何与代数、函数、比例结合', difficulty: '训练跨模块信息提取', goal: '训练跨模块信息提取' },
    { theme: 'Desmos I：基础工具', content: '方程、交点、表格、滑块', difficulty: '建立工具使用边界', goal: '建立工具使用边界' },
    { theme: 'Desmos II：提速策略', content: '回归、限制定义域、参数探索', difficulty: '形成手算/代入/工具选择清单', goal: '形成手算/代入/工具选择清单' },
    { theme: '套题复盘 I：错因定位', content: '首套完整 Report、错题重做', difficulty: '形成第一版个人错题清单', goal: '形成第一版个人错题清单' },
    { theme: '套题复盘 I：超时题', content: '逐题用时、跳题、回查', difficulty: '定位真实时间损耗点', goal: '定位真实时间损耗点' },
    { theme: '薄弱点动态补强', content: '根据首轮错因安排小专题', difficulty: '消除重复性失分', goal: '消除重复性失分' },
    { theme: '限时重测', content: '同类题限时训练与复盘', difficulty: '验证专项补强效果', goal: '验证专项补强效果' },
    { theme: '套题复盘 II：Module 1', content: '准确率、用时、题型分布', difficulty: '稳定基础模块完成质量', goal: '稳定基础模块完成质量' },
    { theme: '套题复盘 II：Module 2', content: '难题、跳题、时间止损', difficulty: '提升高难模块策略', goal: '提升高难模块策略' },
    { theme: 'Module 2 Hard I', content: '复杂建模、含参代数', difficulty: '训练 750+ 难题能力', goal: '训练 750+ 难题能力' },
    { theme: 'Module 2 Hard II', content: '综合几何与 Desmos 实战', difficulty: '缩短复杂题计算路径', goal: '缩短复杂题计算路径' },
    { theme: '套题复盘 III：重复错因', content: '追踪高频错误与超时题', difficulty: '建立个人避坑清单', goal: '建立个人避坑清单' },
    { theme: '高频薄弱点重测', content: '小专题限时重测', difficulty: '确认薄弱点已闭环', goal: '确认薄弱点已闭环' },
    { theme: '最终完整模考', content: '全流程限时完成', difficulty: '确认稳定分数区间', goal: '确认稳定分数区间' },
    { theme: '最终模考复盘', content: '最后错题、用时与策略', difficulty: '完成个人考场策略', goal: '完成个人考场策略' },
    { theme: '考前清单整理', content: '错题、Desmos、公式与节奏', difficulty: '形成可执行 Checklist', goal: '形成可执行 Checklist' },
    { theme: '考前闭环与答疑', content: '重点问题回顾、心态与流程', difficulty: '以稳定状态进入考试', goal: '以稳定状态进入考试' },
  ];

  const stageDefs = [
    { start: 0, count: 10, title: '阶段一 · 知识框架与基础恢复', description: '建立 SAT 数学知识地图，恢复代数、函数、数据与基础几何' },
    { start: 10, count: 10, title: '阶段二 · 专项突破与工具提速', description: '补齐几何与三角模块，建立 Desmos、错因定位和限时策略' },
    { start: 20, count: 10, title: '阶段三 · 高分稳定与考前闭环', description: '通过高难题、套题复盘、完整模考和考前清单稳定考试表现' },
  ];

  const stages = stageDefs.map(({ start, count, title, description }) => ({
    title,
    description,
    lessons: lessonData.slice(start, start + count).map((lesson) => ({ duration: 1, ...lesson })),
  }));

  return {
    totalHours: 30,
    rationale: '先建立完整知识框架，再根据套题错因、用时与实际掌握度动态调整专项训练。',
    stages,
  };
}
