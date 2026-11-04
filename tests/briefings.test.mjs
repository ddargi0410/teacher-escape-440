import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS} from '../missions-data.js';
import {getArcadeData} from '../minigames/content.js';
import {getMissionBriefing, TRAINING_PROJECT} from '../minigames/briefings.js';

test('every mission explains a concrete task before play and connects it to the food-chain project',()=>{
  for(const mission of MISSIONS){
    const brief=getMissionBriefing(mission);
    assert.equal(brief.title,getArcadeData(mission).arcade.title);
    assert.equal(brief.project,TRAINING_PROJECT);
    assert.match(brief.project,/초등 5학년/);assert.match(brief.project,/먹이사슬/);
    assert.ok(brief.goal.length>=20&&brief.goal.length<=45);
    assert.equal(brief.steps.length,3);
    assert.ok(brief.steps.every(s=>s.length>10&&s.length<50));
    assert.ok(brief.win&&brief.learn&&brief.icon);
  }
});

test('briefings match real victory thresholds and keep the boss task explicit',()=>{
  assert.match(getMissionBriefing(4).win,/7권.*1권/);
  assert.match(getMissionBriefing(5).win,/3마리.*4칸/);
  assert.match(getMissionBriefing(6).win,/AI 사용법.*9개/);
  assert.match(getMissionBriefing(7).win,/11개/);
  assert.match(getMissionBriefing(9).win,/60초.*2개.*3개/);
  const boss=getMissionBriefing(10);
  assert.match(boss.goal,/AI에게 먹이사슬 수업 활동/);
  assert.match(boss.steps.join(' '),/화살표/);
  assert.match(boss.win,/6개 중 5개/);
});

test('briefings are fresh data and cannot mutate the source catalog or another opening',()=>{
  const before=JSON.stringify(MISSIONS);
  const first=getMissionBriefing(1);first.steps[0]='changed';first.title='changed';
  assert.notEqual(getMissionBriefing(1).steps[0],'changed');
  assert.notEqual(getMissionBriefing(1).title,'changed');
  assert.equal(JSON.stringify(MISSIONS),before);
  assert.throws(()=>getMissionBriefing(11),RangeError);
});
