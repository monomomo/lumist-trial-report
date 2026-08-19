const UNNATURAL_TEACHER_PERSPECTIVE_PATTERN = /我是.{0,16}的我|我作为我|由我本人我/;

export function normalizeTeacherPerspective(value: string) {
  return value
    .replace(/我是本(?:次|节)试听课的(?:任课)?(?:老师|教师|我)/g, '本次试听课由我授课')
    .replace(/我是本(?:次|节)(?:课程|课堂)的(?:任课)?(?:老师|教师|我)/g, '本次课程由我授课')
    .replace(/(?:依据|根据)(?:本次)?(?:任课)?(?:老师|教师)(?:的)?(?:记录|评语|短评)/g, '根据本次课堂情况')
    .replace(/(?:任课)?老师|教师/g, '我');
}

export function hasUnnaturalTeacherPerspective(value: string) {
  return UNNATURAL_TEACHER_PERSPECTIVE_PATTERN.test(value);
}
