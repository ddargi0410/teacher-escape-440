// Run: node --test tests/missions.test.mjs
// Exercises real mission event handlers against a DOM simulation. Browser
// rendering, drag hit testing and WebGL need the separate browser QA pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-stub.mjs';
import {MISSIONS} from '../missions-data.js';
import {createMissionUI,evaluatePrompt} from '../missions-ui.js';

function fixture(id,{relaxed=true}={}){
  globalThis.document=createDocument();
  const container=document.createElement('div'),successes=[],failures=[],closes=[];
  let draft='';
  const ui=createMissionUI({container,getRelaxed:()=>relaxed,getDraft:()=>draft,
    onDraft:value=>{draft=value;},onSuccess:(mission,payload)=>successes.push({mission,payload}),
    onFailure:mission=>failures.push(mission),onClose:()=>closes.push(true)});
  const find=selector=>{const node=container.querySelector(selector);assert.ok(node,`Missing element ${selector}`);return node;};
  const click=selector=>find(selector).click();
  const next=()=>click('.feedback-next');
  const wrongOnce=selector=>{
    const before=failures.length,button=find(selector);
    button.click();assert.equal(failures.length,before+1,'one failed submission adds one penalty');
    button.onclick?.({preventDefault(){},stopPropagation(){}});
    assert.equal(failures.length,before+1,'duplicate handler invocation cannot add another penalty');
  };
  const finish=(closeViaX=false)=>{
    assert.equal(successes.length,1,'completion is awarded immediately on the success screen');
    assert.equal(successes[0].mission,id);
    assert.ok(find('.mission-clear'));
    click(closeViaX?'.mission-close':'.collect-card');
    assert.equal(ui.isOpen(),false);assert.equal(successes.length,1);
    ui.close();assert.equal(closes.length,1,'closing twice remains idempotent');
  };
  ui.open(id);
  return {ui,container,find,click,next,wrongOnce,finish,successes,failures,closes,get draft(){return draft;}};
}
const mission=id=>MISSIONS.find(m=>m.id===id);
const answerIndex=(m,q)=>m.type==='ox'?(q.answer?0:1):q.answer;
function answerRounds(f,m){for(const q of m.items){f.click(`[data-choice="${answerIndex(m,q)}"]`);f.next();}}
function drop(target,id){target.ondrop({preventDefault(){},dataTransfer:{getData:()=>id}});}

test('mission catalog has ten unique playable formats and valid quiz answers',()=>{
  assert.equal(MISSIONS.length,10);assert.equal(new Set(MISSIONS.map(m=>m.id)).size,10);
  assert.equal(new Set(MISSIONS.map(m=>m.type)).size,10);
  for(const m of MISSIONS){assert.ok(m.title&&m.npc&&m.intro&&m.hint&&m.card.title&&m.card.body);
    for(const q of m.items||[]){if(q.options)assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length);}
  }
});

for(const id of [1,3])test(`mission ${id}: incorrect answer, retry, every round, close preserves success`,()=>{
  const f=fixture(id),m=mission(id),first=answerIndex(m,m.items[0]);
  f.wrongOnce(`[data-choice="${first===0?1:0}"]`);f.next();
  answerRounds(f,m);f.finish(true);assert.equal(f.failures.length,1);
});

test('mission 2: incomplete prompt fails; both drag and tap card assembly can finish',()=>{
  const f=fixture(2),m=mission(2);f.wrongOnce('#check-assemble');f.next();
  m.slots.forEach((slot,index)=>{
    const card=m.cards.find(c=>c.slot===slot.id);
    if(index%2===0)drop(f.find(`[data-slot="${slot.id}"]`),card.id);
    else{f.click(`[data-card="${card.id}"]`);f.click(`[data-slot="${slot.id}"]`);}
  });
  assert.equal(f.container.querySelectorAll('[data-card]').length,m.cards.length-m.slots.length,'distractors remain unused');
  f.click('#check-assemble');f.next();f.finish();
});

test('mission 4: wrong sequence retries; arrow controls produce the intended sequence',()=>{
  const f=fixture(4),m=mission(4);
  const order=()=>f.container.querySelectorAll('[data-order]').map(n=>n.dataset.order);
  if(JSON.stringify(order())===JSON.stringify(m.answer))f.click('[data-move="0"][data-direction="1"]');
  f.wrongOnce('#check-order');f.next();
  m.answer.forEach((id,target)=>{let index=order().indexOf(id);while(index>target){f.click(`[data-move="${index}"][data-direction="-1"]`);index--;}});
  assert.deepEqual(order(),m.answer);f.click('#check-order');f.next();f.finish();
});

test('mission 5: probe broken preview, identify symptom, and repair request retry',()=>{
  const f=fixture(5),m=mission(5),broken=m.screen.buttons.find(b=>b.bug),working=m.screen.buttons.find(b=>!b.bug);
  f.click(`[data-probe="${broken.id}"]`);assert.equal(f.find('.bug-log').textContent,broken.result);
  assert.equal(f.find('.bug-log').classList.contains('error'),true);
  f.wrongOnce(`[data-bug="${working.id}"]`);f.next();
  f.click(`[data-bug="${broken.id}"]`);f.next();
  f.wrongOnce(`[data-choice="${m.repair.answer===0?1:0}"]`);f.next();
  f.click(`[data-choice="${m.repair.answer}"]`);f.next();f.finish();assert.equal(f.failures.length,2);
});

test('mission 6: select all false science claims, keeping correct claims unselected',()=>{
  const f=fixture(6),m=mission(6);f.wrongOnce('#check-science');f.next();
  m.items.forEach((q,i)=>{if(q.wrong)f.click(`[data-fact="${i}"]`);});
  f.click('#check-science');f.next();f.finish();
});

test('mission 7: incomplete classification fails; drag and keyboard bins complete',()=>{
  const f=fixture(7),m=mission(7);f.wrongOnce('#check-sort');f.next();
  m.items.forEach((item,index)=>{
    if(index%2===0)drop(f.find(`[data-bin="${item.category}"]`),item.id);
    else{f.click(`[data-sort="${item.id}"]`);f.find(`[data-bin="${item.category}"]`).onkeydown({key:'Enter',preventDefault(){}});}
  });
  assert.equal(f.container.querySelectorAll('[data-sort]').length,0);
  f.click('#check-sort');f.next();f.finish();
});

test('mission 8: all three AI revision turns support retry and preserve progression',()=>{
  const f=fixture(8),m=mission(8);
  for(const turn of m.turns){f.wrongOnce(`[data-choice="${turn.answer===0?1:0}"]`);f.next();f.click(`[data-choice="${turn.answer}"]`);f.next();}
  f.finish();assert.equal(f.failures.length,3);
});

test('mission 9: relaxed mode completes all six terms after a wrong-answer retry',()=>{
  const f=fixture(9),m=mission(9);f.click('#speed-start');
  assert.equal(f.find('#speed-time').textContent,'∞');
  f.wrongOnce(`[data-choice="${m.items[0].answer===0?1:0}"]`);f.next();
  answerRounds(f,m);f.finish();
});

test('mission 9: timer pauses for hidden tabs and feedback, times out once, and restarts',()=>{
  const originals={setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,performance:globalThis.performance};
  let now=0,callback=null;
  globalThis.setInterval=fn=>{callback=fn;return 1;};globalThis.clearInterval=()=>{callback=null;};
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
  const advance=seconds=>{now+=seconds*1000;callback?.();};
  let f;
  try{
    f=fixture(9,{relaxed:false});f.click('#speed-start');
    advance(10);assert.equal(f.find('#speed-time').textContent,'80초');
    document.hidden=true;document.dispatch('visibilitychange');advance(120);assert.equal(f.find('#speed-time').textContent,'80초');
    document.hidden=false;document.dispatch('visibilitychange');
    f.click(`[data-choice="${mission(9).items[0].answer}"]`);advance(120);assert.equal(f.find('#speed-time').textContent,'80초');
    f.next();advance(81);assert.equal(f.failures.length,1);advance(120);assert.equal(f.failures.length,1);
    f.next();assert.ok(f.find('#speed-start'));f.click('#speed-start');assert.equal(f.find('#speed-time').textContent,'90초');
    f.ui.close();assert.equal(callback,null,'closing clears the active timer');
  }finally{
    f?.ui.close();globalThis.setInterval=originals.setInterval;globalThis.clearInterval=originals.clearInterval;
    Object.defineProperty(globalThis,'performance',{configurable:true,value:originals.performance});
  }
});

test('mission 10: draft saved, one penalty per submission, boundary retry, success survives ×',()=>{
  const f=fixture(10),m=mission(10);f.wrongOnce('#check-prompt');
  const input=f.find('#boss-prompt');input.value=m.sample;input.oninput({target:input});assert.equal(f.draft,m.sample);
  f.click('#check-prompt');assert.equal(f.successes.length,0,'the final boundary choice is still required');
  const wrong=m.boundary.options.findIndex(o=>!o.ok),correct=m.boundary.options.findIndex(o=>o.ok);
  f.click(`[data-boundary="${wrong}"]`);assert.equal(f.failures.length,1,'boundary joke does not impose a learning penalty');
  f.click('#boundary-retry');f.click(`[data-boundary="${correct}"]`);
  assert.equal(f.successes[0].payload.prompt,m.sample);f.finish(true);
});

test('boss draft survives closing/reopening; closing an unfinished mission awards nothing',()=>{
  const f=fixture(10),input=f.find('#boss-prompt');input.value='초등학교 5학년을 위한 생태 탐구 자료를 만들어 줘.';input.oninput({target:input});
  f.ui.close();assert.equal(f.successes.length,0);f.ui.open(10);assert.equal(f.find('#boss-prompt').value,f.draft);f.ui.close();
});

test('rubric: valid practical variants pass; keyword-only and unsafe/unchecked requests fail',()=>{
  const sample=mission(10).sample;
  const variants=[sample,sample.replaceAll('5학년','6학년').replaceAll('태블릿','모바일').replaceAll('3문항','4문항'),
    '초등학교 4학년 과학에서 생물의 환경 적응을 이해하는 클릭 퀴즈를 만들어 줘. 3문항을 선택하면 정답과 해설을 보여 줘. PC 브라우저에서 실행하고 개인정보는 수집하지 마. 직접 그린 도형만 사용해 줘. HTML 파일 하나로 만들어 줘. 먼저 과학 내용을 검증할 문항을 보여 주고 다음 단계에서 버튼 동작을 테스트하자. 오늘은 3문항 시제품까지만 만들고 다른 기능은 제외하자. 수정할 때 요청한 부분만 바꾸고 나머지 기능은 유지해 줘.'];
  for(const prompt of variants)assert.equal(evaluatePrompt(prompt).passed,true);
  for(const prompt of ['', '초등 5학년 생태 퀴즈 HTML 검증 먼저 다음 유지 범위',sample+' 실제 학생 이름을 포함해 줘.',sample+' 검증하지 마.',sample.replaceAll('초등학교 5학년','중학교 1학년')])assert.equal(evaluatePrompt(prompt).passed,false);
});
