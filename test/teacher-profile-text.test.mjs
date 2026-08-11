import assert from 'node:assert/strict';
import test from 'node:test';
import { compactCompleteText } from '../scripts/teacher-profile-text.mjs';

test('teacher summary keeps complete clauses instead of an ellipsis', () => {
  const source = '教授AP数学/计算机科学4年以上，累计辅导学生上百位；AP Calculus BC 5分，SAT数学满分，具备扎实的数学基础与标准化考试实战经验；熟悉北美高中/AP课程体系、考试重点及学生常见薄弱点，曾供职于华为成都研究所及联想集团';
  const result = compactCompleteText(source, 115);

  assert.equal(result, '教授AP数学/计算机科学4年以上，累计辅导学生上百位；AP Calculus BC 5分，SAT数学满分，具备扎实的数学基础与标准化考试实战经验。');
  assert.doesNotMatch(result, /…/u);
});

test('short teacher text remains unchanged', () => {
  const source = '拥有丰富的国际课程教学经验。';
  assert.equal(compactCompleteText(source, 115), source);
});

test('long clause falls back to a readable punctuation boundary', () => {
  const source = '注重理论与实践结合，善于通过具体题型和实际案例帮助学生理解抽象概念，同时关注知识体系搭建与长期学科发展';
  const result = compactCompleteText(source, 30);

  assert.equal(result, '注重理论与实践结合。');
});
