import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS} from '../missions-data.js';
import {getStage2Arcade} from '../minigames/stage2-content.js';
const game=id=>getStage2Arcade(MISSIONS.find(m=>m.id===id));
const size=value=>[...value].length;

test('library expands the same five teaching steps to seven books and a distinct trap',()=>{
  const data=game(4),source=MISSIONS.find(m=>m.id===4);
  assert.equal(data.books.length,8);assert.equal(data.order.length,7);
  assert.equal(new Set(data.books.map(b=>b.id)).size,8);
  const ordered=data.order.map(id=>data.books.find(b=>b.id===id));
  assert.ok(ordered.every(b=>b&&!b.trap));
  const collapsed=ordered.map(b=>b.sourceId).filter((id,i,a)=>id!==a[i-1]);
  assert.deepEqual(collapsed,source.answer);
  assert.equal(data.books.filter(b=>b.trap).length,1);
  for(const book of ordered)assert.equal(book.originalText,source.cards.find(c=>c.id===book.sourceId).text);
});

test('each bug has four unambiguous slots and preserves the observed error rather than inventing one',()=>{
  const data=game(5);
  assert.equal(data.bugs.length,3);
  assert.deepEqual(data.slots.map(s=>s.id),['symptom','expected','error','scope']);
  for(const bug of data.bugs){
    assert.deepEqual(bug.fragments.map(f=>f.slot),data.slots.map(s=>s.id));
    assert.equal(new Set(bug.fragments.map(f=>f.id)).size,4);
    assert.equal(bug.fragments.find(f=>f.slot==='error').label,bug.errorText);
    assert.ok(bug.reproduction);
  }
  assert.equal(data.bugs[0].sourceId,'restart');
  assert.equal(data.bugs[0].errorText,'오류 메시지 없음');
  assert.ok(data.bugs.slice(1).every(b=>b.practice));
});

test('nine bubbles teach vibe-coding habits rather than recall of ecology facts',()=>{
  const data=game(6),source=MISSIONS.find(m=>m.id===6);
  assert.equal(data.statements.length,9);assert.equal(source.items.length,9);
  assert.deepEqual(data.statements.map(s=>s.wrong),[true,false,false,true,false,false,true,true,true]);
  for(const statement of data.statements){
    assert.equal(statement.originalText,source.items[statement.sourceIndex].q);
    assert.equal(statement.explanation,source.items[statement.sourceIndex].explanation);
    assert.ok(size(statement.text)<=35);
  }
  assert.match(data.title,/코딩 습관/);
  assert.match(data.statements.map(s=>s.text).join(' '),/대상 학년/);
  assert.match(data.statements.map(s=>s.text).join(' '),/오류 메시지/);
  assert.match(source.explanation,/과학 상식을 시험하지 않고/);
});

test('screening retains original categories and only uses alias on empty collection templates',()=>{
  const data=game(7),source=MISSIONS.find(m=>m.id===7);
  assert.equal(data.items.length,11);
  assert.equal(new Set(data.items.map(i=>i.id)).size,11);
  for(const item of source.items){
    const mapped=data.items.find(i=>i.sourceId===item.id);
    assert.equal(mapped.action,item.category==='ok'?'pass':'confiscate');
    assert.equal(mapped.originalText,item.text);
  }
  const alias=data.items.filter(i=>i.action==='alias');
  assert.equal(alias.length,2);
  assert.ok(alias.every(i=>i.originalText.includes('아직')&&i.aliasResult&&i.tip.includes('가상')));
  for(const id of ['phone','counsel','character','api-key','photo'])assert.equal(data.items.find(i=>i.id===id).action,'confiscate');
});

test('broadcast provides one chip per defect and separates equipment checks and save',()=>{
  const data=game(8);
  assert.deepEqual(data.chips.filter(c=>c.fix).map(c=>c.fix),['font','color','button']);
  assert.ok(data.chips.some(c=>c.fix===null&&c.label==='느낌 있게'));
  assert.ok(data.equipmentTip.includes('연결'));
  assert.ok(data.saveTip.includes('저장')&&data.saveTip.includes('현장'));
});

test('tray mapping distinguishes structure, presentation and behavior from bonus definitions',()=>{
  const data=game(9),source=MISSIONS.find(m=>m.id===9);
  assert.equal(data.duration,60);assert.equal(data.bonusSeconds,20);
  for(const [index,kind]of ['html','css','js'].entries()){
    const foods=data.foods.filter(f=>f.kind===kind);
    assert.equal(foods.length,3);
    assert.ok(foods.every(f=>f.sourceIndex===index&&f.originalText===source.items[index].q));
  }
  assert.deepEqual(data.bonus.map(b=>b.id),['deploy','console','hallucination','pages','share']);
  for(const bonus of data.bonus){assert.equal(bonus.options.length,3);assert.ok(bonus.options[bonus.answer]);assert.ok(bonus.options.every(o=>size(o)<=12));}
  assert.equal(data.bonus.find(b=>b.id==='pages').sourceIndex,4);
  assert.equal(data.bonus.find(b=>b.id==='share').sourceIndex,5);
});

test('boss uses the requested six shields and threshold without a character count gate',()=>{
  const data=game(10);
  assert.deepEqual(data.shields.map(s=>s.id),['role','audience','topic','format','constraints','output']);
  assert.equal(data.required,5);
  assert.ok(data.shields.find(s=>s.id==='format').help.includes('배치'));
  assert.ok(data.shields.find(s=>s.id==='output').help.includes('HTML'));
  assert.ok(data.details.some(d=>d.explanation.includes('글자 수 제한은 없습니다')));
  assert.equal(data.minLength,undefined);assert.equal(data.maxLength,undefined);
  assert.equal(data.hints.length,3);assert.ok(data.hints.every(h=>h.title&&h.text));
  assert.match(data.sample,/초등학교 5학년/);assert.match(data.sample,/먹이사슬/);assert.match(data.sample,/카드를 순서대로 놓고 화살표로 연결/);
});

test('new presentations neither mutate canonical content nor exceed the short-feedback budget',()=>{
  const before=JSON.stringify(MISSIONS);
  for(const mission of MISSIONS){
    const data=getStage2Arcade(mission);
    if(mission.id<4){assert.equal(data,undefined);continue;}
    assert.ok(data.title&&data.instruction&&data.icon);
    assert.ok(data.duration>=60&&data.duration<=90);
    assert.ok(data.details.length>0);
    function inspect(object){
      for(const [key,value]of Object.entries(object)){
        if(typeof value==='string'&&/tip$/i.test(key))assert.ok(size(value)<=30,`${mission.id} ${key}: ${value}`);
        else if(value&&typeof value==='object')inspect(value);
      }
    }
    inspect(data);
  }
  assert.equal(JSON.stringify(MISSIONS),before);
});
