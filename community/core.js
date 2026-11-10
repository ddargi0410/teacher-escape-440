// Rules for the playground community: coffee trees, the faucet quiz and the
// zelkova guestbook. Pure functions shared by the browser (device-only mode)
// and the server, so both enforce exactly the same limits.
import {checkText, cleanText} from './filter.js';

export const LIMITS = Object.freeze({
  treeName: 12,
  note: 80,
  notesPerDay: 3,
  otherTreesPerDay: 5,
  heartsPerBonus: 3,
  maxHarvest: 5,
  visibleTrees: 60,
  visibleNotes: 300,
  notesForLights: 100,
  notesForBigTree: 500,
  reportsToHide: 3,
  loginFailures: 5,
  lockMinutes: 10,
  inbox: 30,
});

export const STAGES = Object.freeze(['씨앗', '새싹', '묘목', '하얀 꽃', '빨간 열매']);
export const FRUIT_STAGE = STAGES.length - 1;
export const PAPER_COLORS = Object.freeze([
  {id: 'yellow', label: '노랑', hex: '#ffe58a'},
  {id: 'pink', label: '분홍', hex: '#ffc2cf'},
  {id: 'mint', label: '민트', hex: '#bfead2'},
  {id: 'sky', label: '하늘', hex: '#bfe1ff'},
  {id: 'white', label: '하양', hex: '#fffaf0'},
]);
export const REACTIONS = Object.freeze([
  {id: 'me_too', emoji: '🙋', label: '나도요'},
  {id: 'pat', emoji: '🤗', label: '토닥토닥'},
  {id: 'go_home', emoji: '🏃', label: '퇴근하세요'},
]);
export const COFFEE_USES = Object.freeze(['mentor', 'rest']);

export class CommunityError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}
const error = (code, message, extra) => new CommunityError(code, message, extra);

const DAY = 86400000, KST = 9 * 3600000;
/** Korea has no daylight-saving time, so a fixed +9 hour shift is exact. */
export function kstDay(now = Date.now()) { return new Date(Number(now) + KST).toISOString().slice(0, 10); }
export function kstDayNumber(now = Date.now()) { return Math.floor((Number(now) + KST) / DAY); }
/** Same question for everyone on the same Korean date. */
export function quizIndexFor(now, length) {
  const n = Math.max(1, Math.floor(Number(length) || 1));
  return ((kstDayNumber(now) % n) + n) % n;
}
/** Milliseconds until the next Korean midnight. */
export function msUntilKstMidnight(now = Date.now()) { return DAY - ((Number(now) + KST) % DAY); }

/** "수진" → "수진 선생님", but "정시퇴근 선생님" or "수진쌤" stays as typed. */
export function teacherTitle(nickname) {
  const name = String(nickname ?? '').trim();
  return /(선생님|쌤|샘|교사|선생)$/.test(name) ? name : `${name} 선생님`;
}

export function normalizeNickname(value) {
  const nickname = cleanText(value, 24).replace(/\s+/g, ' ');
  return {nickname, key: nickname.toLowerCase().replace(/\s/g, '')};
}
export function validCode(code) { return /^\d{4}$/.test(String(code ?? '')); }
export function validNickname(value) {
  const {nickname, key} = normalizeNickname(value);
  if (!key) throw error('invalid_nickname', '닉네임을 적어 주세요.');
  if (nickname === '퇴근희망 교사') throw error('invalid_nickname', '나만의 닉네임을 적어 주세요.');
  const check = checkText(nickname, {max: 24});
  if (!check.ok) throw error('blocked_text', check.message, {detail: check.detail});
  return {nickname, key};
}

export function freshAccount({id, nickname, key, now = Date.now()}) {
  return {
    id, nickname, nicknameKey: key, createdAt: now, lastSeenAt: now,
    coffee: 0, coffeeGiven: 0, coffeeReceived: 0, coffeeUsed: {mentor: 0, rest: 0},
    can: {day: null, own: false, others: []}, quizDay: null,
    notesDay: {day: null, count: 0}, inbox: [], save: null, importedLocal: false,
  };
}

/** The faucet: one correct answer fills the watering can for the Korean day. */
export function fillCan(account, now = Date.now()) {
  const day = kstDay(now);
  if (account.can?.day !== day) account.can = {day, own: false, others: []};
  account.quizDay = day;
  return account.can;
}
export function canStatus(account, now = Date.now()) {
  const day = kstDay(now), can = account.can?.day === day ? account.can : null;
  return {day, filled: !!can, own: can ? !can.own : false, others: can ? Math.max(0, LIMITS.otherTreesPerDay - can.others.length) : 0, wateredTrees: can ? [...can.others] : []};
}

export function validTreeName(value) {
  const name = cleanText(value, 40).replace(/\s+/g, ' ');
  const check = checkText(name, {max: LIMITS.treeName});
  if (!check.ok) throw error(check.reason === 'empty' || check.reason === 'long' ? 'invalid_name' : 'blocked_text',
    check.reason === 'empty' ? '이름표를 적어 주세요.' : check.reason === 'long' ? `이름표는 ${LIMITS.treeName}자까지 적을 수 있어요.` : check.message,
    {detail: check.detail});
  return name;
}

export function plantTree({account, tree, name, id, now = Date.now()}) {
  if (tree && !tree.harvestedAt) throw error('already_planted', '이미 키우는 커피나무가 있어요.');
  const label = validTreeName(name);
  return {
    id, ownerId: account.id, owner: account.nickname, name: label, stage: 0,
    plantedAt: now, plantedDay: kstDay(now), lastOwnWaterDay: null, hearts: 0, heartsFrom: [],
    harvests: tree?.harvests || 0, lastActivityAt: now, nameHidden: false, reports: [], harvestedAt: null,
  };
}

/** Own water grows one stage per Korean day; another teacher's water adds a heart. */
export function waterTree({account, tree, now = Date.now()}) {
  if (!tree || tree.harvestedAt) throw error('no_tree', '물을 줄 커피나무가 없어요.');
  const day = kstDay(now), can = account.can?.day === day ? account.can : null;
  if (!can) throw error('empty_can', '물뿌리개가 비어 있어요. 수돗가에서 오늘의 퀴즈를 풀어 물을 받아 오세요.');
  if (tree.ownerId === account.id) {
    if (tree.stage >= FRUIT_STAGE) throw error('ready_to_harvest', '빨간 열매가 열렸어요! 수확해 주세요.');
    if (can.own || tree.lastOwnWaterDay === day) throw error('already_watered', '오늘은 내 나무에 이미 물을 줬어요. 내일 또 만나요.');
    can.own = true; tree.lastOwnWaterDay = day; tree.stage += 1; tree.lastActivityAt = now;
    return {kind: 'own', stage: tree.stage, stageName: STAGES[tree.stage]};
  }
  if (can.others.includes(tree.id)) throw error('already_watered_other', '이 나무에는 오늘 이미 물을 줬어요.');
  if (can.others.length >= LIMITS.otherTreesPerDay) throw error('other_limit', `다른 선생님 나무에는 하루 ${LIMITS.otherTreesPerDay}그루까지 물을 줄 수 있어요.`);
  can.others.push(tree.id);
  tree.hearts = (tree.hearts || 0) + 1; tree.lastActivityAt = now;
  tree.heartsFrom = [...(tree.heartsFrom || []), {from: account.nickname, at: now}].slice(-20);
  return {kind: 'heart', hearts: tree.hearts, left: LIMITS.otherTreesPerDay - can.others.length};
}

export function harvestYield(hearts) {
  return Math.min(LIMITS.maxHarvest, 1 + Math.floor(Math.max(0, Number(hearts) || 0) / LIMITS.heartsPerBonus));
}
export function harvestTree({account, tree, now = Date.now()}) {
  if (!tree || tree.harvestedAt || tree.ownerId !== account.id) throw error('no_tree', '수확할 내 커피나무가 없어요.');
  if (tree.stage < FRUIT_STAGE) throw error('not_ready', `아직 ${STAGES[tree.stage]} 단계예요. ${FRUIT_STAGE - tree.stage}번 더 물을 주면 열매가 열려요.`);
  const amount = harvestYield(tree.hearts);
  account.coffee = (account.coffee || 0) + amount;
  tree.harvestedAt = now; tree.harvests = (tree.harvests || 0) + 1; tree.lastActivityAt = now;
  return {amount, coffee: account.coffee, harvests: tree.harvests};
}

export function giftCoffee({account, tree, recipient, now = Date.now()}) {
  if (!tree || tree.harvestedAt) throw error('no_tree', '선물할 나무를 찾을 수 없어요.');
  if (tree.ownerId === account.id) throw error('own_tree', '내 나무에는 선물할 수 없어요. 다른 선생님 나무를 찾아가 보세요.');
  if ((account.coffee || 0) < 1) throw error('no_coffee', '가방에 믹스커피가 없어요. 커피나무를 수확해 보세요.');
  account.coffee -= 1; account.coffeeGiven = (account.coffeeGiven || 0) + 1;
  tree.lastActivityAt = now; tree.gifts = (tree.gifts || 0) + 1;
  if (recipient) {
    recipient.coffee = (recipient.coffee || 0) + 1; recipient.coffeeReceived = (recipient.coffeeReceived || 0) + 1;
    pushInbox(recipient, {type: 'gift', from: account.nickname, at: now});
  }
  return {coffee: account.coffee};
}
export function useCoffee(account, target) {
  if (!COFFEE_USES.includes(target)) throw error('invalid_target', '믹스커피를 쓸 곳을 찾을 수 없어요.');
  if ((account.coffee || 0) < 1) throw error('no_coffee', '가방에 믹스커피가 없어요.');
  account.coffee -= 1;
  account.coffeeUsed = {mentor: 0, rest: 0, ...(account.coffeeUsed || {})};
  account.coffeeUsed[target] += 1;
  return {coffee: account.coffee, used: account.coffeeUsed[target]};
}
export function pushInbox(account, item) { account.inbox = [...(account.inbox || []), item].slice(-LIMITS.inbox); }

export function writeNote({account, text, color, id, now = Date.now()}) {
  const body = cleanText(text, 400);
  const check = checkText(body, {max: LIMITS.note});
  if (!check.ok) throw error(check.reason === 'empty' || check.reason === 'long' ? 'invalid_note' : 'blocked_text',
    check.reason === 'empty' ? '쪽지 내용을 적어 주세요.' : check.reason === 'long' ? `쪽지는 ${LIMITS.note}자까지 적을 수 있어요.` : check.message,
    {detail: check.detail});
  const paper = PAPER_COLORS.some(c => c.id === color) ? color : PAPER_COLORS[0].id;
  const day = kstDay(now);
  if (account.notesDay?.day !== day) account.notesDay = {day, count: 0};
  if (account.notesDay.count >= LIMITS.notesPerDay) throw error('note_limit', `쪽지는 하루 ${LIMITS.notesPerDay}장까지 걸 수 있어요. 내일 또 걸어 주세요.`);
  account.notesDay.count += 1;
  return {id, authorId: account.id, author: account.nickname, text: body, color: paper, createdAt: now, day,
    reactions: {me_too: [], pat: [], go_home: []}, reports: [], hidden: false};
}
export function notesLeft(account, now = Date.now()) {
  const day = kstDay(now);
  return LIMITS.notesPerDay - (account.notesDay?.day === day ? account.notesDay.count : 0);
}
export function reactNote({account, note, type}) {
  if (!REACTIONS.some(r => r.id === type)) throw error('invalid_reaction', '반응을 찾을 수 없어요.');
  if (!note || note.hidden) throw error('no_note', '쪽지를 찾을 수 없어요.');
  note.reactions = {me_too: [], pat: [], go_home: [], ...(note.reactions || {})};
  const list = note.reactions[type];
  const index = list.indexOf(account.id);
  if (index >= 0) list.splice(index, 1); else list.push(account.id);
  return {type, active: index < 0, count: list.length};
}
/** Three different reporters hide a note or a name tag until the operator reviews it. */
export function reportItem(item, accountId) {
  item.reports = Array.isArray(item.reports) ? item.reports : [];
  if (!item.reports.includes(accountId)) item.reports.push(accountId);
  const hide = item.reports.length >= LIMITS.reportsToHide;
  if ('nameHidden' in item) { if (hide) item.nameHidden = true; } else if (hide) item.hidden = true;
  return {reports: item.reports.length, hidden: hide};
}

export function publicTree(tree, viewerId) {
  if (!tree) return null;
  return {
    id: tree.id, owner: tree.nameHidden ? '이름 숨김' : tree.owner, name: tree.nameHidden ? '이름 숨김' : tree.name,
    stage: tree.stage, stageName: STAGES[tree.stage], hearts: tree.hearts || 0, harvests: tree.harvests || 0,
    gifts: tree.gifts || 0, mine: tree.ownerId === viewerId, plantedDay: tree.plantedDay, lastOwnWaterDay: tree.lastOwnWaterDay,
    lastActivityAt: tree.lastActivityAt, nameHidden: !!tree.nameHidden, reported: !!(viewerId && tree.reports?.includes(viewerId)),
  };
}
export function publicNote(note, viewerId) {
  const reactions = {}, mine = {};
  for (const {id} of REACTIONS) { const list = note.reactions?.[id] || []; reactions[id] = list.length; mine[id] = !!viewerId && list.includes(viewerId); }
  return {id: note.id, author: note.author, text: note.text, color: note.color, createdAt: note.createdAt, day: note.day,
    reactions, mine, own: note.authorId === viewerId, reported: !!(viewerId && note.reports?.includes(viewerId))};
}
/** My tree first, then the most recently active trees, at most 60. */
export function visibleTrees(trees, viewerId, limit = LIMITS.visibleTrees) {
  const active = trees.filter(t => t && !t.harvestedAt);
  const mine = active.find(t => t.ownerId === viewerId);
  const others = active.filter(t => t !== mine).sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
  return [...(mine ? [mine] : []), ...others].slice(0, limit);
}
export function noteDecor(count) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  return {total, hanging: Math.min(total, LIMITS.visibleNotes), lights: total > LIMITS.notesForLights, bigTree: total > LIMITS.notesForBigTree};
}
export function searchTrees(trees, query, viewerId, limit = 20) {
  const q = cleanText(query, 24).toLowerCase().replace(/\s/g, '');
  if (!q) return [];
  return trees.filter(t => t && !t.harvestedAt && !t.nameHidden && (`${t.name}${t.owner}`.toLowerCase().replace(/\s/g, '').includes(q)))
    .slice(0, limit).map(t => publicTree(t, viewerId));
}
