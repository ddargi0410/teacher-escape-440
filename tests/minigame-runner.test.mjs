import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from './dom-stub.mjs';
import { MISSIONS } from '../missions-data.js';
import { createMinigameRunner } from '../minigames/runner.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(loaders) {
  const doc = createDocument(), listeners = new Map();
  doc.body = doc.createElement('body');
  doc.addEventListener = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  };
  doc.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn);
  doc.dispatch = type => { for (const fn of listeners.get(type) || []) fn(); };
  const container = doc.createElement('div');
  const query = container.querySelector.bind(container);
  container.querySelector = selector => {
    const node = query(selector);
    if (node) node.remove = () => {
      node.parentNode.children = node.parentNode.children.filter(child => child !== node);
    };
    return node;
  };
  const success = [], failure = [], drafts = [];
  let closes = 0;
  globalThis.document = doc;
  const runner = createMinigameRunner({
    container, loaders,
    onSuccess: (...args) => success.push(args),
    onFailure: (...args) => failure.push(args),
    onDraft: value => drafts.push(value),
    onClose: () => closes++
  });
  return { doc, container, runner, success, failure, drafts, listeners, get closes() { return closes; } };
}

function fakeModule() {
  const starts = [];
  const lifecycle = { destroyed: 0, paused: 0, resumed: 0, hinted: 0 };
  return {
    starts, lifecycle,
    start(args) {
      starts.push(args);
      return {
        destroy: () => lifecycle.destroyed++, pause: () => lifecycle.paused++,
        resume: () => lifecycle.resumed++, hint: () => lifecycle.hinted++
      };
    }
  };
}

test('closing while a module loads prevents its scene and callbacks from starting', async () => {
  const load = deferred(), module = fakeModule();
  const f = fixture({ 1: () => load.promise });
  const opened = f.runner.open(MISSIONS[0]);
  assert.equal(f.runner.isOpen(), true);
  f.runner.close();
  load.resolve(module);
  await opened;
  assert.equal(module.starts.length, 0);
  assert.equal(f.runner.isOpen(), false);
  assert.equal(f.container.hidden, true);
  assert.equal(f.doc.body.classList.contains('arcade-active'), false);
  assert.equal(f.closes, 1);
  f.runner.dispose();
});

test('only the latest asynchronous load may create a game', async () => {
  const oldLoad = deferred(), first = fakeModule(), second = fakeModule();
  const f = fixture({ 1: () => oldLoad.promise, 2: async () => second });
  const oldOpen = f.runner.open(MISSIONS[0]);
  await f.runner.open(MISSIONS[1]);
  oldLoad.resolve(first);
  await oldOpen;
  assert.equal(first.starts.length, 0);
  assert.equal(second.starts.length, 1);
  assert.equal(second.starts[0].data.arcade.title, '믹스커피 카드 캐치');
  f.runner.dispose();
  assert.equal(second.lifecycle.destroyed, 1);
});

test('each scene awards once and ignores failures after success', async () => {
  const module = fakeModule();
  const f = fixture({ 3: async () => module });
  await f.runner.open(MISSIONS[2]);
  const callbacks = module.starts[0];
  callbacks.onFail({ reason: 'wrong-answer' });
  callbacks.onWin({ answered: 5 });
  callbacks.onWin({ answered: 5 });
  callbacks.onFail({ reason: 'late-timeout' });
  assert.deepEqual(f.success, [[3, { answered: 5 }]]);
  assert.deepEqual(f.failure, [[3, { reason: 'wrong-answer' }]]);
  f.runner.close();
  callbacks.onWin({ answered: 5 });
  callbacks.onFail({ reason: 'stale-timeout' });
  assert.equal(f.success.length, 1);
  assert.equal(f.failure.length, 1);
  assert.equal(module.lifecycle.destroyed, 1);
  f.runner.dispose();
  assert.equal(module.lifecycle.destroyed, 1);
});

test('callbacks from a closed game cannot award or penalize the next game', async () => {
  const first = fakeModule(), second = fakeModule();
  const f = fixture({ 1: async () => first, 2: async () => second });
  await f.runner.open(MISSIONS[0]);
  const old = first.starts[0];
  await f.runner.open(MISSIONS[1]);
  old.onWin({ correct: 5 });
  old.onFail({ reason: 'late' });
  assert.equal(first.lifecycle.destroyed, 1);
  assert.equal(f.success.length, 0);
  assert.equal(f.failure.length, 0);
  second.starts[0].onWin({ collected: ['role'] });
  assert.equal(f.success[0][0], 2);
  f.runner.dispose();
});

test('visibility pauses and resumes the scene, and disposal removes its listener', async () => {
  const module = fakeModule();
  const f = fixture({ 1: async () => module });
  f.doc.hidden = true;
  await f.runner.open(MISSIONS[0]);
  assert.equal(module.lifecycle.paused, 1);
  f.doc.hidden = false;
  f.doc.dispatch('visibilitychange');
  assert.equal(module.lifecycle.resumed, 1);
  f.doc.hidden = true;
  f.doc.dispatch('visibilitychange');
  assert.equal(module.lifecycle.paused, 2);
  f.runner.hint();
  assert.equal(module.lifecycle.hinted, 1);
  f.runner.dispose();
  assert.equal(f.listeners.get('visibilitychange').size, 0);
  f.doc.hidden = false;
  f.doc.dispatch('visibilitychange');
  assert.equal(module.lifecycle.resumed, 1);
  assert.equal(module.lifecycle.destroyed, 1);
});

test('a module load failure leaves a working exit and does not award anything', async t => {
  t.mock.method(console, 'error', () => {});
  const f = fixture({ 1: async () => { throw new Error('network interrupted'); } });
  await f.runner.open(MISSIONS[0]);
  assert.match(f.container.querySelector('.arcade-mount').textContent, /다시 시도/);
  assert.equal(f.success.length, 0);
  assert.equal(f.failure.length, 0);
  f.container.querySelector('.arcade-exit').click();
  assert.equal(f.runner.isOpen(), false);
  assert.equal(f.closes, 1);
  f.runner.dispose();
});

test('all seven new missions use their own module and preserve the boss draft on close', async () => {
  const modules = Object.fromEntries(Array.from({length:7},(_,i)=>[i+4,fakeModule()]));
  const f=fixture(Object.fromEntries(Object.entries(modules).map(([id,module])=>[id,async()=>module])));
  for(let id=4;id<=10;id++){
    const draft=id===10?'초등학교 5학년 생태 퀴즈를 HTML 파일로 만들어 줘.':'';
    if(id===10){const original=modules[id].start;modules[id].start=args=>({...original(args),getDraft:()=>draft+' 수정 중'});}
    await f.runner.open({...MISSIONS[id-1],initialPrompt:draft});
    assert.equal(modules[id].starts.length,1);
    assert.equal(modules[id].starts[0].data.id,id);
    assert.ok(modules[id].starts[0].data.arcade.title);
    assert.equal(modules[id].starts[0].data.initialPrompt,draft);
    f.runner.close();
  }
  assert.equal(f.drafts.length,1);
  assert.match(f.drafts[0],/수정 중$/);
  assert.equal(f.success.length,0);
  assert.equal(f.failure.length,0);
  f.runner.dispose();
});
