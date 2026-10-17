type ReviewLesson = {
  theme?: string | null;
  content?: string | null;
  sourceText?: string | null;
};

type ReviewStage = {
  title?: string | null;
  description?: string | null;
  lessons?: ReviewLesson[];
};

type ReviewPlan = {
  title?: string | null;
  stages?: ReviewStage[];
};

const SAT_MATH_DOMAINS = [
  {
    label: 'Algebra（代数）',
    pattern: /\balgebra\b|linear equations?|linear functions?|systems? of equations?|linear inequalities?|slope|intercept|线性方程|一次方程|一次函数|方程组|线性不等式|斜率|截距/i,
  },
  {
    label: 'Advanced Math（进阶数学）',
    pattern: /advanced math|nonlinear|quadratic|polynomial|radical|rational expressions?|exponential|equivalent expressions?|非线性|二次方程|二次函数|多项式|根式|有理式|指数函数|等价表达式/i,
  },
  {
    label: 'Problem-Solving and Data Analysis（问题解决与数据分析）',
    pattern: /problem[ -]solving|data analysis|statistics?|ratios?|rates?|percent(?:age)?|probability|scatterplots?|two-way tables?|margin of error|mean|median|standard deviation|sampling|数据分析|统计|比例|百分比|概率|散点图|双向表|误差范围|平均数|中位数|标准差|抽样/i,
  },
  {
    label: 'Geometry and Trigonometry（几何与三角）',
    pattern: /geometry|trigonometry|right triangles?|circles?|area|volume|angles?|similarity|coordinate geometry|几何|三角函数|直角三角形|圆|面积|体积|角度|相似|坐标几何/i,
  },
] as const;

const SAT_MATH_OUT_OF_SCOPE = [
  { label: '微积分', pattern: /calculus|derivatives?|integrals?|微积分|导数|积分/i },
  { label: '极限', pattern: /\blimits?\b|极限/i },
  { label: '矩阵或线性代数', pattern: /matrices?|eigenvalues?|vector spaces?|矩阵|特征值|向量空间|线性代数/i },
  { label: '数学归纳法', pattern: /mathematical induction|数学归纳法/i },
] as const;

const SAT_ENGLISH_OUT_OF_SCOPE = [
  { label: '听力训练', pattern: /listening|听力|听写/i },
  { label: '口语训练', pattern: /speaking|口语|演讲|口头表达/i },
  { label: '独立作文或考试写作', pattern: /essay|independent writing|integrated writing|academic discussion|作文|独立写作|综合写作|学术讨论写作/i },
  { label: 'TOEFL/IELTS 专项', pattern: /\btoefl\b|\bielts\b|托福|雅思/i },
] as const;

function getPlanText(plan: ReviewPlan) {
  return [
    plan.title ?? '',
    ...(plan.stages ?? []).flatMap((stage) => [
      stage.title ?? '',
      stage.description ?? '',
      ...(stage.lessons ?? []).flatMap((lesson) => [lesson.theme ?? '', lesson.content ?? '', lesson.sourceText ?? '']),
    ]),
  ].join('\n');
}

export function getSatUploadedPlanWarnings(subjectCode: string, plan: ReviewPlan) {
  if (subjectCode !== 'sat_math' && subjectCode !== 'sat_english') return [];
  const text = getPlanText(plan);
  if (subjectCode === 'sat_math') {
    const missingDomains = SAT_MATH_DOMAINS.filter((domain) => !domain.pattern.test(text)).map((domain) => domain.label);
    const outOfScope = SAT_MATH_OUT_OF_SCOPE.filter((item) => item.pattern.test(text)).map((item) => item.label);
    return [
      ...(missingDomains.length ? [`未识别到以下 SAT 数学领域：${missingDomains.join('、')}。请确认原规划是否已覆盖，或相关表述是否需要补充。`] : []),
      ...(outOfScope.length ? [`疑似包含 SAT 数学考纲外或衔接内容：${outOfScope.join('、')}。请确认这些内容是否为老师有意安排。`] : []),
    ];
  }
  const outOfScope = SAT_ENGLISH_OUT_OF_SCOPE.filter((item) => item.pattern.test(text)).map((item) => item.label);
  return outOfScope.length
    ? [`疑似包含 SAT Reading and Writing 范围外或衔接内容：${outOfScope.join('、')}。请确认这些内容是否为老师有意安排。`]
    : [];
}
