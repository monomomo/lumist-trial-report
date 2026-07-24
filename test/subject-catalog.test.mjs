import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUBJECT_CODES,
  SUBJECT_CATALOG,
  resolveSubject,
  validateSubjectScores
} from '../lib/subjects/catalog.js';
import { buildSystemPrompt, buildUserInput } from '../lib/subjects/prompt.ts';

const EXPECTED_CODES = [
  'sat_math',
  'sat_english',
  'ap_calculus_ab',
  'ap_calculus_bc',
  'ap_csa',
  'ap_microeconomics',
  'ap_macroeconomics'
];

const UNIQUE_MODULES = {
  sat_math: [
    'Algebra',
    'Advanced Math',
    'Problem-Solving and Data Analysis',
    'Geometry and Trigonometry'
  ],
  sat_english: [
    'Information and Ideas',
    'Craft and Structure',
    'Expression of Ideas',
    'Standard English Conventions'
  ],
  ap_calculus_ab: [
    'Limits and Continuity',
    'Differentiation',
    'Applications of Derivatives',
    'Integration and Accumulation of Change',
    'Differential Equations',
    'Applications of Integration'
  ],
  ap_calculus_bc: [
    'AB Foundations Review',
    'Parametric Equations',
    'Polar Coordinates',
    'Vector-Valued Functions',
    'Infinite Sequences and Series'
  ],
  ap_csa: [
    'Java Fundamentals',
    'Selection and Iteration',
    'Classes and Objects',
    'Data Collections',
    'Inheritance and Polymorphism',
    'Recursion'
  ],
  ap_microeconomics: [
    'Supply and Demand',
    'Production, Cost, and Perfect Competition',
    'Imperfect Competition',
    'Factor Markets',
    'Market Failure and the Role of Government'
  ],
  ap_macroeconomics: [
    'Economic Indicators and the Business Cycle',
    'National Income and Price Determination',
    'Financial Sector',
    'Long-Run Consequences of Stabilization Policies',
    'Open Economy—International Trade and Finance'
  ]
};

const SHARED_RULE_PATTERNS = [
  /只把输入中明确出现的信息写成已知事实/,
  /区分“本次课堂观察”和“后续建议”/,
  /家长报告使用专业、清晰、鼓励但不过度承诺的语气/,
  /课程规划仅针对.+只可使用本学科模块/,
  /总课时必须由当前水平、目标成绩、考试日期和薄弱点综合决定/,
  /每个课时块必须写明主题、授课内容、重难点和目标/,
  /coursePlan\.rationale 只说明动态调整依据/,
  /每个阶段标题和课时主题必须是语义完整的短句/,
  /使用自然、具体的中文/,
  /科目事实边界/
];

test('catalog exposes exactly the seven supported subject codes', () => {
  assert.deepEqual(SUBJECT_CODES, EXPECTED_CODES);
  assert.deepEqual(Object.keys(SUBJECT_CATALOG), EXPECTED_CODES);
});

test('resolveSubject returns the exact catalog object with the requested code for every subject', () => {
  for (const code of EXPECTED_CODES) {
    const subject = resolveSubject(code);
    assert.equal(subject.code, code, `${code} must preserve its code`);
    assert.equal(subject, SUBJECT_CATALOG[code], `${code} must resolve to its catalog object`);
  }
});

test('resolveSubject defaults only missing and blank string codes to SAT Math', () => {
  for (const code of [undefined, null, '', '   ']) {
    const subject = resolveSubject(code);
    assert.equal(subject.code, 'sat_math');
    assert.equal(subject, SUBJECT_CATALOG.sat_math);
  }
});

test('resolveSubject rejects inherited properties, unknown codes, and non-string codes', () => {
  for (const code of ['toString', 'constructor', '__proto__', 'sat_science', 0, 1, false, true, {}, [], Symbol('sat_math')]) {
    assert.throws(() => resolveSubject(code), RangeError, String(code));
  }
});

test('every subject validates its minimum, maximum, outside bounds, and illegal score step', () => {
  for (const code of SUBJECT_CODES) {
    const { scoreMin, scoreMax, scoreStep } = SUBJECT_CATALOG[code];
    const illegalStep = scoreMin + scoreStep / 2;

    assert.equal(validateSubjectScores(code, scoreMin, scoreMax).valid, true, `${code} must accept min and max`);
    assert.equal(validateSubjectScores(code, scoreMin - scoreStep, scoreMax).valid, false, `${code} must reject below min`);
    assert.equal(validateSubjectScores(code, scoreMin, scoreMax + scoreStep).valid, false, `${code} must reject above max`);
    assert.equal(validateSubjectScores(code, illegalStep, scoreMax).valid, false, `${code} must reject illegal step`);
  }
});

test('every subject accepts an unchanged target and rejects a lower target', () => {
  for (const code of SUBJECT_CODES) {
    const { scoreMin, scoreStep } = SUBJECT_CATALOG[code];
    const currentScore = scoreMin + scoreStep;

    assert.equal(validateSubjectScores(code, currentScore, currentScore).valid, true, `${code} must accept target equal to current`);
    const lowerTarget = validateSubjectScores(code, currentScore, scoreMin);
    assert.equal(lowerTarget.valid, false, `${code} must reject target below current`);
    assert.equal(
      lowerTarget.errors.some((error) => error.path === 'targetScore' && error.message.includes('不能低于当前成绩')),
      true,
      `${code} must report the target direction error`
    );
  }
});

test('blank current and target scores are allowed independently', () => {
  for (const code of SUBJECT_CODES) {
    assert.equal(validateSubjectScores(code, '', '').valid, true);
    assert.equal(validateSubjectScores(code, undefined, null).valid, true);
    assert.equal(validateSubjectScores(code, '', SUBJECT_CATALOG[code].scoreMax).valid, true);
    assert.equal(validateSubjectScores(code, SUBJECT_CATALOG[code].scoreMin, '').valid, true);
  }
});

test('every subject owns complete, isolated modules and prompt context', () => {
  const moduleArrays = new Set();
  const promptContexts = new Set();

  for (const code of SUBJECT_CODES) {
    const subject = SUBJECT_CATALOG[code];
    assert.equal(subject.code, code);
    assert.equal(typeof subject.displayName, 'string');
    assert.equal(typeof subject.scoreLabel, 'string');
    assert.equal(Number.isFinite(subject.scoreMin), true);
    assert.equal(Number.isFinite(subject.scoreMax), true);
    assert.equal(Number.isFinite(subject.scoreStep), true);
    assert.deepEqual(subject.modules, code === 'ap_microeconomics'
      ? ['Basic Economic Concepts', ...UNIQUE_MODULES[code]]
      : code === 'ap_macroeconomics'
        ? ['Basic Economic Concepts', ...UNIQUE_MODULES[code]]
        : UNIQUE_MODULES[code]);
    assert.equal(typeof subject.promptContext, 'string');
    assert.equal(subject.promptContext.length > 0, true);
    assert.equal(moduleArrays.has(subject.modules), false, `${code} must not share its modules array`);
    assert.equal(promptContexts.has(subject.promptContext), false, `${code} must have distinct prompt context`);
    moduleArrays.add(subject.modules);
    promptContexts.add(subject.promptContext);
  }

  assert.match(SUBJECT_CATALOG.sat_math.promptContext, /44\s*题/);
  assert.match(SUBJECT_CATALOG.sat_math.promptContext, /70\s*分钟/);
  assert.match(SUBJECT_CATALOG.sat_math.promptContext, /Desmos/);
});

test('buildUserInput includes every supplied report field for every subject', () => {
  for (const code of SUBJECT_CODES) {
    const subject = SUBJECT_CATALOG[code];
    const data = {
      studentName: `学生-${code}`,
      currentScore: subject.scoreMin,
      targetScore: subject.scoreMax,
      examDate: '2027-05-08',
      teacherNotes: `课堂记录-${code}`
    };
    const userInput = buildUserInput(subject, data);

    assert.equal(userInput.includes(data.studentName), true, `${code} must include studentName`);
    assert.equal(userInput.includes(`当前${subject.scoreLabel}：${data.currentScore}`), true, `${code} must include currentScore`);
    assert.equal(userInput.includes(`目标${subject.scoreLabel}：${data.targetScore}`), true, `${code} must include targetScore`);
    assert.equal(userInput.includes(`目标考试日期：${data.examDate}`), true, `${code} must include examDate`);
    assert.equal(userInput.includes(data.teacherNotes), true, `${code} must include teacherNotes`);
  }
});

test('buildUserInput formats blank optional fields as not provided', () => {
  const subject = SUBJECT_CATALOG.sat_math;
  const userInput = buildUserInput(subject, {
    studentName: '测试学生',
    currentScore: null,
    targetScore: ' ',
    examDate: '',
    teacherNotes: '课堂记录仅用于测试。'
  });

  assert.equal(userInput.includes(`当前${subject.scoreLabel}：未提供`), true);
  assert.equal(userInput.includes(`目标${subject.scoreLabel}：未提供`), true);
  assert.equal(userInput.includes('目标考试日期：未提供'), true);
});

test('buildSystemPrompt covers all ten shared rules with stable semantics for every subject', () => {
  for (const code of SUBJECT_CODES) {
    const prompt = buildSystemPrompt(SUBJECT_CATALOG[code]);
    SHARED_RULE_PATTERNS.forEach((pattern, index) => {
      assert.match(prompt, pattern, `${code} must include shared rule ${index + 1}`);
    });
  }
});

test('buildSystemPrompt includes all own modules and excludes every other subject unique module', () => {
  for (const code of SUBJECT_CODES) {
    const subject = SUBJECT_CATALOG[code];
    const prompt = buildSystemPrompt(subject);

    for (const module of subject.modules) {
      assert.equal(prompt.includes(module), true, `${code} must include its module ${module}`);
    }

    for (const [otherCode, uniqueModules] of Object.entries(UNIQUE_MODULES)) {
      if (otherCode === code) continue;
      for (const module of uniqueModules) {
        assert.equal(prompt.includes(module), false, `${code} must not include ${otherCode} unique module ${module}`);
      }
    }
  }
});
