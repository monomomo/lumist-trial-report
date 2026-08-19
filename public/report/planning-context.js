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

export const PLANNING_SCENARIOS = Object.freeze(SCENARIOS);
export const PLANNING_SCENARIO_CODES = Object.freeze(Object.keys(SCENARIOS));
export const DEFAULT_PLANNING_SCENARIO = 'synchronous';

export function resolvePlanningScenario(value) {
  return PLANNING_SCENARIO_CODES.includes(value) ? value : DEFAULT_PLANNING_SCENARIO;
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
