import { SUBJECT_CODES, SUBJECT_CATALOG } from './catalog.js';

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
  ],
  ap_precalculus: [
    /Applications of Derivatives|Differential Equations|Infinite Sequences and Series|Taylor Series|Maclaurin Series/i
  ],
  ap_physics_1: [
    /Gauss(?:’s|'s)? Law|Electric Potential|Capacitors|Electromagnetic Induction|Modern Physics/i
  ],
  ap_physics_2: [
    /Torque and Rotational Dynamics|Linear Momentum|Fluids/i
  ],
  ap_physics_c_mechanics: [
    /Gauss(?:’s|'s)? Law|Electric Potential|Capacitors|Electric Circuits|Magnetic Fields|Electromagnetic Induction/i
  ],
  ap_physics_c_electricity_magnetism: [
    /Kinematics|Linear Momentum|Torque and Rotational Dynamics|Oscillations|Fluids/i
  ],
  ap_csp: [
    /Java Fundamentals|Inheritance and Polymorphism|ArrayList|AP Calculus/i
  ],
  ap_english_literature: [
    /Rhetorical Synthesis|Synthesis Essay|Nonfiction Rhetorical Analysis/i
  ],
  ap_english_language: [
    /Poetry Analysis|Prose Fiction Analysis|Longer Fiction and Drama/i
  ]
};

export function hasSubjectScopeViolation(subjectCode: string, report: unknown): boolean {
  const text = JSON.stringify(report);
  const explicitOtherCourse = SUBJECT_CODES
    .filter((code) => code !== subjectCode)
    .some((code) => new RegExp(escapeRegExp(SUBJECT_CATALOG[code].displayName), 'i').test(text));
  return explicitOtherCourse || (forbiddenPatterns[subjectCode] || []).some((pattern) => pattern.test(text));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
