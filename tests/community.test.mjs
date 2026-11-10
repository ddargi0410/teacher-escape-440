import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../community/core.js';
import {checkText} from '../community/filter.js';
import {QUIZ_BANK, quizForDay, checkQuizAnswer} from '../quiz-bank.js';
import {createLocalCommunity} from '../community/local-store.js';
import {createServerCommunity} from '../community/server-client.js';
import {createCommunity} from '../community/index.js';
import {createCommunityService, createMemoryStore} from '../server/community-service.mjs';

function memoryStorage() { const map = new Map(); return {getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map}; }
// 2026-11-10 10:00 KST
const START = Date.UTC(2026, 10, 10, 1, 0, 0);
const DAY = 86400000;

test('KST dates switch at Korean midnight, not UTC midnight', () => {
  assert.equal(core.kstDay(Date.UTC(2026, 10, 10, 14, 59)), '2026-11-10');
  assert.equal(core.kstDay(Date.UTC(2026, 10, 10, 15, 0)), '2026-11-11');
  assert.equal(core.quizIndexFor(Date.UTC(2026, 10, 10, 14, 59), 60), core.quizIndexFor(Date.UTC(2026, 10, 10, 1, 0), 60));
  assert.notEqual(core.quizIndexFor(Date.UTC(2026, 10, 10, 15, 0), 60), core.quizIndexFor(Date.UTC(2026, 10, 10, 14, 59), 60));
});

test('quiz bank: 60 well-formed questions, unique ids, one valid answer each', () => {
  assert.equal(QUIZ_BANK.length, 60);
  assert.equal(new Set(QUIZ_BANK.map(q => q.id)).size, 60);
  for (const q of QUIZ_BANK) {
    assert(q.prompt.length > 8 && q.prompt.length < 90, q.id);
    assert(q.options.length >= 3 && q.options.length <= 4, q.id);
    assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.id);
    assert(q.explanation.length > 8 && q.explanation.length <= 60, `${q.id} explanation must stay one line`);
    assert.equal(new Set(q.options).size, q.options.length, q.id);
    // The topic badge is shown above the options, so it must not name one of them.
    assert(!q.options.some(option => option.includes(q.topic) || q.topic.includes(option)), `${q.id} topic gives the answer away`);
  }
  // Correct answers are not all in the first slot.
  assert(new Set(QUIZ_BANK.map(q => q.answer)).size >= 3);
  const today = quizForDay(START);
  assert.equal(checkQuizAnswer(today.question.id, today.question.answer).correct, true);
  assert.equal(checkQuizAnswer(today.question.id, (today.question.answer + 1) % today.question.options.length).correct, false);
});

test('filter blocks personal details and abuse, keeps everyday teacher talk', () => {
  for (const blocked of ['010-1234-5678 연락 주세요', '010-1234-567', '010 1234 5678', '0 1 0 1 2 3 4 5 6 7 8', '문의는 teacher@school.kr', '문남초 최고', '인천문남초등학교 6학년', '3학년 2반 김민수 칭찬', '씨발 퇴근', '시 발', '병신같은 공문']) {
    assert.equal(checkText(blocked).ok, false, blocked);
  }
  for (const allowed of ['오늘도 무사 퇴근!', '저는 초등학교 교사예요', '학기초는 늘 바빠요', '새끼손가락 걸고 약속', '복도 불이 꺼져서 무서웠어요', '퇴근초 최고', '기초부터 차근차근', '미친 듯이 바빴던 하루', '6학년 담임 화이팅']) {
    assert.equal(checkText(allowed).ok, true, allowed);
  }
  assert.equal(checkText('').reason, 'empty');
  assert.equal(checkText('가'.repeat(81)).reason, 'long');
  assert.equal(checkText('문남초 최고').message, '미션 7 기억나시죠? 이 게시판도 학교 밖이에요.');
});

test('tree rules: daily own growth to fruit, hearts from others, harvest yield', () => {
  const me = core.freshAccount({id: 'me', nickname: '나', key: '나'}), friend = core.freshAccount({id: 'friend', nickname: '동료', key: '동료'});
  const tree = core.plantTree({account: me, name: '첫 커피', id: 't1', now: START});
  assert.equal(tree.stage, 0);
  assert.throws(() => core.waterTree({account: me, tree, now: START}), {code: 'empty_can'});
  core.fillCan(me, START);
  assert.equal(core.waterTree({account: me, tree, now: START}).stage, 1);
  assert.throws(() => core.waterTree({account: me, tree, now: START + 60000}), {code: 'already_watered'});
  // Yesterday's can is empty today.
  assert.throws(() => core.waterTree({account: me, tree, now: START + DAY}), {code: 'empty_can'});
  for (let day = 1; day <= 3; day++) { core.fillCan(me, START + day * DAY); core.waterTree({account: me, tree, now: START + day * DAY}); }
  assert.equal(tree.stage, core.FRUIT_STAGE);
  core.fillCan(me, START + 4 * DAY);
  assert.throws(() => core.waterTree({account: me, tree, now: START + 4 * DAY}), {code: 'ready_to_harvest'});
  core.fillCan(friend, START);
  const heart = core.waterTree({account: friend, tree, now: START});
  assert.equal(heart.kind, 'heart'); assert.equal(tree.stage, core.FRUIT_STAGE, 'friend water never grows the tree');
  assert.throws(() => core.waterTree({account: friend, tree, now: START}), {code: 'already_watered_other'});
  tree.hearts = 7;
  assert.equal(core.harvestYield(0), 1); assert.equal(core.harvestYield(3), 2); assert.equal(core.harvestYield(7), 3); assert.equal(core.harvestYield(99), 5);
  const result = core.harvestTree({account: me, tree, now: START + 4 * DAY});
  assert.equal(result.amount, 3); assert.equal(me.coffee, 3); assert.equal(tree.harvests, 1);
  const replanted = core.plantTree({account: me, tree, name: '두 번째', id: 't2', now: START + 4 * DAY});
  assert.equal(replanted.harvests, 1, 'stars carry over to the next tree');
});

test('other-tree watering stops at five trees per day', () => {
  const me = core.freshAccount({id: 'me', nickname: '나', key: '나'});
  core.fillCan(me, START);
  for (let i = 0; i < 5; i++) core.waterTree({account: me, tree: {id: 'x' + i, ownerId: 'o' + i, stage: 0, hearts: 0}, now: START});
  assert.throws(() => core.waterTree({account: me, tree: {id: 'x9', ownerId: 'o9', stage: 0, hearts: 0}, now: START}), {code: 'other_limit'});
  assert.equal(core.canStatus(me, START).others, 0);
});

test('notes: three per Korean day, reactions toggle, three reports hide', () => {
  const me = core.freshAccount({id: 'me', nickname: '나', key: '나'});
  for (let i = 0; i < 3; i++) core.writeNote({account: me, text: '오늘도 화이팅 ' + i, color: 'pink', id: 'n' + i, now: START});
  assert.throws(() => core.writeNote({account: me, text: '네 번째', color: 'pink', id: 'n4', now: START}), {code: 'note_limit'});
  assert.equal(core.writeNote({account: me, text: '다음 날', color: 'nope', id: 'n5', now: START + DAY}).color, 'yellow');
  const note = core.writeNote({account: core.freshAccount({id: 'a', nickname: 'a', key: 'a'}), text: '퇴근하고 싶다', color: 'mint', id: 'n6', now: START});
  assert.deepEqual(core.reactNote({account: me, note, type: 'pat'}), {type: 'pat', active: true, count: 1});
  assert.deepEqual(core.reactNote({account: me, note, type: 'pat'}), {type: 'pat', active: false, count: 0});
  core.reportItem(note, 'r1'); core.reportItem(note, 'r1'); core.reportItem(note, 'r2');
  assert.equal(note.hidden, false, 'the same reporter counts once');
  core.reportItem(note, 'r3');
  assert.equal(note.hidden, true);
  assert.deepEqual(core.noteDecor(101), {total: 101, hanging: 101, lights: true, bigTree: false});
  assert.deepEqual(core.noteDecor(900), {total: 900, hanging: 300, lights: true, bigTree: true});
  assert.equal(core.noteDecor(100).lights, false);
});

test('visible trees: mine first, then most recent activity, at most 60', () => {
  const trees = Array.from({length: 80}, (_, i) => ({id: 't' + i, ownerId: 'o' + i, lastActivityAt: i, stage: 0}));
  const list = core.visibleTrees(trees, 'o3');
  assert.equal(list.length, 60); assert.equal(list[0].id, 't3'); assert.equal(list[1].id, 't79');
});

async function exercise(api, label) {
  await assert.rejects(api.plant('나무'), {code: 'not_signed_in'}, label);
  const first = await api.login({nickname: '커피 선생님', code: '1234'});
  assert.equal(first.created, true, label);
  await assert.rejects(api.water('nothing-here'), {code: 'no_tree'}, label);
  const planted = await api.plant('아메리카노');
  assert.equal(planted.tree.stage, 0, label);
  await assert.rejects(api.water(planted.tree.id), {code: 'empty_can'}, label);
  const quiz = await api.quiz();
  const question = QUIZ_BANK.find(q => q.id === quiz.questionId);
  const wrong = await api.answerQuiz(question.id, (question.answer + 1) % question.options.length);
  assert.equal(wrong.correct, false, label); assert(wrong.explanation, label);
  const right = await api.answerQuiz(question.id, question.answer);
  assert.equal(right.correct, true, label); assert.equal(right.can.own, true, label);
  const watered = await api.water(planted.tree.id);
  assert.equal(watered.stage, 1, label);
  await assert.rejects(api.water(planted.tree.id), {code: 'already_watered'}, label);
  const note = await api.writeNote('오늘도 정시 퇴근 성공!', 'sky');
  assert.equal(note.notesLeft, 2, label);
  await assert.rejects(api.writeNote('010 1234 5678로 연락', 'sky'), {code: 'blocked_text'}, label);
  const listed = await api.notes({});
  assert.equal(listed.total, 1, label); assert.equal(listed.notes[0].own, true, label);
  await api.logout();
  await assert.rejects(api.login({nickname: '커피 선생님', code: '9999'}), {code: 'wrong_code', remaining: 4}, label);
  for (let i = 0; i < 3; i++) await assert.rejects(api.login({nickname: '커피 선생님', code: '9999'}), {code: 'wrong_code'}, label);
  await assert.rejects(api.login({nickname: '커피 선생님', code: '9999'}), {code: 'locked'}, label);
  await assert.rejects(api.login({nickname: '커피 선생님', code: '1234'}), {code: 'locked'}, label);
  // A second teacher on the same field.
  await api.login({nickname: '동료 선생님', code: '4321'});
  await api.answerQuiz(question.id, question.answer);
  const heart = await api.water(planted.tree.id);
  assert.equal(heart.kind, 'heart', label); assert.equal(heart.tree.stage, 1, label);
  const reacted = await api.react(listed.notes[0].id, 'pat');
  assert.equal(reacted.count, 1, label);
  const search = await api.searchTrees('아메리');
  assert.equal(search.results.length, 1, label); assert.equal(search.results[0].mine, false, label);
}

test('device-only store follows every rule', async () => {
  let time = START;
  const api = createLocalCommunity({storage: memoryStorage(), now: () => time});
  await exercise(api, 'local');
  time += 11 * 60000;
  const back = await api.login({nickname: '커피 선생님', code: '1234'});
  assert.equal(back.created, false);
  const me = await api.me();
  assert.equal(me.tree.hearts, 1); assert.equal(me.inbox.some(item => item.type === 'water' && item.from === '동료 선생님'), true);
});

test('browser client and server module agree (fake network, real handlers)', async () => {
  let time = START;
  const store = createMemoryStore();
  const service = createCommunityService({store, now: () => time});
  const fetcher = async (url, init) => {
    const target = new URL(url);
    const response = await service.handle({method: init.method, path: target.pathname.replace('/api/community', ''), query: Object.fromEntries(target.searchParams), headers: Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), body: init.body ? JSON.parse(init.body) : null});
    return {ok: response.status < 400, status: response.status, json: async () => response.body};
  };
  const api = createServerCommunity({base: 'https://example.test/api/community', fetcher, storage: memoryStorage()});
  assert.equal((await api.status()).ok, true);
  await exercise(api, 'server');
  time += 11 * 60000;
  await api.login({nickname: '커피 선생님', code: '1234'});
  const me = await api.me();
  assert.equal(me.tree.hearts, 1);
  // Codes are never stored in plain text.
  assert(!JSON.stringify(store.dump()).includes('"1234"'));
  const save = await api.pushSave({completed: [1, 2], name: '커피 선생님'});
  assert(save.updatedAt);
  const again = await api.login({nickname: '커피 선생님', code: '1234'});
  assert.deepEqual(again.save.state.completed, [1, 2]);
});

test('device data moves to the server on first sign-in there', async () => {
  let time = START;
  const storage = memoryStorage();
  const local = createLocalCommunity({storage, now: () => time});
  await local.login({nickname: '이사 선생님', code: '2468'});
  await local.plant('이사 가는 나무');
  await local.writeNote('운동장 첫 쪽지', 'mint');
  const service = createCommunityService({store: createMemoryStore(), now: () => time});
  const fetcher = async (url, init) => {
    const target = new URL(url);
    const response = await service.handle({method: init.method, path: target.pathname.replace('/api/community', ''), query: Object.fromEntries(target.searchParams), headers: Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), body: init.body ? JSON.parse(init.body) : null});
    return {ok: response.status < 400, status: response.status, json: async () => response.body};
  };
  const community = createCommunity({base: 'https://example.test/api/community', fetcher, storage, now: () => time});
  assert.equal(await community.ready, 'server');
  const result = await community.login({nickname: '이사 선생님', code: '2468'});
  assert.equal(result.migrated, true);
  const me = await community.me();
  assert.equal(me.tree.name, '이사 가는 나무');
  assert.equal((await community.notes({})).total, 1);
  // Never imported twice.
  await community.logout();
  const second = await community.login({nickname: '이사 선생님', code: '2468'});
  assert.equal(second.migrated, undefined);
  assert.equal((await community.notes({})).total, 1);
});

test('unreachable server falls back to device-only mode', async () => {
  const community = createCommunity({base: 'https://example.test/api/community', fetcher: async () => { throw new Error('offline'); }, storage: memoryStorage(), probeTimeoutMs: 50});
  assert.equal(await community.ready, 'local');
  assert.equal(community.deviceOnly, true);
  const result = await community.login({nickname: '혼자 선생님', code: '1357'});
  assert.equal(result.created, true);
});

test('server moderation endpoints require the operator session', async () => {
  const service = createCommunityService({store: createMemoryStore(), now: () => START, isAdmin: async request => request.headers['x-admin'] === 'yes'});
  assert.equal((await service.handle({method: 'GET', path: '/admin/reports', headers: {}})).status, 403);
  assert.equal((await service.handle({method: 'GET', path: '/admin/reports', headers: {'x-admin': 'yes'}})).status, 200);
});
