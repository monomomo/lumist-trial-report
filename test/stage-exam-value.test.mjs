import test from 'node:test';
import assert from 'node:assert/strict';
import { generatedStageAssessmentSchema, stageAssessmentSchema } from '../lib/reports/stage-assessment.ts';

test('exam value supports distinct abilities without fabricated scoring claims', () => {
  const common = {task:'用未见过的任务复核',target:'独立说明依据',adjustment:'针对遗漏补练'};
  assert.ok(stageAssessmentSchema.safeParse(common).success);
  for (const [objective, examValue] of [
    ['从英文题干找出所求量并选择求导法则','在陌生情境题中判断应求导数表达式还是某点的变化率'],
    ['选取史料中的细节支持历史论点','在史料分析题中用具体证据支撑论证而非复述材料'],
  ]) assert.ok(generatedStageAssessmentSchema.safeParse({...common,objective,examValue}).success);
  assert.equal(generatedStageAssessmentSchema.safeParse({...common,objective:'独立求导',examValue:'大考有12题，占15%，相当于五分水平'}).success,false);
});
