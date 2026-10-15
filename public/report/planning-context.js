const SCENARIOS = {
  preview: {
    label: '预习',
    guidance: '先建立课程框架、核心概念和英文术语适应，再通过基础练习检查先修知识，为后续正课减轻压力。',
    sample: '学生目前已具备一定的先修基础，基础概念理解较快，但对 AP 课程中的英文术语、题干表达和知识迁移还需要提前适应。学习习惯方面，学生课堂配合度较好，能够跟随老师完成讲解和基础练习，但课后仍需要加强笔记整理和术语记忆。预习阶段建议先完成前几个 Unit 的基础学习，建立核心概念框架。课程安排上每周 2 节，每节 1.5 小时，预计完成 12 课次。作业以基础练习、笔记整理和术语记忆为主，在关键概念学习后根据课堂作答证据安排阶段测评与订正。',
  },
  synchronous: {
    label: '同步',
    guidance: '优先衔接校内进度、近期作业、Quiz 和 Unit Test，先解决当前知识漏洞，再逐步接入 AP 大考题型。',
    sample: '学生校内目前学习进度在 Unit 3，近期将安排 Quiz，因此当前阶段需要围绕学校进度进行同步补习和查漏补缺。学生目前主要问题集中在基础概念不够扎实、题型应用不熟练，以及部分英文题干理解速度偏慢。阶段目标是先完成近期单元的基础补习，重点补齐薄弱环节；后续结合学校进度持续查漏补缺，帮助学生跟上校内学习节奏，并逐步衔接 MCQ、FRQ 和综合应用题训练。',
  },
  intensive: {
    label: '冲刺',
    guidance: '以限时诊断、错因数据、MCQ、FRQ 和模考复盘为主，把已经学过的知识转化为稳定得分。',
    sample: '距离 AP 大考约 12 周，学生已经完成大部分知识点学习，但在知识应用、题型熟练度和答题规范方面仍需要强化。本节课通过真题讲解定位到一个重点薄弱 Unit。阶段目标是先安排专项知识应用与题型训练，随后通过模考检验效果，并根据错题、用时和作答步骤调整后续重点。知识点复习完成后建议每 2 周安排一次完整模考，考前 2 周调整为每周一次，最后集中处理套卷、错题、时间管理和表达规范。',
  },
};

const SUBJECT_SCENARIO_SAMPLES = {
  sat_math: {
    preview: '学生计划开始 SAT 数学学习，本节课先完成了基础诊断。学生对一次方程和基础函数的直接计算较熟悉，但把文字条件转化为方程时速度偏慢，对 Desmos 的常用操作也不够熟练。前期建议先梳理 Algebra 与 Advanced Math 的核心关系，穿插 Problem-Solving and Data Analysis 题目，并用短组练习记录正确率、用时和错因，再决定后续模块的课时比例。',
    synchronous: '学生正在同步准备 SAT 数学，近期 Bluebook 练习反映出 Algebra 基础题整体较稳定，但 Advanced Math 中的非线性函数、参数题和多步骤建模仍容易卡顿。课堂上学生能够在提示后完成关键步骤，但独立识别题型和选择方法还需要加强。后续课程建议跟随当前备考进度查漏补缺，每节课结合错题订正、同类迁移和 Desmos 验证，并根据练习数据动态调整重点。',
    intensive: '距离 SAT 考试时间较近，学生已经完成主要知识点学习，目前失分集中在 Advanced Math、复杂文字建模和后半段时间分配。课堂限时练习中，基础题完成较快，但遇到陌生表达时会反复读题，影响整体节奏。冲刺阶段建议按薄弱模块安排限时专项与整套模考，逐题记录错因和用时，同时训练 Desmos 策略、跳题顺序和检查流程，让正确率与完成速度逐步稳定。',
  },
  sat_english: {
    preview: '学生计划开始 SAT 英语学习，本节课通过短篇阅读和语法题进行了基础诊断。学生能够理解文章大意，但在 Words in Context、证据定位和长句结构分析上速度偏慢；语法题中对标点和句子边界的判断还不稳定。前期建议先建立 Reading and Writing 四大题型框架，补充高频学术词汇与核心语法规则，再通过短组练习观察正确率和用时。',
    synchronous: '学生正在同步准备 SAT 英语，近期练习显示 Information and Ideas 的主旨与证据题相对稳定，但 Craft and Structure 中的词义、文本结构以及 Standard English Conventions 仍有波动。课堂上学生能够说出大致含义，但选择答案时对选项差异解释不够完整。后续建议跟随当前备考进度按错因分类训练，要求每道题标注定位依据、排除理由和用时，并定期回看重复错误。',
    intensive: '距离 SAT 考试时间较近，学生已经熟悉主要题型，目前需要提升阅读速度、难题取舍和语法题稳定性。限时练习中，学生在长句和双文本题上停留时间偏长，后半段容易因时间紧张出现判断失误。冲刺阶段建议交替安排模块限时训练与整套模考，重点复盘证据定位、选项排除、标点规则和时间分配，并用连续多次练习数据确认薄弱点是否真正改善。',
  },
};

const FOCUS_AREAS = {
  knowledge_foundation: {
    label: '知识基础',
    guidance: '优先梳理必要概念、前置知识和知识之间的联系，减少已经确认掌握内容的重复讲解。',
  },
  problem_solving: {
    label: '解题方法',
    guidance: '增加方法选择、步骤说明、错因订正和迁移练习，避免只写刷题数量。',
  },
  data_analysis: {
    label: '数据分析',
    guidance: '增加图表、数据、变量关系和证据解释任务，要求结论能够由数据支持。',
  },
  experimental_inquiry: {
    label: '实验探究',
    guidance: '增加实验设计、变量控制、数据记录、误差分析和证据解释任务。',
  },
  english_terminology: {
    label: '英文术语',
    guidance: '在真实题目和表达任务中安排术语识别与使用，不把孤立背单词作为主要课程。',
  },
  study_habits: {
    label: '学习习惯',
    guidance: '把笔记、审题、检查、订正和复盘落实为具体课堂动作，不对学生习惯作未经证实的负面结论。',
  },
};

const DATA_ANALYSIS_SUBJECTS = new Set([
  'sat_math',
  'ap_statistics',
  'ap_biology',
  'ap_chemistry',
  'ap_environmental_science',
  'ap_microeconomics',
  'ap_macroeconomics',
  'ap_micro_macro_economics',
  'ap_psychology',
  'ap_human_geography',
  'ap_comparative_government',
  'ap_us_government',
]);

const EXPERIMENTAL_SUBJECTS = new Set([
  'ap_biology',
  'ap_chemistry',
  'ap_environmental_science',
  'ap_physics_1',
  'ap_physics_2',
  'ap_physics_c_mechanics',
  'ap_physics_c_electricity_magnetism',
]);

export const PLANNING_SCENARIOS = Object.freeze(SCENARIOS);
export const PLANNING_SCENARIO_CODES = Object.freeze(Object.keys(SCENARIOS));
export const DEFAULT_PLANNING_SCENARIO = 'synchronous';
export const PLANNING_FOCUS_AREAS = Object.freeze(FOCUS_AREAS);
export const PLANNING_FOCUS_AREA_CODES = Object.freeze(Object.keys(FOCUS_AREAS));
export const MAX_PLANNING_FOCUS_AREAS = 3;

export function resolvePlanningScenario(value) {
  return PLANNING_SCENARIO_CODES.includes(value) ? value : DEFAULT_PLANNING_SCENARIO;
}

export function getPlanningScenarioSample(scenarioCode, subjectCode) {
  const scenario = resolvePlanningScenario(scenarioCode);
  return SUBJECT_SCENARIO_SAMPLES[subjectCode]?.[scenario] || PLANNING_SCENARIOS[scenario].sample;
}

export function getPlanningFocusOptions(subjectCode) {
  return PLANNING_FOCUS_AREA_CODES
    .filter((code) => code !== 'data_analysis' || DATA_ANALYSIS_SUBJECTS.has(subjectCode) || String(subjectCode).startsWith('ap_physics_'))
    .filter((code) => code !== 'experimental_inquiry' || EXPERIMENTAL_SUBJECTS.has(subjectCode))
    .map((code) => ({ code, ...PLANNING_FOCUS_AREAS[code] }));
}

export function normalizePlanningFocusAreas(values, subjectCode) {
  const available = new Set(getPlanningFocusOptions(subjectCode).map((option) => option.code));
  return [...new Set(Array.isArray(values) ? values : [])]
    .filter((value) => available.has(value))
    .slice(0, MAX_PLANNING_FOCUS_AREAS);
}

export function buildLessonDurationSlots(totalHours, requestedLessonCount) {
  const hours = Number(totalHours);
  const totalUnits = hours * 2;
  const lessonCount = requestedLessonCount === undefined || requestedLessonCount === null || requestedLessonCount === ''
    ? Math.ceil(hours / 2)
    : Number(requestedLessonCount);
  if (!Number.isInteger(totalUnits) || hours < 2 || hours > 60) throw new RangeError('INVALID_TOTAL_HOURS');
  if (!Number.isInteger(lessonCount) || lessonCount < 1 || lessonCount > 60) throw new RangeError('INVALID_LESSON_COUNT');
  if (totalUnits < lessonCount || totalUnits > lessonCount * 4) throw new RangeError('INVALID_LESSON_COUNT_FOR_TOTAL_HOURS');
  const baseUnits = Math.floor(totalUnits / lessonCount);
  let remainder = totalUnits - baseUnits * lessonCount;
  return Array.from({ length: lessonCount }, () => {
    const units = baseUnits + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return units / 2;
  });
}

export function getLessonCountRange(totalHours) {
  const hours = Number(totalHours);
  if (!Number.isFinite(hours) || hours < 2 || hours > 60 || !Number.isInteger(hours * 2)) return null;
  return {
    minimum: Math.ceil(hours / 2),
    maximum: Math.min(hours * 2, 60),
  };
}
