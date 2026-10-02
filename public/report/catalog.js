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
  'ap_macroeconomics',
  'ap_micro_macro_economics',
  'ap_business_personal_finance',
  'ap_precalculus',
  'ap_physics_1',
  'ap_physics_2',
  'ap_physics_c_mechanics',
  'ap_physics_c_electricity_magnetism',
  'ap_chemistry',
  'ap_biology',
  'ap_statistics',
  'ap_csp',
  'ap_us_history',
  'ap_world_history',
  'ap_european_history',
  'ap_psychology',
  'ap_human_geography',
  'ap_comparative_government',
  'ap_english_literature',
  'ap_english_language',
  'ap_art_history',
  'ap_environmental_science',
  'ap_us_government',
  'ap_chinese',
  'ap_seminar',
  'ap_latin',
  'ap_music_theory'
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
    modules: ['Limits and Continuity', 'Differentiation: Definition and Fundamental Properties', 'Differentiation: Composite, Implicit, and Inverse Functions', 'Contextual Applications of Differentiation', 'Analytical Applications of Differentiation', 'Integration and Accumulation of Change', 'Differential Equations', 'Applications of Integration'],
    promptContext: 'AP Calculus AB 课程聚焦极限、导数、积分、微分方程及其应用，规划不得混入 BC 专属的参数方程、极坐标和无穷级数内容。'
  }),
  ap_calculus_bc: createSubject({
    code: 'ap_calculus_bc',
    displayName: 'AP Calculus BC',
    scoreLabel: 'AP Calculus BC 成绩',
    scoreMin: 1,
    scoreMax: 5,
    scoreStep: 1,
    modules: ['Limits and Continuity', 'Differentiation: Definition and Fundamental Properties', 'Differentiation: Composite, Implicit, and Inverse Functions', 'Contextual Applications of Differentiation', 'Analytical Applications of Differentiation', 'Integration and Accumulation of Change', 'Differential Equations', 'Applications of Integration', 'Parametric Equations, Polar Coordinates, and Vector-Valued Functions', 'Infinite Sequences and Series'],
    promptContext: 'AP Calculus BC 课程覆盖 AB 基础并重点处理参数方程、极坐标、向量值函数、无穷数列与级数，所有建议必须保持在微积分 BC 范围内。'
  }),
  ap_csa: createSubject({
    code: 'ap_csa',
    displayName: 'AP Computer Science A',
    scoreLabel: 'AP Computer Science A 成绩',
    scoreMin: 1,
    scoreMax: 5,
    scoreStep: 1,
    modules: ['Using Objects and Methods', 'Selection and Iteration', 'Class Creation', 'Data Collections'],
    promptContext: 'AP Computer Science A 必须使用 College Board Fall 2025 CED 的四单元框架：Unit 1 Using Objects and Methods、Unit 2 Selection and Iteration、Unit 3 Class Creation、Unit 4 Data Collections。使用 Java 训练代码设计、编写、分析、文档表达与负责任计算；Inheritance、Polymorphism 及旧版十单元编号不属于当前 AP 考纲，不得出现在课程规划中，也不得混入 AP CSP 内容。'
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
  }),
  ap_micro_macro_economics: createSubject({
    code: 'ap_micro_macro_economics',
    displayName: 'AP Microeconomics + Macroeconomics',
    scoreLabel: 'AP 经济学成绩',
    scoreMin: 1,
    scoreMax: 5,
    scoreStep: 1,
    modules: ['Shared Foundations: Basic Economic Concepts', 'Shared Foundations: Supply and Demand', 'Micro Track: Production, Cost, and Market Structure', 'Micro Track: Factor Markets and Market Failure', 'Macro Track: Economic Indicators and AD-AS', 'Macro Track: Financial Sector and Stabilization Policies', 'Macro Track: Open Economy—International Trade and Finance'],
    promptContext: '这是 AP Microeconomics 与 AP Macroeconomics 的联动规划，不是把两门课混成一门。共享部分只限稀缺性、机会成本、PPC、比较优势、基础供需与均衡。Micro 路径必须保留消费者与企业、成本、市场结构、要素市场、市场失灵；Macro 路径必须保留 GDP、失业和通胀、AD-AS、财政与货币政策、金融部门、经济增长、汇率与国际收支。所有课时共用同一个总课时预算，但必须清楚标明共享基础、Micro 专项或 Macro 专项，不能以一门课内容替代另一门课的备考。'
  }),
  ap_business_personal_finance: createApSubject(
    'ap_business_personal_finance',
    'AP Business with Personal Finance',
    ['Businesses, Competition, and New Ideas', 'Marketing', 'Personal Saving and Borrowing + Business Finance and Accounting', 'Management and Strategy', 'Personal Goals, Budgeting, and Investing'],
    'AP Business with Personal Finance 自 2026–27 学年开设。完整课程覆盖企业与竞争、营销、个人储蓄与借贷、企业财务与会计、管理与战略，以及个人目标、预算与投资；AP 统考只考 Unit 1–4，Unit 5 Personal Goals, Budgeting, and Investing 属于完整课程但不纳入 AP 考试。考试为全数字化，包含 60 道选择题、Business Canvas Project Exam-Day Validation，以及 Personal Finance、Business Concept Application、Business Decision 三道自由回答题。规划应结合真实情境、定量与定性数据、商业沟通和证据支持的决策，不得把 Unit 5 写成统考考点。'
  ),
  ap_precalculus: createApSubject(
    'ap_precalculus',
    'AP Precalculus',
    ['Polynomial and Rational Functions', 'Exponential and Logarithmic Functions', 'Trigonometric and Polar Functions', 'Functions Involving Parameters, Vectors, and Matrices'],
    'AP Precalculus 聚焦多项式与有理函数、指数与对数函数、三角与极坐标函数，以及含参数、向量和矩阵的函数建模；Unit 1–3 属于 AP 统考范围，Unit 4 Functions Involving Parameters, Vectors, and Matrices 不纳入 AP 考试。课程强调 covariation、multiple representations 与真实情境建模。可以说明这些能力如何衔接 AP Calculus AB/BC 或迁移到 SAT 数学，但不得把求导、积分、微分方程或 SAT 专项训练写成本课程内容。'
  ),
  ap_physics_1: createApSubject(
    'ap_physics_1',
    'AP Physics 1: Algebra-Based',
    ['Kinematics', 'Force and Translational Dynamics', 'Work, Energy, and Power', 'Linear Momentum', 'Torque and Rotational Dynamics', 'Energy and Momentum of Rotating Systems', 'Oscillations', 'Fluids'],
    'AP Physics 1: Algebra-Based 覆盖运动学、力与平动、功和能、动量、转动、振荡与流体，使用代数与实验建模，不得混入 AP Physics C 所要求的微积分推导。'
  ),
  ap_physics_2: createApSubject(
    'ap_physics_2',
    'AP Physics 2: Algebra-Based',
    ['Thermodynamics', 'Electric Force, Field, and Potential', 'Electric Circuits', 'Magnetism and Electromagnetism', 'Geometric Optics', 'Waves, Sound, and Physical Optics', 'Modern Physics'],
    'AP Physics 2: Algebra-Based 聚焦热学、电场电势、电路、磁学、电磁学、光学、波与现代物理，使用代数、图像、实验和定性推理，不得写成 Physics 1 或 Physics C 课程。'
  ),
  ap_physics_c_mechanics: createApSubject(
    'ap_physics_c_mechanics',
    'AP Physics C: Mechanics',
    ['Kinematics', 'Force and Translational Dynamics', 'Work, Energy, and Power', 'Linear Momentum', 'Torque and Rotational Dynamics', 'Energy and Momentum of Rotating Systems', 'Oscillations'],
    'AP Physics C: Mechanics 是以微积分为基础的力学课程，覆盖运动学、牛顿力学、功和能、动量、转动与振荡；不得混入电场、电路、磁场和电磁感应。'
  ),
  ap_physics_c_electricity_magnetism: createApSubject(
    'ap_physics_c_electricity_magnetism',
    'AP Physics C: Electricity and Magnetism',
    ['Electric Charges, Fields, and Gauss’s Law', 'Electric Potential', 'Conductors and Capacitors', 'Electric Circuits', 'Magnetic Fields and Electromagnetism', 'Electromagnetic Induction'],
    'AP Physics C: Electricity and Magnetism 是以微积分为基础的电磁学课程，覆盖电荷与电场、高斯定律、电势、导体与电容、电路、磁场和电磁感应；不得混入纯力学课程规划。'
  ),
  ap_chemistry: createApSubject(
    'ap_chemistry',
    'AP Chemistry',
    ['Atomic Structure and Properties', 'Compound Structure and Properties', 'Properties of Substances and Mixtures', 'Chemical Reactions', 'Kinetics', 'Thermochemistry', 'Equilibrium', 'Acids and Bases', 'Thermodynamics and Electrochemistry'],
    'AP Chemistry 课程围绕物质结构与性质、化学反应、动力学、热化学、平衡、酸碱、热力学与电化学展开，要求结合 particulate、symbolic 与 macroscopic representations，并重视实验数据和论证。'
  ),
  ap_biology: createApSubject(
    'ap_biology',
    'AP Biology',
    ['Chemistry of Life', 'Cells', 'Cellular Energetics', 'Cell Communication and Cell Cycle', 'Heredity', 'Gene Expression and Regulation', 'Natural Selection', 'Ecology'],
    'AP Biology 聚焦生命化学、细胞、能量、细胞通讯、遗传、基因表达、自然选择和生态，课程规划应结合实验设计、数据分析、模型解释和 evidence-based reasoning。'
  ),
  ap_statistics: createApSubject(
    'ap_statistics',
    'AP Statistics',
    ['Exploring One-Variable Data and Collecting Data', 'Probability, Random Variables, and Probability Distributions', 'Inference for Categorical Data: Proportions', 'Inference for Quantitative Data: Means', 'Regression Analysis'],
    'AP Statistics 使用 2026–27 学年起实施的五单元框架，课程覆盖探索与收集数据、概率和随机变量、比例推断、均值推断与回归分析。Analyzing departures from linearity、combining random variables、geometric distribution、chi-square goodness of fit test 和 inference for slopes 已退出当前考纲，不得安排为 AP 统考内容。所有结论都应包含条件检查、统计量、情境解释与适当的 inference procedure，不得只练公式代入。'
  ),
  ap_csp: createApSubject(
    'ap_csp',
    'AP Computer Science Principles',
    ['Creative Development', 'Data', 'Algorithms and Programming', 'Computer Systems and Networks', 'Impact of Computing'],
    'AP Computer Science Principles 的课程内容由五个 Big Ideas 构成：Creative Development、Data、Algorithms and Programming、Computer Systems and Networks、Impact of Computing。Create Performance Task 是独立的 through-course assessment，不是第六个 Big Idea；可使用多种编程语言，不得套用 AP Computer Science A 的 Java 专属课程结构。'
  ),
  ap_us_history: createApSubject(
    'ap_us_history',
    'AP United States History',
    ['Period 1: 1491–1607', 'Period 2: 1607–1754', 'Period 3: 1754–1800', 'Period 4: 1800–1848', 'Period 5: 1844–1877', 'Period 6: 1865–1898', 'Period 7: 1890–1945', 'Period 8: 1945–1980', 'Period 9: 1980–Present'],
    'AP United States History 覆盖约 1491 年至今的美国历史，要求持续训练 sourcing、contextualization、comparison、causation、continuity and change，以及 SAQ、DBQ 与 LEQ 的证据论证。'
  ),
  ap_world_history: createApSubject(
    'ap_world_history',
    'AP World History: Modern',
    ['The Global Tapestry', 'Networks of Exchange', 'Land-Based Empires', 'Transoceanic Interconnections', 'Revolutions', 'Consequences of Industrialization', 'Global Conflict', 'Cold War and Decolonization', 'Globalization'],
    'AP World History: Modern 聚焦约 1200 年至今的全球历史进程，要求跨区域比较、因果分析、连续与变化、史料分析，以及 SAQ、DBQ 与 LEQ 的历史论证。'
  ),
  ap_european_history: createApSubject(
    'ap_european_history',
    'AP European History',
    ['Renaissance and Exploration', 'Age of Reformation', 'Absolutism and Constitutionalism', 'Scientific, Philosophical, and Political Developments', 'Conflict, Crisis, and Reaction in the Late 18th Century', 'Industrialization and Its Effects', '19th-Century Perspectives and Political Developments', '20th-Century Global Conflicts', 'Cold War and Contemporary Europe'],
    'AP European History 聚焦约 1450 年至今的欧洲历史，要求结合 primary and secondary sources 训练 contextualization、comparison、causation、continuity and change，并完成 SAQ、DBQ 与 LEQ。'
  ),
  ap_psychology: createApSubject(
    'ap_psychology',
    'AP Psychology',
    ['Biological Bases of Behavior', 'Cognition', 'Development and Learning', 'Social Psychology and Personality', 'Mental and Physical Health'],
    'AP Psychology 课程覆盖行为的生物基础、认知、发展与学习、社会心理与人格、身心健康，强调研究方法、数据解释、概念应用与基于情境的论证，不以日常经验代替心理学证据。'
  ),
  ap_human_geography: createApSubject(
    'ap_human_geography',
    'AP Human Geography',
    ['Thinking Geographically', 'Population and Migration Patterns and Processes', 'Cultural Patterns and Processes', 'Political Patterns and Processes', 'Agriculture and Rural Land-Use Patterns and Processes', 'Cities and Urban Land-Use Patterns and Processes', 'Industrial and Economic Development Patterns and Processes'],
    'AP Human Geography 聚焦空间模式、尺度、扩散、人口迁移、文化、政治、农业、城市与发展，要求使用地图、图表、空间数据和案例解释 geographic patterns and processes。'
  ),
  ap_comparative_government: createApSubject(
    'ap_comparative_government',
    'AP Comparative Government and Politics',
    ['Political Systems, Regimes, and Governments', 'Political Institutions', 'Political Culture and Participation', 'Party and Electoral Systems and Citizen Organizations', 'Political and Economic Changes and Development'],
    'AP Comparative Government and Politics 由五个官方单元构成，并在各单元中比较中国、伊朗、墨西哥、尼日利亚、俄罗斯和英国；国家案例贯穿五个单元，不单独构成 Comparative Case Studies 第六单元。课程要求用概念、国家案例和数据完成比较、因果解释与论证。'
  ),
  ap_english_literature: createApSubject(
    'ap_english_literature',
    'AP English Literature and Composition',
    ['Short Fiction I', 'Poetry I', 'Longer Fiction or Drama I', 'Short Fiction II', 'Poetry II', 'Longer Fiction or Drama II', 'Short Fiction III', 'Poetry III', 'Longer Fiction or Drama III'],
    'AP English Literature and Composition 通过小说、诗歌和戏剧训练 close reading、literary analysis 与 evidence-based argument，重点分析人物、结构、叙事视角、语言和复杂意义，不得写成 AP English Language 的修辞非虚构课程。'
  ),
  ap_english_language: createApSubject(
    'ap_english_language',
    'AP English Language and Composition',
    ['Rhetorical Situation: Reading', 'Rhetorical Situation: Writing', 'Claims and Evidence: Reading', 'Claims and Evidence: Writing', 'Reasoning and Organization: Reading', 'Reasoning and Organization: Writing', 'Style: Reading', 'Style: Writing'],
    'AP English Language and Composition 以非虚构文本为主，训练 rhetorical situation、claims and evidence、reasoning、organization、style，以及 synthesis、rhetorical analysis 和 argument writing。'
  ),
  ap_art_history: createApSubject(
    'ap_art_history',
    'AP Art History',
    ['Global Prehistory', 'Ancient Mediterranean', 'Early Europe and Colonial Americas', 'Later Europe and Americas', 'Indigenous Americas', 'Africa', 'West and Central Asia', 'South, East, and Southeast Asia', 'The Pacific', 'Global Contemporary'],
    'AP Art History 围绕全球艺术传统与规定作品训练 visual analysis、contextual analysis、comparison、attribution 和 argumentation，必须以作品证据、文化语境与艺术过程支持判断。'
  ),
  ap_environmental_science: createApSubject(
    'ap_environmental_science',
    'AP Environmental Science',
    ['The Living World: Ecosystems', 'The Living World: Biodiversity', 'Populations', 'Earth Systems and Resources', 'Land and Water Use', 'Energy Resources and Consumption', 'Atmospheric Pollution', 'Aquatic and Terrestrial Pollution', 'Global Change'],
    'AP Environmental Science 融合生态、地球系统、资源利用、能源、污染与全球变化，课程规划应结合系统模型、实验与野外数据、定量计算、环境问题分析和 solution evaluation。'
  ),
  ap_us_government: createApSubject(
    'ap_us_government',
    'AP United States Government and Politics',
    ['Foundations of American Democracy', 'Interactions Among Branches of Government', 'Civil Liberties and Civil Rights', 'American Political Ideologies and Beliefs', 'Political Participation'],
    'AP United States Government and Politics 聚焦宪政基础、政府分支互动、公民自由与权利、政治信念和政治参与，要求结合 foundational documents、Supreme Court cases、数据与政治过程完成论证。'
  ),
  ap_chinese: createApSubject(
    'ap_chinese',
    'AP Chinese Language and Culture',
    ['Families and Communities', 'Language and Culture', 'Art and Creativity', 'Science and Technology', 'Contemporary Life', 'Global Contexts'],
    'AP Chinese Language and Culture 使用 2026–27 学年起实施的六单元框架：Families and Communities、Language and Culture、Art and Creativity、Science and Technology、Contemporary Life、Global Contexts。课程训练 Interpretive Communication、Interpersonal and Presentational Communication 与 Cultural Understanding，并结合真实语料、课程项目、听读理解、口语互动与书面表达，不得沿用旧版主题名称或只做词汇语法刷题。'
  ),
  ap_seminar: createApSubject(
    'ap_seminar',
    'AP Seminar',
    ['Question and Explore', 'Understand and Analyze', 'Evaluate Multiple Perspectives', 'Synthesize Ideas', 'Team, Transform, and Transmit'],
    'AP Seminar 课程框架由五个 Big Ideas 构成：Question and Explore、Understand and Analyze、Evaluate Multiple Perspectives、Synthesize Ideas、Team, Transform, and Transmit。Team Project and Presentation、Individual Research-Based Essay and Presentation 和 End-of-Course Exam 是评估组成，不是额外 Big Ideas；课程规划不得虚构研究结果或替学生完成 performance task。'
  ),
  ap_latin: createApSubject(
    'ap_latin',
    'AP Latin',
    ['Teacher’s Choice – Latin Prose', 'Pliny’s Letters: Eruption of Mt. Vesuvius', 'Pliny’s Letters: Ghosts and Apparitions, Letters to Trajan and Calpurnia, and Teacher’s Choice – Latin Prose', 'Teacher’s Choice – Latin Poetry and Vergil’s Aeneid, Excerpts from Books 1 and 2', 'Vergil’s Aeneid, Excerpts from Books 4, 6, 7, 11, and 12', 'Course Project and Teacher’s Choice – Latin Poetry'],
    'AP Latin 使用 2025–26 学年起实施的六单元框架，围绕 Teacher’s Choice 拉丁散文与诗歌、Pliny’s Letters、Vergil’s Aeneid 规定选段和 Course Project 展开，训练 Read and Comprehend、Describe Style and Context、Analyze 三类技能。不得沿用旧版 Caesar 与 Vergil 双文本框架。'
  ),
  ap_music_theory: createApSubject(
    'ap_music_theory',
    'AP Music Theory',
    ['Music Fundamentals I: Pitch, Major Scales and Key Signatures, Rhythm, Meter, and Expressive Elements', 'Music Fundamentals II: Minor Scales and Key Signatures, Melody, Timbre, and Texture', 'Music Fundamentals III: Triads and Seventh Chords', 'Harmony and Voice Leading I: Chord Function, Cadence, and Phrase', 'Harmony and Voice Leading II: Chord Progressions and Predominant Function', 'Harmony and Voice Leading III: Embellishments, Motives, and Melodic Devices', 'Harmony and Voice Leading IV: Secondary Function', 'Modes and Form'],
    'AP Music Theory 使用官方八单元框架，课程整合 Analyze Performed Music、Analyze Notated Music、Convert Between Performed and Notated Music、Complete Based on Cues 四类实践。Aural Skills、part writing 和 sight singing 应贯穿相关单元，不单独冒充官方考纲单元。'
  )
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

function createApSubject(code, displayName, modules, promptContext) {
  return createSubject({
    code,
    displayName,
    scoreLabel: `${displayName} 成绩`,
    scoreMin: 1,
    scoreMax: 5,
    scoreStep: 1,
    modules,
    promptContext
  });
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
