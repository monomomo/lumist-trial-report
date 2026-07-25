const forbiddenPatterns: Record<string, RegExp[]> = {
  sat_math: [
    /AP Calculus|AP Computer Science|AP Microeconomics|AP Macroeconomics/i,
    /Information and Ideas|Craft and Structure|Expression of Ideas|Standard English Conventions/i
  ],
  sat_english: [
    /AP Calculus|AP Computer Science|AP Microeconomics|AP Macroeconomics/i,
    /Advanced Math|Geometry and Trigonometry|Problem-Solving and Data Analysis/i
  ],
  ap_calculus_ab: [
    /Parametric Equations|Polar Coordinates|Vector-Valued Functions|Infinite Sequences and Series|Taylor Series|Maclaurin Series|Power Series/i,
    /AP Computer Science|AP Microeconomics|AP Macroeconomics|Digital SAT/i
  ],
  ap_calculus_bc: [
    /AP Computer Science|AP Microeconomics|AP Macroeconomics|Digital SAT/i,
    /Information and Ideas|Craft and Structure|Expression of Ideas|Standard English Conventions/i
  ],
  ap_csa: [
    /AP Calculus|AP Microeconomics|AP Macroeconomics|Digital SAT/i,
    /Parametric Equations|Polar Coordinates|Infinite Sequences and Series|Taylor Series|Maclaurin Series/i
  ],
  ap_microeconomics: [
    /AP Calculus|AP Computer Science|AP Macroeconomics|Digital SAT/i,
    /Gross Domestic Product|\bGDP\b|Aggregate Demand|Aggregate Supply|Monetary Policy|Fiscal Policy|Foreign Exchange Market/i
  ],
  ap_macroeconomics: [
    /AP Calculus|AP Computer Science|AP Microeconomics|Digital SAT/i,
    /Consumer Surplus|Producer Surplus|Price Elasticity|Perfect Competition|Monopoly|Oligopoly|Factor Markets|Externalities/i
  ]
};

export function hasSubjectScopeViolation(subjectCode: string, report: unknown): boolean {
  const text = JSON.stringify(report);
  return (forbiddenPatterns[subjectCode] || []).some((pattern) => pattern.test(text));
}
