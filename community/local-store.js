// Device-only community store. Used while the server has no /community API:
// trees, notes and coffee live in this browser's localStorage and follow the
// exact same rules as the server (community/core.js). On a shared school PC,
// several teachers can each keep a tree here under their own nickname.
import * as core from './core.js';
import {QUIZ_BANK, quizForDay, checkQuizAnswer} from '../quiz-bank.js';

export const LOCAL_COMMUNITY_KEY = 'teacher-escape-community-v1';
const VERSION = 1;

function blank() { return {version: VERSION, accounts: {}, trees: {}, notes: [], session: null}; }
function uuid(cryptoApi = globalThis.crypto) {
  try { if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID(); } catch {}
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
export async function hashCode(code, salt, cryptoApi = globalThis.crypto) {
  const text = `${salt}:${code}`;
  try {
    if (cryptoApi?.subtle) {
      const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return 'fnv-' + h.toString(16);
}

export function createLocalCommunity({storage = globalThis.localStorage, now = () => Date.now(), cryptoApi = globalThis.crypto} = {}) {
  let memory = null;
  function load() {
    if (memory) return memory;
    try {
      const raw = storage?.getItem(LOCAL_COMMUNITY_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      memory = parsed && parsed.version === VERSION && parsed.accounts && parsed.trees && Array.isArray(parsed.notes) ? parsed : blank();
    } catch { memory = blank(); }
    return memory;
  }
  function save() { try { storage?.setItem(LOCAL_COMMUNITY_KEY, JSON.stringify(memory)); } catch {} }
  function current() {
    const data = load();
    const account = data.session ? data.accounts[data.session] : null;
    if (!account) throw new core.CommunityError('not_signed_in', '출근 코드로 먼저 출근해 주세요.');
    return account;
  }
  const accountById = id => Object.values(load().accounts).find(a => a.id === id) || null;
  const tree = account => load().trees[account.id] || null;
  const run = fn => { try { const result = fn(); save(); return Promise.resolve(result); } catch (problem) { save(); return Promise.reject(problem); } };

  function summary(account) {
    const time = now();
    return {
      nickname: account.nickname, coffee: account.coffee || 0, coffeeGiven: account.coffeeGiven || 0,
      coffeeReceived: account.coffeeReceived || 0, notesLeft: core.notesLeft(account, time),
      can: core.canStatus(account, time), quizSolvedToday: account.quizDay === core.kstDay(time),
    };
  }

  return {
    mode: 'local',
    get signedIn() { const data = load(); return !!(data.session && data.accounts[data.session]); },
    get nickname() { const data = load(); return data.session ? data.accounts[data.session]?.nickname || null : null; },
    /** Exposes this device's data once, so it can move to the server later. */
    exportFor(nicknameKey) {
      const data = load(), account = data.accounts[nicknameKey];
      if (!account || account.migrated) return null;
      const own = data.trees[account.id];
      return {coffee: account.coffee || 0, coffeeGiven: account.coffeeGiven || 0, tree: own && !own.harvestedAt ? {...own} : null,
        harvests: own?.harvests || 0, notes: data.notes.filter(n => n.authorId === account.id).map(n => ({text: n.text, color: n.color, createdAt: n.createdAt}))};
    },
    markMigrated(nicknameKey) { const data = load(); if (data.accounts[nicknameKey]) { data.accounts[nicknameKey].migrated = true; save(); } },
    async login({nickname, code}) {
      const {nickname: name, key} = core.validNickname(nickname);
      if (!core.validCode(code)) throw new core.CommunityError('invalid_code', '출근 코드는 숫자 4자리예요.');
      const data = load(), time = now();
      let account = data.accounts[key], created = false;
      if (account) {
        if (account.lockedUntil && account.lockedUntil > time) throw new core.CommunityError('locked', '출근 코드를 5번 틀려 10분 동안 잠겼어요.', {retryAt: account.lockedUntil});
        const hash = await hashCode(code, account.salt, cryptoApi);
        if (hash !== account.codeHash) {
          account.fails = (account.fails || 0) + 1;
          if (account.fails >= core.LIMITS.loginFailures) { account.fails = 0; account.lockedUntil = time + core.LIMITS.lockMinutes * 60000; save(); throw new core.CommunityError('locked', '출근 코드를 5번 틀려 10분 동안 잠겼어요.', {retryAt: account.lockedUntil}); }
          save();
          throw new core.CommunityError('wrong_code', '이 닉네임의 출근 코드와 달라요.', {remaining: core.LIMITS.loginFailures - account.fails});
        }
        account.fails = 0; account.lockedUntil = null;
      } else {
        const salt = uuid(cryptoApi);
        account = {...core.freshAccount({id: uuid(cryptoApi), nickname: name, key, now: time}), salt, codeHash: await hashCode(code, salt, cryptoApi), fails: 0, lockedUntil: null};
        data.accounts[key] = account; created = true;
      }
      account.lastSeenAt = time; data.session = key; save();
      return {created, account: summary(account), save: null};
    },
    logout() { const data = load(); data.session = null; save(); return Promise.resolve(); },
    me() {
      return run(() => {
        const account = current(), time = now();
        const fresh = (account.inbox || []).filter(item => item.at > (account.inboxSeenAt || 0));
        account.inboxSeenAt = time;
        return {account: summary(account), tree: core.publicTree(tree(account), account.id), inbox: fresh};
      });
    },
    pushSave() { return Promise.resolve({ok: true, local: true}); },
    quiz() {
      const {index, question} = quizForDay(now());
      const data = load(), account = data.session ? data.accounts[data.session] : null;
      return Promise.resolve({index, questionId: question.id, solved: !!account && account.quizDay === core.kstDay(now()), total: QUIZ_BANK.length});
    },
    answerQuiz(questionId, choice) {
      return run(() => {
        const account = current(), today = quizForDay(now()).question;
        if (questionId !== today.id) throw new core.CommunityError('stale_quiz', '날짜가 바뀌었어요. 새 문제를 불러올게요.');
        const result = checkQuizAnswer(questionId, choice);
        if (result.correct) core.fillCan(account, now());
        return {correct: result.correct, explanation: result.explanation, can: core.canStatus(account, now())};
      });
    },
    trees() {
      const data = load(), account = data.session ? data.accounts[data.session] : null, viewer = account?.id;
      const all = Object.values(data.trees);
      return Promise.resolve({trees: core.visibleTrees(all, viewer).map(t => core.publicTree(t, viewer)), total: all.filter(t => !t.harvestedAt).length});
    },
    searchTrees(query) {
      const data = load(), account = data.session ? data.accounts[data.session] : null;
      return Promise.resolve({results: core.searchTrees(Object.values(data.trees), query, account?.id)});
    },
    plant(name) {
      return run(() => {
        const account = current(), data = load();
        data.trees[account.id] = core.plantTree({account, tree: tree(account), name, id: uuid(cryptoApi), now: now()});
        return {tree: core.publicTree(data.trees[account.id], account.id)};
      });
    },
    water(treeId) {
      return run(() => {
        const account = current(), data = load();
        const target = Object.values(data.trees).find(t => t.id === treeId && !t.harvestedAt);
        const result = core.waterTree({account, tree: target, now: now()});
        if (result.kind === 'heart') { const owner = accountById(target.ownerId); if (owner) core.pushInbox(owner, {type: 'water', from: account.nickname, at: now()}); }
        return {...result, tree: core.publicTree(target, account.id), can: core.canStatus(account, now())};
      });
    },
    harvest() {
      return run(() => {
        const account = current();
        const result = core.harvestTree({account, tree: tree(account), now: now()});
        return {...result, tree: null};
      });
    },
    gift(treeId) {
      return run(() => {
        const account = current(), data = load();
        const target = Object.values(data.trees).find(t => t.id === treeId && !t.harvestedAt);
        const recipient = target ? accountById(target.ownerId) : null;
        return core.giftCoffee({account, tree: target, recipient, now: now()});
      });
    },
    reportTree(treeId) {
      return run(() => {
        const account = current(), target = Object.values(load().trees).find(t => t.id === treeId);
        if (!target) throw new core.CommunityError('no_tree', '나무를 찾을 수 없어요.');
        return core.reportItem(target, account.id);
      });
    },
    notes({order = 'latest', offset = 0, limit = 20} = {}) {
      const data = load(), account = data.session ? data.accounts[data.session] : null;
      const visible = data.notes.filter(n => !n.hidden);
      const sorted = order === 'random' ? [...visible].sort(() => Math.random() - .5) : [...visible].sort((a, b) => b.createdAt - a.createdAt);
      const start = Math.max(0, Math.floor(offset) || 0), size = Math.max(1, Math.min(50, Math.floor(limit) || 20));
      return Promise.resolve({notes: sorted.slice(start, start + size).map(n => core.publicNote(n, account?.id)), total: visible.length, decor: core.noteDecor(visible.length),
        palette: visible.slice(-core.LIMITS.visibleNotes).map(n => n.color)});
    },
    writeNote(text, color) {
      return run(() => {
        const account = current(), data = load();
        const note = core.writeNote({account, text, color, id: uuid(cryptoApi), now: now()});
        data.notes.push(note);
        return {note: core.publicNote(note, account.id), notesLeft: core.notesLeft(account, now())};
      });
    },
    deleteNote(id) {
      return run(() => {
        const account = current(), data = load(), index = data.notes.findIndex(n => n.id === id && n.authorId === account.id);
        if (index < 0) throw new core.CommunityError('no_note', '내가 쓴 쪽지만 지울 수 있어요.');
        data.notes.splice(index, 1);
        return {ok: true};
      });
    },
    react(id, type) {
      return run(() => {
        const account = current(), note = load().notes.find(n => n.id === id);
        const result = core.reactNote({account, note, type});
        if (result.active && note.authorId !== account.id) { const author = accountById(note.authorId); if (author) core.pushInbox(author, {type: 'reaction', reaction: type, from: account.nickname, at: now()}); }
        return {...result, note: core.publicNote(note, account.id)};
      });
    },
    reportNote(id) {
      return run(() => {
        const account = current(), note = load().notes.find(n => n.id === id);
        if (!note) throw new core.CommunityError('no_note', '쪽지를 찾을 수 없어요.');
        if (note.authorId === account.id) throw new core.CommunityError('own_note', '내 쪽지는 신고 대신 지울 수 있어요.');
        return core.reportItem(note, account.id);
      });
    },
    useCoffee(target) { return run(() => core.useCoffee(current(), target)); },
    deleteAccount() {
      return run(() => {
        const account = current(), data = load();
        delete data.trees[account.id];
        data.notes = data.notes.filter(n => n.authorId !== account.id);
        delete data.accounts[account.nicknameKey]; data.session = null;
        return {ok: true};
      });
    },
  };
}
