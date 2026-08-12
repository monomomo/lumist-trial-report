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
    /Differentiation|Applications of Derivatives|Integration and Accumulation of Change|Applications of Integration|Differential Equations|Infinite Sequences and Series|Taylor Series|Maclaurin Series/i,
    /Bluebook|Student Question Bank|Educator Question Bank|Digital SAT|SAT Module|Module 1|Module 2/i
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
  ],
  ap_chemistry: [
    /Cellular Respiration|Gene Expression|Natural Selection|Ecology|Kinematics|Java Fundamentals|DBQ|LEQ/i
  ],
  ap_biology: [
    /Electrochemistry|Galvanic Cell|Nernst Equation|Kinematics|Java Fundamentals|DBQ|LEQ/i
  ],
  ap_statistics: [
    /Differentiation|Integration and Accumulation|Kinematics|Supply and Demand|Java Fundamentals|DBQ|LEQ/i
  ],
  ap_us_history: [
    /Global Tapestry|Land-Based Empires|Renaissance and Exploration|Age of Reformation|Java Fundamentals|Differentiation/i
  ],
  ap_world_history: [
    /Period 1:\s*1491|Period 9:\s*1980|Renaissance and Exploration|Age of Reformation|Java Fundamentals|Differentiation/i
  ],
  ap_european_history: [
    /Global Tapestry|Land-Based Empires|Period 1:\s*1491|Period 9:\s*1980|Java Fundamentals|Differentiation/i
  ],
  ap_psychology: [
    /Supply and Demand|Aggregate Demand|Kinematics|Chemical Equilibrium|Java Fundamentals|DBQ|LEQ/i
  ],
  ap_human_geography: [
    /Foundations of American Democracy|Supreme Court Cases|Comparative Case Studies|Differentiation|Java Fundamentals|Chemical Equilibrium/i
  ],
  ap_comparative_government: [
    /Foundations of American Democracy|Supreme Court Cases|Population and Migration Patterns|Urban Land-Use|Differentiation|Java Fundamentals/i
  ],
  ap_art_history: [
    /Harmony and Voice Leading|Chord Progressions|Sight Singing|Part Writing|Differentiation|Java Fundamentals/i
  ],
  ap_environmental_science: [
    /Gene Expression and Regulation|Cell Cycle|Nernst Equation|Differentiation|Java Fundamentals|Literary Argument/i
  ],
  ap_us_government: [
    /Comparative Case Studies|Political Systems, Regimes|Population and Migration Patterns|Urban Land-Use|Differentiation|Java Fundamentals/i
  ],
  ap_chinese: [
    /Latin Reading and Translation|Latin Syntax|Sight Reading|Literary Argument|Synthesis Essay|Java Fundamentals|Differentiation/i
  ],
  ap_seminar: [
    /Bluebook|Desmos|ArrayList|Sight Singing/i
  ],
  ap_latin: [
    /Interpersonal Communication|Presentational Communication|Cultural Comparison|Synthesis Essay|Java Fundamentals|Differentiation/i
  ],
  ap_music_theory: [
    /Visual Analysis|Contextual Analysis|Artistic Attribution|Global Prehistory|Differentiation|Java Fundamentals/i
  ]
};

const allowedRelatedCourseCodes: Record<string, Set<string>> = {
  ap_precalculus: new Set(['ap_calculus_ab', 'ap_calculus_bc', 'sat_math'])
};

export function hasSubjectScopeViolation(subjectCode: string, report: unknown): boolean {
  const text = JSON.stringify(report);
  const allowedRelatedCourses = allowedRelatedCourseCodes[subjectCode] || new Set<string>();
  const explicitOtherCourse = SUBJECT_CODES
    .filter((code) => code !== subjectCode && !allowedRelatedCourses.has(code))
    .some((code) => new RegExp(escapeRegExp(SUBJECT_CATALOG[code].displayName), 'i').test(text));
  return explicitOtherCourse || (forbiddenPatterns[subjectCode] || []).some((pattern) => pattern.test(text));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
