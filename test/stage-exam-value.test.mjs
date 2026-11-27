import test from 'node:test';
import assert from 'node:assert/strict';
import { zodTextFormat } from 'openai/helpers/zod';
import { generatedStageAssessmentSchema, stageAssessmentSchema } from '../lib/reports/stage-assessment.ts';

test('exam value supports distinct abilities and evidence-backed percentages', () => {
  const common = {task:'用未见过的任务复核',target:'独立说明依据',adjustment:'针对遗漏补练',currentMasteryPercent:null,currentMasteryEvidence:null,targetMasteryPercent:80,examWeight:null};
  const savedCommon = {task:common.task,target:common.target,adjustment:common.adjustment,targetMasteryPercent:80};
  assert.ok(stageAssessmentSchema.safeParse(savedCommon).success);
  for (const [objective, examValue] of [
    ['从英文题干找出所求量并选择求导法则','在陌生情境题中判断应求导数表达式还是某点的变化率'],
    ['选取史料中的细节支持历史论点','在史料分析题中用具体证据支撑论证而非复述材料'],
  ]) assert.ok(generatedStageAssessmentSchema.safeParse({...common,objective,examValue}).success);
  assert.equal(generatedStageAssessmentSchema.safeParse({...common,objective:'独立求导',examValue:'大考有12题，占15%，相当于五分水平'}).success,false);
  assert.equal(stageAssessmentSchema.safeParse({...savedCommon,currentMasteryPercent:60}).success,false);
  assert.ok(stageAssessmentSchema.safeParse({...savedCommon,currentMasteryPercent:60,currentMasteryEvidence:'试听课抽查 5 项能力，其中 3 项可独立完成'}).success);
});

test('generated stage percentages produce an OpenAI-compatible strict schema', () => {
  assert.doesNotThrow(() => zodTextFormat(generatedStageAssessmentSchema, 'stage_assessment'));
});
