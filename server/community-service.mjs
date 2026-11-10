// Server half of the playground community (see server/COMMUNITY-API.md).
// Framework-free: the host calls `service.handle(request)` from its existing
// HTTP server and stores data through a tiny async key-value interface.
// All game rules come from ../community/core.js, shared with the browser.
import * as core from '../community/core.js';
import {quizForDay, checkQuizAnswer, QUIZ_BANK} from '../quiz-bank.js';
import {randomUUID, randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const scrypt = promisify(scryptCallback);
export const API_VERSION = 1;
const SAVE_LIMIT = 64 * 1024;
const SESSION_DAYS = 120;
const RETENTION_DAYS = 365;

export async function hashCode(code, salt) {
  const key = await scrypt(String(code), String(salt), 32);
  return key.toString('hex');
}
async function sameHash(code, salt, expected) {
  const actual = Buffer.from(await hashCode(code, salt), 'hex'), wanted = Buffer.from(String(expected || ''), 'hex');
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

/** In-memory store for tests and local development. */
export function createMemoryStore(seed = {}) {
  const map = new Map(Object.entries(seed));
  const copy = value => value === undefined || value === null ? null : structuredClone(value);
  return {
    async get(key) { return copy(map.get(key)); },
    async set(key, value) { map.set(key, copy(value)); },
    async delete(key) { map.delete(key); },
    async list(prefix) { return [...map.entries()].filter(([key]) => key.startsWith(prefix)).map(([, value]) => copy(value)); },
    dump() { return Object.fromEntries(map); },
  };
}

class HttpError extends Error { constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra; } }
const bad = (code, message, extra) => new HttpError(400, code, message, extra);

export function createCommunityService({store, now = () => Date.now(), isAdmin = async () => false, newId = () => randomUUID(), newToken = () => randomBytes(24).toString('base64url')} = {}) {
  if (!store) throw new Error('createCommunityService needs a store');
  const keys = {
    account: key => `account:${key}`, accountId: id => `accountid:${id}`, session: token => `session:${token}`,
    tree: accountId => `tree:${accountId}`, note: id => `note:${id}`,
  };

  async function signedIn(request) {
    const header = request.headers?.authorization || request.headers?.Authorization || '';
    const token = /^Bearer ([A-Za-z0-9_-]{20,80})$/.exec(header)?.[1];
    if (!token) throw new HttpError(401, 'not_signed_in', '출근 코드로 먼저 출근해 주세요.');
    const session = await store.get(keys.session(token));
    if (!session || session.expiresAt < now()) throw new HttpError(401, 'not_signed_in', '출근 기록이 만료됐어요. 닉네임과 출근 코드로 다시 출근해 주세요.');
    const account = await store.get(keys.account(session.key));
    if (!account) throw new HttpError(401, 'not_signed_in', '출근 기록을 찾을 수 없어요.');
    return {account, token};
  }
  async function accountById(id) {
    const key = await store.get(keys.accountId(id));
    return key ? store.get(keys.account(key)) : null;
  }
  const putAccount = account => store.set(keys.account(account.nicknameKey), account);
  function summary(account) {
    const time = now();
    return {nickname: account.nickname, coffee: account.coffee || 0, coffeeGiven: account.coffeeGiven || 0, coffeeReceived: account.coffeeReceived || 0,
      notesLeft: core.notesLeft(account, time), can: core.canStatus(account, time), quizSolvedToday: account.quizDay === core.kstDay(time)};
  }
  async function activeTrees() { return (await store.list('tree:')).filter(t => t && !t.harvestedAt); }
  async function findTree(id) { return (await store.list('tree:')).find(t => t.id === id) || null; }
  async function visibleNotes() { return (await store.list('note:')).filter(n => n && !n.hidden); }

  const routes = [
    ['GET', /^\/status$/, async () => {
      const {index} = quizForDay(now());
      return {ok: true, version: API_VERSION, today: core.kstDay(now()), quizIndex: index, quizCount: QUIZ_BANK.length};
    }],
    ['POST', /^\/login$/, async request => {
      const {nickname, key} = core.validNickname(request.body?.nickname);
      const code = String(request.body?.code ?? '');
      if (!core.validCode(code)) throw bad('invalid_code', '출근 코드는 숫자 4자리예요.');
      const time = now();
      let account = await store.get(keys.account(key)), created = false;
      if (account) {
        if (account.lockedUntil && account.lockedUntil > time) throw new HttpError(423, 'locked', '출근 코드를 5번 틀려 10분 동안 잠겼어요.', {retryAt: account.lockedUntil});
        if (!(await sameHash(code, account.salt, account.codeHash))) {
          account.fails = (account.fails || 0) + 1;
          if (account.fails >= core.LIMITS.loginFailures) {
            account.fails = 0; account.lockedUntil = time + core.LIMITS.lockMinutes * 60000; await putAccount(account);
            throw new HttpError(423, 'locked', '출근 코드를 5번 틀려 10분 동안 잠겼어요.', {retryAt: account.lockedUntil});
          }
          await putAccount(account);
          throw new HttpError(403, 'wrong_code', '이 닉네임의 출근 코드와 달라요.', {remaining: core.LIMITS.loginFailures - account.fails});
        }
        account.fails = 0; account.lockedUntil = null;
      } else {
        const salt = randomBytes(16).toString('hex');
        account = {...core.freshAccount({id: newId(), nickname, key, now: time}), salt, codeHash: await hashCode(code, salt), fails: 0, lockedUntil: null};
        await store.set(keys.accountId(account.id), key); created = true;
      }
      account.lastSeenAt = time; await putAccount(account);
      const token = newToken();
      await store.set(keys.session(token), {key, createdAt: time, expiresAt: time + SESSION_DAYS * 86400000});
      return {token, created, account: summary(account), save: account.save || null, importedLocal: !!account.importedLocal};
    }],
    ['POST', /^\/logout$/, async request => { const {token} = await signedIn(request); await store.delete(keys.session(token)); return {ok: true}; }],
    ['GET', /^\/me$/, async request => {
      const {account} = await signedIn(request), time = now();
      const fresh = (account.inbox || []).filter(item => item.at > (account.inboxSeenAt || 0));
      account.inboxSeenAt = time; account.lastSeenAt = time; await putAccount(account);
      return {account: summary(account), tree: core.publicTree(await store.get(keys.tree(account.id)), account.id), inbox: fresh};
    }],
    ['PUT', /^\/save$/, async request => {
      const {account} = await signedIn(request);
      const state = request.body?.state;
      if (!state || typeof state !== 'object' || Array.isArray(state)) throw bad('invalid_save', '저장할 진행 기록이 없어요.');
      const text = JSON.stringify(state);
      if (text.length > SAVE_LIMIT) throw new HttpError(413, 'save_too_large', '진행 기록이 너무 커요.');
      account.save = {state: JSON.parse(text), updatedAt: now()}; await putAccount(account);
      return {ok: true, updatedAt: account.save.updatedAt};
    }],
    ['GET', /^\/quiz$/, async request => {
      const {index, question} = quizForDay(now());
      let solved = false;
      try { const {account} = await signedIn(request); solved = account.quizDay === core.kstDay(now()); } catch {}
      return {index, questionId: question.id, solved, total: QUIZ_BANK.length};
    }],
    ['POST', /^\/quiz\/answer$/, async request => {
      const {account} = await signedIn(request), today = quizForDay(now()).question;
      if (request.body?.questionId !== today.id) throw new HttpError(409, 'stale_quiz', '날짜가 바뀌었어요. 새 문제를 불러올게요.');
      const result = checkQuizAnswer(today.id, request.body?.choice);
      if (result.correct) { core.fillCan(account, now()); await putAccount(account); }
      return {correct: result.correct, explanation: result.explanation, can: core.canStatus(account, now())};
    }],
    ['GET', /^\/trees$/, async request => {
      let viewer = null; try { viewer = (await signedIn(request)).account.id; } catch {}
      const trees = await activeTrees();
      return {trees: core.visibleTrees(trees, viewer).map(t => core.publicTree(t, viewer)), total: trees.length};
    }],
    ['GET', /^\/trees\/search$/, async request => {
      let viewer = null; try { viewer = (await signedIn(request)).account.id; } catch {}
      return {results: core.searchTrees(await activeTrees(), request.query?.q || '', viewer)};
    }],
    ['POST', /^\/trees$/, async request => {
      const {account} = await signedIn(request);
      const tree = core.plantTree({account, tree: await store.get(keys.tree(account.id)), name: request.body?.name, id: newId(), now: now()});
      await store.set(keys.tree(account.id), tree);
      return {tree: core.publicTree(tree, account.id)};
    }],
    ['POST', /^\/trees\/([\w-]{8,64})\/water$/, async (request, [, id]) => {
      const {account} = await signedIn(request), tree = await findTree(id);
      const result = core.waterTree({account, tree, now: now()});
      if (result.kind === 'heart') {
        const owner = await accountById(tree.ownerId);
        if (owner) { core.pushInbox(owner, {type: 'water', from: account.nickname, at: now()}); await putAccount(owner); }
      }
      await store.set(keys.tree(tree.ownerId), tree); await putAccount(account);
      return {...result, tree: core.publicTree(tree, account.id), can: core.canStatus(account, now())};
    }],
    ['POST', /^\/trees\/mine\/harvest$/, async request => {
      const {account} = await signedIn(request), tree = await store.get(keys.tree(account.id));
      const result = core.harvestTree({account, tree, now: now()});
      await store.set(keys.tree(account.id), tree); await putAccount(account);
      return {...result, tree: null};
    }],
    ['POST', /^\/trees\/([\w-]{8,64})\/gift$/, async (request, [, id]) => {
      const {account} = await signedIn(request), tree = await findTree(id);
      const recipient = tree ? await accountById(tree.ownerId) : null;
      const result = core.giftCoffee({account, tree, recipient, now: now()});
      await putAccount(account); if (recipient) await putAccount(recipient); await store.set(keys.tree(tree.ownerId), tree);
      return result;
    }],
    ['POST', /^\/trees\/([\w-]{8,64})\/report$/, async (request, [, id]) => {
      const {account} = await signedIn(request), tree = await findTree(id);
      if (!tree) throw new HttpError(404, 'no_tree', '나무를 찾을 수 없어요.');
      const result = core.reportItem(tree, account.id); await store.set(keys.tree(tree.ownerId), tree);
      return result;
    }],
    ['GET', /^\/notes$/, async request => {
      let viewer = null; try { viewer = (await signedIn(request)).account.id; } catch {}
      const visible = await visibleNotes();
      const order = request.query?.order === 'random' ? 'random' : 'latest';
      const sorted = order === 'random' ? visible.sort(() => Math.random() - .5) : visible.sort((a, b) => b.createdAt - a.createdAt);
      const offset = Math.max(0, Math.floor(Number(request.query?.offset) || 0)), limit = Math.max(1, Math.min(50, Math.floor(Number(request.query?.limit) || 20)));
      const byTime = [...visible].sort((a, b) => a.createdAt - b.createdAt);
      return {notes: sorted.slice(offset, offset + limit).map(n => core.publicNote(n, viewer)), total: visible.length, decor: core.noteDecor(visible.length),
        palette: byTime.slice(-core.LIMITS.visibleNotes).map(n => n.color)};
    }],
    ['POST', /^\/notes$/, async request => {
      const {account} = await signedIn(request);
      const note = core.writeNote({account, text: request.body?.text, color: request.body?.color, id: newId(), now: now()});
      await store.set(keys.note(note.id), note); await putAccount(account);
      return {note: core.publicNote(note, account.id), notesLeft: core.notesLeft(account, now())};
    }],
    ['DELETE', /^\/notes\/([\w-]{8,64})$/, async (request, [, id]) => {
      const {account} = await signedIn(request), note = await store.get(keys.note(id));
      if (!note || note.authorId !== account.id) throw new HttpError(404, 'no_note', '내가 쓴 쪽지만 지울 수 있어요.');
      await store.delete(keys.note(id)); return {ok: true};
    }],
    ['POST', /^\/notes\/([\w-]{8,64})\/react$/, async (request, [, id]) => {
      const {account} = await signedIn(request), note = await store.get(keys.note(id));
      const result = core.reactNote({account, note, type: request.body?.type});
      if (result.active && note.authorId !== account.id) {
        const author = await accountById(note.authorId);
        if (author) { core.pushInbox(author, {type: 'reaction', reaction: result.type, from: account.nickname, at: now()}); await putAccount(author); }
      }
      await store.set(keys.note(id), note);
      return {...result, note: core.publicNote(note, account.id)};
    }],
    ['POST', /^\/notes\/([\w-]{8,64})\/report$/, async (request, [, id]) => {
      const {account} = await signedIn(request), note = await store.get(keys.note(id));
      if (!note) throw new HttpError(404, 'no_note', '쪽지를 찾을 수 없어요.');
      if (note.authorId === account.id) throw bad('own_note', '내 쪽지는 신고 대신 지울 수 있어요.');
      const result = core.reportItem(note, account.id); await store.set(keys.note(id), note);
      return result;
    }],
    ['POST', /^\/coffee\/use$/, async request => {
      const {account} = await signedIn(request);
      const result = core.useCoffee(account, request.body?.target); await putAccount(account);
      return result;
    }],
    ['POST', /^\/import$/, async request => {
      const {account} = await signedIn(request), body = request.body || {};
      if (account.importedLocal) return {ok: true, skipped: true};
      const time = now();
      account.coffee = (account.coffee || 0) + Math.max(0, Math.min(50, Math.floor(Number(body.coffee) || 0)));
      const existing = await store.get(keys.tree(account.id));
      const incoming = body.tree;
      if (incoming && (!existing || existing.harvestedAt)) {
        try {
          const tree = core.plantTree({account, tree: existing, name: incoming.name, id: newId(), now: Math.min(time, Number(incoming.plantedAt) || time)});
          tree.stage = Math.max(0, Math.min(core.FRUIT_STAGE, Math.floor(Number(incoming.stage) || 0)));
          tree.lastOwnWaterDay = /^\d{4}-\d{2}-\d{2}$/.test(incoming.lastOwnWaterDay || '') ? incoming.lastOwnWaterDay : null;
          tree.harvests = Math.max(tree.harvests || 0, Math.min(999, Math.floor(Number(body.harvests) || 0)));
          tree.lastActivityAt = time;
          await store.set(keys.tree(account.id), tree);
        } catch {}
      }
      let notes = 0;
      for (const item of (Array.isArray(body.notes) ? body.notes : []).slice(0, 30)) {
        try {
          // Device notes already passed the daily limit when they were written.
          const note = core.writeNote({account: {...account, notesDay: {day: null, count: 0}}, text: item?.text, color: item?.color, id: newId(), now: Math.min(time, Number(item?.createdAt) || time)});
          await store.set(keys.note(note.id), note); notes++;
        } catch {}
      }
      account.importedLocal = true; await putAccount(account);
      return {ok: true, notes};
    }],
    ['DELETE', /^\/me$/, async request => {
      const {account, token} = await signedIn(request);
      for (const note of await store.list('note:')) if (note.authorId === account.id) await store.delete(keys.note(note.id));
      await store.delete(keys.tree(account.id)); await store.delete(keys.accountId(account.id)); await store.delete(keys.account(account.nicknameKey));
      await store.delete(keys.session(token));
      return {ok: true};
    }],
    // Operator moderation. `isAdmin` must reuse the existing /admin password session.
    ['GET', /^\/admin\/reports$/, async request => {
      if (!(await isAdmin(request))) throw new HttpError(403, 'forbidden', '운영자만 볼 수 있어요.');
      const notes = (await store.list('note:')).filter(n => n.hidden || n.reports?.length).map(n => ({id: n.id, author: n.author, text: n.text, reports: n.reports.length, hidden: !!n.hidden, createdAt: n.createdAt}));
      const trees = (await store.list('tree:')).filter(t => t.nameHidden || t.reports?.length).map(t => ({id: t.id, owner: t.owner, name: t.name, reports: t.reports.length, hidden: !!t.nameHidden}));
      return {notes, trees};
    }],
    ['POST', /^\/admin\/notes\/([\w-]{8,64})\/(hide|unhide|delete)$/, async (request, [, id, action]) => {
      if (!(await isAdmin(request))) throw new HttpError(403, 'forbidden', '운영자만 할 수 있어요.');
      const note = await store.get(keys.note(id)); if (!note) throw new HttpError(404, 'no_note', '쪽지를 찾을 수 없어요.');
      if (action === 'delete') await store.delete(keys.note(id));
      else { note.hidden = action === 'hide'; if (action === 'unhide') note.reports = []; await store.set(keys.note(id), note); }
      return {ok: true};
    }],
    ['POST', /^\/admin\/trees\/([\w-]{8,64})\/(hide-name|unhide-name|delete)$/, async (request, [, id, action]) => {
      if (!(await isAdmin(request))) throw new HttpError(403, 'forbidden', '운영자만 할 수 있어요.');
      const tree = await findTree(id); if (!tree) throw new HttpError(404, 'no_tree', '나무를 찾을 수 없어요.');
      if (action === 'delete') await store.delete(keys.tree(tree.ownerId));
      else { tree.nameHidden = action === 'hide-name'; if (action === 'unhide-name') tree.reports = []; await store.set(keys.tree(tree.ownerId), tree); }
      return {ok: true};
    }],
  ];

  async function handle(request) {
    const method = String(request.method || 'GET').toUpperCase();
    const path = String(request.path || '/').replace(/\/+$/, '') || '/';
    try {
      for (const [verb, pattern, run] of routes) {
        if (verb !== method) continue;
        const match = pattern.exec(path);
        if (match) return {status: 200, body: await run(request, match)};
      }
      return {status: 404, body: {error: 'not_found', message: '찾을 수 없는 주소예요.'}};
    } catch (problem) {
      if (problem instanceof HttpError) return {status: problem.status, body: {error: problem.code, message: problem.message, ...problem.extra}};
      if (problem instanceof core.CommunityError) {
        const {code, message, ...extra} = problem;
        const status = ['no_tree', 'no_note'].includes(code) ? 404 : code === 'locked' ? 423 : 400;
        return {status, body: {error: code, message, ...Object.fromEntries(Object.entries(extra).filter(([key]) => !['stack'].includes(key)))}};
      }
      console.error('community service error', problem);
      return {status: 500, body: {error: 'server_error', message: '잠시 후 다시 시도해 주세요.'}};
    }
  }

  /** Run once a day: removes accounts idle for a year, with their tree and notes. */
  async function cleanup() {
    const cutoff = now() - RETENTION_DAYS * 86400000;
    let removed = 0;
    for (const account of await store.list('account:')) {
      if ((account.lastSeenAt || 0) >= cutoff) continue;
      for (const note of await store.list('note:')) if (note.authorId === account.id) await store.delete(keys.note(note.id));
      await store.delete(keys.tree(account.id)); await store.delete(keys.accountId(account.id)); await store.delete(keys.account(account.nicknameKey));
      removed++;
    }
    return {removed};
  }

  return {handle, cleanup};
}
