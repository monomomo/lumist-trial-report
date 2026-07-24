/**
 * iframe 侧的科目目录副本。必须与 lib/subjects/catalog.js 保持同步。
 * 系统支持的科目编码，顺序同时作为前端展示和遍历的稳定顺序。
 */
export const SUBJECT_CODES = Object.freeze([
  'sat_math',
  'sat_english',
  'ap_calculus_ab',
  'ap_calculus_bc',
  'ap_csa',
  'ap_microeconomics',
  'ap_macroeconomics'
]);

/**
 * 科目元数据目录。每个科目独立维护课程模块和提示词事实边界，避免跨科目混用。
 */
export const SUBJECT_CATALOG = Object.freeze({
  sat_math: createSubject({
    code: 'sat_math',
    displayName: 'SAT 数学',
    scoreLabel: 'SAT 数学成绩',
    scoreMin: 200,
    scoreMax: 800,
    scoreStep: 10,
    modules: [
      'Algebra',
      'Advanced Math',
      'Problem-Solving and Data Analysis',
      'Geometry and Trigonometry'
    ],
    promptContext: 'Digital SAT 数学共 44 题、70 分钟，分为两个各 35 分钟的自适应 Module；全程可使用计算器并内置 Desmos。课程范围仅限四大 Domain：Algebra、Advanced Math、Problem-Solving and Data Analysis、Geometry and Trigonometry。'
  }),
  sat_english: createSubject({
    code: 'sat_english',
    displayName: 'SAT 英语',
    scoreLabel: 'SAT Reading and Writing 成绩',
    scoreMin: 200,
    scoreMax: 800,
    scoreStep: 10,
    modules: [
      'Information and Ideas',
      'Craft and Structure',
      'Expression of Ideas',
      'Standard English Conventions'
    ],
    promptContext: 'Digital SAT Reading and Writing 课程仅围绕四大 Domain：Information and Ideas、Craft and Structure、Expression of Ideas、Standard English Conventions，并结合数字化自适应考试的阅读、语言与限时训练要求。'
  }),
  ap_calculus_ab: createSubject({
    code: 'ap_calculus_ab',
    displayName: 'AP Calculus AB',
    scoreLabel: 'AP Calculus AB 成绩',
    scoreMin: 1,
    scoreMax: 5,
    scoreStep: 1,
    modules: ['Limits and Continuity', 'Differentiation', 'Applications of Derivatives', 'Integration and Accumulation of Change', 'Differential Equations', 'Applications of Integration'],
    promptContext: 'AP Calculus AB 课程聚焦极限、导数、积分、微分方程及其应用，规划不得混入 BC 专属的参数方程、极坐标和无穷级数内容。'
  }),
  ap_calculus_bc: createSubject({
    code: 'ap_calculus_bc',
    displayName: 'AP Calculus BC',
    scoreLabel: 'AP Calculus BC 成绩',
    scoreMin: 1,
    scoreMax: 5,
    scoreStep: 1,
    modules: ['AB Foundations Review', 'Parametric Equations', 'Polar Coordinates', 'Vector-Valued Functions', 'Infinite Sequences and Series'],
    promptContext: 'AP Calculus BC 课程覆盖 AB 基础并重点处理参数方程、极坐标、向量值函数、无穷数列与级数，所有建议必须保持在微积分 BC 范围内。'
  }),
  ap_csa: createSubject({
    code: 'ap_csa',
    displayName: 'AP Computer Science A',
    scoreLabel: 'AP Computer Science A 成绩',
    scoreMin: 1,
    scoreMax: 5,
    scoreStep: 1,
    modules: ['Java Fundamentals', 'Selection and Iteration', 'Classes and Objects', 'Data Collections', 'Inheritance and Polymorphism', 'Recursion'],
    promptContext: 'AP Computer Science A 课程使用 Java，聚焦程序设计基础、控制结构、类与对象、数据集合、继承多态和递归，不得混入 AP CSP 或其他语言课程内容。'
  }),
  ap_microeconomics: createSubject({
    code: 'ap_microeconomics',
    displayName: 'AP Microeconomics',
    scoreLabel: 'AP Microeconomics 成绩',
    scoreMin: 1,
    scoreMax: 5,
    scoreStep: 1,
    modules: ['Basic Economic Concepts', 'Supply and Demand', 'Production, Cost, and Perfect Competition', 'Imperfect Competition', 'Factor Markets', 'Market Failure and the Role of Government'],
    promptContext: 'AP Microeconomics 课程聚焦个体消费者、企业、市场结构、要素市场、市场失灵与政府作用，不得混入宏观经济总量分析。'
  }),
  ap_macroeconomics: createSubject({
    code: 'ap_macroeconomics',
    displayName: 'AP Macroeconomics',
    scoreLabel: 'AP Macroeconomics 成绩',
    scoreMin: 1,
    scoreMax: 5,
    scoreStep: 1,
    modules: ['Basic Economic Concepts', 'Economic Indicators and the Business Cycle', 'National Income and Price Determination', 'Financial Sector', 'Long-Run Consequences of Stabilization Policies', 'Open Economy—International Trade and Finance'],
    promptContext: 'AP Macroeconomics 课程聚焦经济指标、商业周期、国民收入与价格、金融部门、稳定政策长期影响和开放经济，不得混入微观企业与市场结构分析。'
  })
});

/**
 * 根据编码解析科目；未传编码时兼容既有 SAT 数学入口。
 *
 * @param {unknown} code 科目编码。
 * @returns {SubjectDefinition} 科目定义。
 */
export function resolveSubject(code) {
  if (code === undefined || code === null) return SUBJECT_CATALOG.sat_math;
  if (typeof code !== 'string') {
    throw new RangeError('科目编码必须为字符串');
  }

  const resolvedCode = code.trim() || 'sat_math';
  if (!Object.hasOwn(SUBJECT_CATALOG, resolvedCode)) {
    throw new RangeError(`不支持的科目编码：${resolvedCode}`);
  }
  return SUBJECT_CATALOG[resolvedCode];
}

/**
 * 按科目成绩口径校验当前成绩和目标成绩；空值表示用户尚未提供，允许继续生成报告。
 *
 * @param {string | null | undefined} code 科目编码。
 * @param {string | number | null | undefined} currentScore 当前成绩。
 * @param {string | number | null | undefined} targetScore 目标成绩。
 * @returns {ScoreValidationResult} 校验结果。
 */
export function validateSubjectScores(code, currentScore, targetScore) {
  const subject = resolveSubject(code);
  const errors = [];
  const current = parseScore(currentScore);
  const target = parseScore(targetScore);

  validateScore(subject, current, 'currentScore', errors);
  validateScore(subject, target, 'targetScore', errors);
  if (current !== null && target !== null && isValidScore(subject, current) && isValidScore(subject, target) && target < current) {
    errors.push({ path: 'targetScore', message: '目标成绩不能低于当前成绩' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 创建不可变科目定义，确保模块数组不会被调用方修改或在科目间共享。
 *
 * @param {SubjectDefinition} subject 科目定义。
 * @returns {SubjectDefinition} 不可变科目定义。
 */
function createSubject(subject) {
  return Object.freeze({ ...subject, modules: Object.freeze([...subject.modules]) });
}

/** @param {string | number | null | undefined} value */
function parseScore(value) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  return typeof value === 'number' ? value : Number(value);
}

/**
 * @param {SubjectDefinition} subject
 * @param {number | null} score
 */
function isValidScore(subject, score) {
  return score !== null
    && Number.isFinite(score)
    && score >= subject.scoreMin
    && score <= subject.scoreMax
    && Number.isInteger((score - subject.scoreMin) / subject.scoreStep);
}

/**
 * @param {SubjectDefinition} subject
 * @param {number | null} score
 * @param {'currentScore' | 'targetScore'} path
 * @param {ScoreValidationError[]} errors
 */
function validateScore(subject, score, path, errors) {
  if (score === null || isValidScore(subject, score)) return;
  errors.push({
    path,
    message: `${subject.scoreLabel}必须为 ${subject.scoreMin}-${subject.scoreMax} 范围内、步长为 ${subject.scoreStep} 的数值`
  });
}

/**
 * @typedef {Object} SubjectDefinition
 * @property {string} code 科目编码。
 * @property {string} displayName 展示名称。
 * @property {string} scoreLabel 成绩字段名称。
 * @property {number} scoreMin 最低成绩。
 * @property {number} scoreMax 最高成绩。
 * @property {number} scoreStep 合法成绩步长。
 * @property {readonly string[]} modules 课程模块。
 * @property {string} promptContext 科目专属事实边界。
 */

/**
 * @typedef {Object} ScoreValidationError
 * @property {'currentScore' | 'targetScore'} path 错误字段。
 * @property {string} message 错误说明。
 */

/**
 * @typedef {Object} ScoreValidationResult
 * @property {boolean} valid 是否通过校验。
 * @property {ScoreValidationError[]} errors 错误列表。
 */
