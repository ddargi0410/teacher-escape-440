import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-stub.mjs';
import {createLearningRoom,LEARNING_STEPS} from '../learning-room.js';

function fixture(){
  globalThis.document=createDocument();
  const container=document.createElement('div');let learned=0,closed=0;
  const room=createLearningRoom({container,onLearned:()=>learned++,onClose:()=>closed++});
  const q=s=>container.querySelector(s);
  const click=s=>{const node=q(s);assert.ok(node,`missing ${s}`);node.click();};
  room.open();
  return {room,container,q,click,get learned(){return learned;},get closed(){return closed;}};
}

test('beginner room is optional and skipping does not mark learning complete',()=>{
  const f=fixture();assert.equal(f.room.isOpen(),true);
  assert.equal(LEARNING_STEPS.length,6);
  f.click('[data-learn="leave"]');assert.equal(f.room.isOpen(),false);
  assert.equal(f.container.hidden,true);assert.equal(f.learned,0);assert.equal(f.closed,1);
  f.room.close();assert.equal(f.closed,1);f.room.dispose();f.room.open();assert.equal(f.room.isOpen(),false);
});

test('request simulation produces an app that can actually be tried, without network or mission callbacks',()=>{
  const f=fixture();assert.equal(f.q('[data-learn="leaf"]'),null);
  for(const name of ['ChatGPT','Claude','Gemini'])assert.ok(f.q(`[data-service="${name}"]`));
  f.click('[data-service="Claude"]');assert.match(f.q('[data-learn="generate"]').textContent,/Claude/);
  f.click('[data-learn="generate"]');assert.equal(f.q('[data-learn="generate"]').disabled,true);
  assert.match(f.q('.learn-code-stack').textContent,/HTML/);assert.match(f.q('.learn-code-stack').textContent,/CSS/);assert.match(f.q('.learn-code-stack').textContent,/JS/);
  f.click('[data-learn="leaf-wrong"]');assert.match(f.container.textContent,/다시 골라 보세요/);
  f.click('[data-learn="leaf"]');assert.match(f.container.textContent,/잎의 모양과 잎맥을 살펴보세요/);
  assert.match(f.container.textContent,/AI 호출 없는 시연/);assert.equal(f.learned,0);
  f.click('[data-service="Gemini"]');assert.equal(f.q('[data-learn="leaf"]'),null);assert.match(f.q('[data-learn="generate"]').textContent,/Gemini/);
});

test('each concept has an original labelled SVG and illustrations follow the working demo state',()=>{
  const f=fixture();
  for(let i=0;i<6;i++){f.click(`[data-step="${i}"]`);assert.ok(f.q('svg[role="img"]'));assert.ok(f.q('svg').querySelector('title').textContent.length>12);}
  f.click('[data-step="2"]');assert.match(f.q('svg').textContent,/아래 조각/);
  for(let i=0;i<5;i++)f.click(`[data-prompt="${i}"]`);
  assert.match(f.q('svg').textContent,/다섯 조각이 모여/);
  f.click('[data-step="5"]');f.click('[data-learn="fetch"]');assert.match(f.q('svg').textContent,/민들레 정보 응답/);
  f.click('[data-learn="deploy"]');assert.match(f.q('svg').textContent,/주소로 함께 접속/);
});

test('HTML/CSS/JS demo separates structure, styling and working interaction',()=>{
  const f=fixture();f.click('[data-step="1"]');
  assert.equal(f.q('[data-learn="web-click"]').disabled,true);
  f.click('[data-part="css"]');assert.match(f.container.textContent,/초록색과 여백/);
  assert.equal(f.q('[data-learn="web-click"]').disabled,true);
  f.click('[data-part="js"]');assert.equal(f.q('[data-learn="web-click"]').disabled,false);
  f.click('[data-learn="web-click"]');assert.match(f.container.textContent,/관찰 기록 1개가 추가/);
});

test('prompt components can be assembled and revised without losing their order',()=>{
  const f=fixture();f.click('[data-step="2"]');
  for(const id of [4,2,0,3,1])f.click(`[data-prompt="${id}"]`);
  assert.match(f.q('.learn-assembled').textContent,/5\/5/);
  assert.match(f.q('.learn-assembled').textContent,/초등 과학 수업자료 제작자처럼 4학년이 사용할 숲속 생물과 환경의 관계를 배우는 큰 글씨와 선택 버튼이 있는 웹 퀴즈를 HTML 파일 하나로 만들어 줘/);
  f.click('[data-prompt="1"]');assert.match(f.q('.learn-assembled').textContent,/4\/5/);
  assert.doesNotMatch(f.q('.learn-assembled').textContent,/4학년/);
});

test('broken counter stays broken until scoped repair and then responds to verification clicks',()=>{
  const f=fixture();f.click('[data-step="3"]');f.click('[data-learn="count"]');
  assert.match(f.q('.learn-count').textContent,/^0/);assert.match(f.container.textContent,/숫자가 그대로/);
  f.click('[data-learn="repair"]');f.click('[data-learn="count"]');f.click('[data-learn="count"]');
  assert.match(f.q('.learn-count').textContent,/^2/);assert.equal(f.q('[data-learn="repair"]').disabled,true);
});

test('fact and privacy checks replace misleading content with corrected safe examples',()=>{
  const f=fixture();f.click('[data-step="4"]');
  f.click('[data-check="science"]');f.click('[data-check="privacy"]');
  assert.match(f.container.textContent,/식물도 호흡해요/);assert.match(f.container.textContent,/가상 학생 A/);
  assert.doesNotMatch(f.container.textContent,/학생 실명 · 얼굴 사진/);assert.match(f.container.textContent,/사용 조건/);
});

test('all six visited stages notify once; jumping to the end alone does not, and API/deploy are separate demos',()=>{
  const f=fixture();f.click('[data-step="5"]');assert.equal(f.learned,0);
  f.click('[data-learn="fetch"]');assert.match(f.container.textContent,/민들레 · 노란 꽃/);
  f.click('[data-learn="deploy"]');assert.match(f.container.textContent,/https:\/\/school.example/);
  assert.match(f.container.textContent,/공개 코드에 넣지 마세요/);
  for(const id of [4,3,2,1])f.click(`[data-step="${id}"]`);
  assert.equal(f.learned,1);f.click('[data-step="0"]');f.click('[data-step="5"]');assert.equal(f.learned,1);
  f.click('[data-learn="next"]');assert.equal(f.closed,1);assert.equal(f.room.isOpen(),false);
});

test('Escape closes the room once and stops the school shortcut handler',()=>{
  const f=fixture();let stopped=0,prevented=0;
  f.container.onkeydown({key:'Escape',preventDefault(){prevented++;},stopPropagation(){stopped++;}});
  assert.equal(stopped,1);assert.equal(prevented,1);assert.equal(f.closed,1);assert.equal(f.room.isOpen(),false);
});
