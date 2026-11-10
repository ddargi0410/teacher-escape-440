// Playground panels: check-in code, faucet quiz, coffee trees and the zelkova
// guestbook. Rendered with the game's own panel shell (showPanel/closePanel).
import {QUIZ_BANK} from './quiz-bank.js';
import {STAGES, FRUIT_STAGE, PAPER_COLORS, REACTIONS, LIMITS, kstDay, kstDayNumber, teacherTitle} from './community/core.js';
import {checkText, FILTER_MESSAGE} from './community/filter.js';

const $ = id => document.getElementById(id);
const dateLabel = (now = Date.now()) => { const [, m, d] = kstDay(now).split('-'); return `${Number(m)}월 ${Number(d)}일`; };
const timeLabel = ms => new Date(ms).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul'});

/** Teacher-friendly sentence for any community error. */
export function describeError(error) {
  if (!error) return '잠시 후 다시 해 주세요.';
  if (error.code === 'wrong_code') return `이 닉네임의 출근 코드와 달라요. (남은 기회 ${error.remaining ?? '?'}번) 처음 쓰는 닉네임이라면 다른 닉네임을 골라 주세요.`;
  if (error.code === 'locked') return `출근 코드를 5번 틀려 잠겼어요. ${error.retryAt ? timeLabel(error.retryAt) + ' 이후에' : '10분 뒤에'} 다시 해 주세요.`;
  if (error.code === 'blocked_text') return `${error.message || FILTER_MESSAGE} ${error.detail || ''}`.trim();
  return error.message || '잠시 후 다시 해 주세요.';
}
function shuffled(question, now) {
  const day = kstDayNumber(now);
  return question.options.map((text, index) => ({text, index, key: ((day * 31 + index * 97 + question.id.length * 13) * 2654435761) >>> 0})).sort((a, b) => a.key - b.key);
}
function stageTrack(stage) {
  return `<ol class="yard-stage-track" aria-label="성장 단계">${STAGES.map((name, index) => `<li class="${index < stage ? 'done' : index === stage ? 'now' : ''}"><span>${['🌰', '🌱', '🪴', '🤍', '🍒'][index]}</span><small>${name}</small></li>`).join('')}</ol>`;
}

export function createYardUI({community, showPanel, esc, getState, toast, onTrees, onNotes, onTravel, onSplash, onLogin = () => {}, playSound = () => {}, onAccount = () => {}, onInbox = () => {}}) {
  let account = null, trees = [], notesCache = {order: 'latest', list: [], total: 0, offset: 0, index: 0, done: false}, busy = false;
  const signed = () => community.signedIn && community.matches(getState().name);
  const errorBox = message => { const box = $('yard-error'); if (box) { box.textContent = message; box.hidden = !message; } };
  async function guard(button, task) {
    if (busy) return;
    busy = true; if (button) button.disabled = true; errorBox('');
    try { return await task(); }
    catch (error) { errorBox(describeError(error)); playSound('error'); if (error?.code === 'not_signed_in') openLogin({then: null}); return undefined; }
    finally { busy = false; if (button?.isConnected) button.disabled = false; }
  }
  const remember = summary => { if (summary) { account = summary; onAccount(summary); } };

  async function refresh({me = true} = {}) {
    const tasks = [community.trees().then(result => { trees = result.trees; onTrees(result.trees); return result; }),
      community.notes({limit: 1}).then(result => { onNotes(result.decor, result.palette); return result; })];
    let inbox = [];
    if (me && signed()) tasks.push(community.me().then(result => { remember(result.account); inbox = result.inbox || []; }));
    await Promise.allSettled(tasks);
    if (inbox.length) { announce(inbox); onInbox(inbox); }
    return {account, trees};
  }
  function announce(inbox) {
    const water = inbox.filter(i => i.type === 'water'), gifts = inbox.filter(i => i.type === 'gift'), reactions = inbox.filter(i => i.type === 'reaction');
    const parts = [];
    const givers = [...new Set(water.map(i => i.from))];
    if (water.length) parts.push(`💧 ${givers.slice(0, 2).map(teacherTitle).join(', ')}${givers.length > 2 ? ' 외' : ''} · 물방울 하트 ${water.length}개`);
    if (gifts.length) parts.push(`☕ 믹스커피 선물 ${gifts.length}잔`);
    if (reactions.length) parts.push(`🤗 내 쪽지에 반응 ${reactions.length}개`);
    if (parts.length) toast(`다녀간 선생님들 · ${parts.join(' · ')}`);
  }

  function openLogin({nickname = getState().name, then = null, reason = '', allowLater = true} = {}) {
    const deviceOnly = community.deviceOnly;
    showPanel('yard-login', `${allowLater ? '<button class="close-button" data-close aria-label="닫기">×</button>' : ''}<div class="eyebrow">CHECK-IN CODE · 출근 코드</div><h2 id="panel-title">닉네임과 출근 코드로 출근해요.</h2>${reason ? `<p>${esc(reason)}</p>` : ''}<p>커피나무·쪽지·진행 기록이 이 닉네임에 모여요. ${deviceOnly ? '' : '다른 PC나 휴대폰에서도 같은 닉네임과 출근 코드로 이어 할 수 있어요.'}</p><label for="yard-nickname">닉네임</label><input id="yard-nickname" type="text" maxlength="24" autocomplete="off" value="${esc(nickname === '퇴근희망 교사' ? '' : nickname)}"><label for="yard-code">출근 코드 · 숫자 4자리</label><input id="yard-code" class="code-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••"><p class="yard-error" id="yard-error" role="alert" hidden></p><div class="notice">실제 비밀번호는 쓰지 마세요. 5번 틀리면 10분 동안 잠겨요.${deviceOnly ? '<br><strong>지금은 서버 연결 전이라 이 기기에만 저장돼요.</strong> 서버가 연결되면 같은 닉네임·코드로 출근할 때 기록이 서버로 옮겨져요.' : ''}</div><div class="actions"><button class="primary" id="yard-login">출근 도장 찍기 →</button>${allowLater ? '<button class="secondary" data-close>나중에 할게요</button>' : ''}</div>`);
    const submit = $('yard-login'), code = $('yard-code');
    code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 4); });
    for (const input of [$('yard-nickname'), code]) input.addEventListener('keydown', event => { if (event.key === 'Enter') submit.click(); });
    submit.onclick = () => guard(submit, async () => {
      const name = $('yard-nickname').value.trim();
      if (!/^\d{4}$/.test(code.value)) { errorBox('출근 코드는 숫자 4자리예요.'); return; }
      const result = await community.login({nickname: name, code: code.value});
      remember(result.account);
      await onLogin(result);
      playSound('success');
      await then?.(result, name);
      if (!then) { toast(result.created ? '출근 코드를 만들었어요. 다음에도 같은 닉네임과 코드로 출근해요.' : '출근 완료! 커피나무가 기다리고 있어요.'); document.querySelector('#app-overlay [data-close]')?.click(); }
    });
  }
  function needLogin(next, reason) {
    if (signed()) return false;
    openLogin({reason: reason || '커피나무를 심고 쪽지를 걸려면 출근 코드가 필요해요.', then: async () => { await refresh(); next(); }});
    return true;
  }

  async function openFaucet() {
    if (needLogin(openFaucet, '수돗가 퀴즈를 맞히면 내 물뿌리개에 물이 차요. 먼저 출근 코드로 출근해 주세요.')) return;
    let status;
    try { status = await community.quiz(); } catch (error) { toast(describeError(error)); return; }
    const question = QUIZ_BANK.find(q => q.id === status.questionId);
    const can = account?.can;
    const header = `<button class="close-button" data-close aria-label="닫기">×</button><div class="eyebrow">FAUCET QUIZ · ${dateLabel()} · ${status.index + 1}/${status.total}</div>`;
    if (status.solved) {
      showPanel('faucet', `${header}<h2 id="panel-title">오늘의 물뿌리개, 가득 💧</h2><p>오늘 퀴즈는 이미 맞혔어요. 내 나무에 한 번, 다른 선생님 나무에 하루 ${LIMITS.otherTreesPerDay}그루까지 물을 줄 수 있어요.</p>${can ? `<div class="yard-can"><span>내 나무 <b>${can.own ? '1번 남음' : '오늘 완료'}</b></span><span>다른 선생님 나무 <b>${can.others}그루 남음</b></span></div>` : ''}<p class="yard-quiz-review"><strong>오늘의 문제 · ${esc(question.topic)}</strong><br>${esc(question.prompt)}<br><span>정답: ${esc(question.options[question.answer])} — ${esc(question.explanation)}</span></p><div class="actions"><button class="primary" id="yard-go-farm">생태 밭으로 가기 →</button><button class="secondary" data-close>닫기</button></div>`);
      $('yard-go-farm').onclick = () => { onTravel('farm'); document.querySelector('#app-overlay [data-close]')?.click(); };
      return;
    }
    const options = shuffled(question, Date.now());
    showPanel('faucet', `${header}<h2 id="panel-title">물을 받으려면 한 문제!</h2><p class="yard-topic"><span>${esc(question.topic)}</span> 맞히면 오늘 하루 물뿌리개가 가득 차요. 틀려도 바로 다시 풀 수 있어요.</p><p class="yard-question">${esc(question.prompt)}</p><div class="yard-options" role="group" aria-label="보기">${options.map((option, order) => `<button class="yard-option" data-choice="${option.index}"><b>${'ABCD'[order]}</b><span>${esc(option.text)}</span></button>`).join('')}</div><p class="yard-feedback" id="yard-feedback" role="status" aria-live="polite"></p><p class="yard-error" id="yard-error" role="alert" hidden></p>`);
    for (const button of document.querySelectorAll('[data-choice]')) button.onclick = () => guard(null, async () => {
      const result = await community.answerQuiz(question.id, Number(button.dataset.choice));
      if (!result.correct) {
        playSound('error'); button.disabled = true; button.classList.add('wrong');
        $('yard-feedback').innerHTML = `<b>아쉬워요!</b> ${esc(result.explanation)} 다른 보기를 골라 보세요.`;
        return;
      }
      if (account) account = {...account, can: result.can, quizSolvedToday: true};
      playSound('success'); onSplash();
      button.classList.add('right');
      for (const other of document.querySelectorAll('[data-choice]')) other.disabled = true;
      $('yard-feedback').innerHTML = `<b>정답! 물뿌리개가 가득 찼어요 💧</b> ${esc(result.explanation)}`;
      const actions = document.createElement('div'); actions.className = 'actions';
      const hasTree = trees.some(t => t.mine);
      actions.innerHTML = `<button class="primary" id="yard-go-farm">${hasTree ? '내 커피나무에 물 주러 가기 →' : '생태 밭에 내 나무 심으러 가기 →'}</button><button class="secondary" data-close>닫기</button>`;
      $('yard-feedback').after(actions);
      actions.querySelector('[data-close]').onclick = () => document.querySelector('#app-overlay .close-button')?.click();
      $('yard-go-farm').onclick = () => { onTravel(hasTree ? 'my-tree' : 'farm'); document.querySelector('#app-overlay .close-button')?.click(); };
    });
  }

  function myTreeCard(tree) {
    if (!tree) return `<div class="yard-card empty"><b>아직 심은 커피나무가 없어요.</b><p>밭 입구 첫 자리에 내 나무를 심고 이름표를 붙여요. 하루 한 번 물을 주면 한 단계씩 자라요.</p><div class="actions"><button class="primary" id="yard-plant">내 커피나무 심기 🌱</button></div></div>`;
    const can = account?.can, ready = tree.stage >= FRUIT_STAGE;
    const water = !ready && can?.filled && can.own;
    const todayWatered = tree.lastOwnWaterDay === kstDay();
    return `<div class="yard-card mine"><div class="yard-card-head"><b>${esc(tree.name)}</b><span>${tree.harvests ? '★'.repeat(Math.min(5, tree.harvests)) + ' 수확 ' + tree.harvests + '번' : '첫 수확을 기다려요'}</span></div>${stageTrack(tree.stage)}<p>${ready ? '빨간 열매가 열렸어요! 수확하면 믹스커피가 생겨요.' : todayWatered ? '오늘은 물을 줬어요. 내일 또 와 주세요.' : can?.filled ? '물뿌리개에 물이 있어요. 지금 물을 줄 수 있어요.' : '수돗가에서 오늘의 퀴즈를 맞히면 물을 줄 수 있어요.'} 동료 선생님이 준 물방울 💧 ${tree.hearts}개 → 수확 때 믹스커피 ${Math.min(LIMITS.maxHarvest, 1 + Math.floor(tree.hearts / LIMITS.heartsPerBonus))}개</p><div class="actions">${ready ? '<button class="primary" id="yard-harvest">🍒 수확하기</button>' : water ? '<button class="primary" id="yard-water-mine">💧 물 주기</button>' : !can?.filled && !todayWatered ? '<button class="primary" id="yard-to-faucet">수돗가로 가기</button>' : ''}<button class="secondary" id="yard-to-mine">내 나무 앞으로</button></div></div>`;
  }

  async function openFarm(message = '') {
    if (needLogin(() => openFarm(), '내 커피나무를 심으려면 출근 코드가 필요해요.')) return;
    let me;
    try { me = await community.me(); remember(me.account); if (me.inbox?.length) announce(me.inbox); } catch (error) { toast(describeError(error)); return; }
    const coffee = me.account.coffee || 0;
    showPanel('farm', `<button class="close-button" data-close aria-label="닫기">×</button><div class="eyebrow">ECO GARDEN · 생태 밭 · ${dateLabel()}</div><h2 id="panel-title">우리들의 커피나무</h2>${message ? `<p class="yard-feedback">${esc(message)}</p>` : ''}${myTreeCard(me.tree)}<div class="yard-bag"><span class="yard-cup">☕</span><div><b>가방 속 믹스커피 ${coffee}개</b><small>다른 선생님 나무에 선물 · 5층 학년 연구실 부장님께 드리기 · 보건실 침대에서 마시기</small></div></div><label for="yard-search">이름표로 나무 찾기</label><div class="yard-search"><input id="yard-search" type="text" maxlength="24" placeholder="예: 아메리카노, 닉네임"><button class="secondary" id="yard-search-go">찾기</button></div><ul class="yard-results" id="yard-results"></ul><p class="yard-error" id="yard-error" role="alert" hidden></p><div class="notice">밭에는 한 번에 ${LIMITS.visibleTrees}그루까지 보여요. 내 나무는 항상 입구 첫 자리, 나머지는 최근에 돌본 순서예요.${community.deviceOnly ? '<br><strong>지금은 서버 연결 전이라 이 기기에 저장된 나무만 보여요.</strong>' : ''}</div>`, true);
    bindTreeButtons(me.tree);
    const search = $('yard-search'), go = $('yard-search-go');
    search.addEventListener('keydown', event => { if (event.key === 'Enter') go.click(); });
    go.onclick = () => guard(go, async () => {
      const {results} = await community.searchTrees(search.value);
      $('yard-results').innerHTML = results.length ? results.map(tree => `<li><span><b>${esc(tree.name)}</b><small>${esc(tree.owner)} · ${esc(tree.stageName)} · 💧${tree.hearts}</small></span><button class="secondary" data-visit="${esc(tree.id)}">찾아가기</button></li>`).join('') : '<li class="empty">찾는 이름표가 없어요.</li>';
      for (const button of document.querySelectorAll('[data-visit]')) button.onclick = () => { onTravel('tree', button.dataset.visit, results.find(t => t.id === button.dataset.visit)); document.querySelector('#app-overlay .close-button')?.click(); };
    });
  }
  function bindTreeButtons(tree) {
    const close = () => document.querySelector('#app-overlay .close-button')?.click();
    if ($('yard-plant')) $('yard-plant').onclick = () => openPlant();
    if ($('yard-to-faucet')) $('yard-to-faucet').onclick = () => { onTravel('faucet'); close(); };
    if ($('yard-to-mine')) $('yard-to-mine').onclick = () => { onTravel('my-tree'); close(); };
    if ($('yard-water-mine')) $('yard-water-mine').onclick = () => guard($('yard-water-mine'), async () => {
      const result = await community.water(tree.id);
      playSound('success'); onSplash?.();
      await refresh({me: true});
      openFarm(`💧 물을 줬어요! ${result.stageName}(으)로 자랐어요.${result.stage >= FRUIT_STAGE ? ' 빨간 열매가 열렸어요!' : ' 내일 또 와 주세요.'}`);
    });
    if ($('yard-harvest')) $('yard-harvest').onclick = () => guard($('yard-harvest'), async () => {
      const result = await community.harvest();
      playSound('success');
      await refresh({me: true});
      openFarm(`🍒 수확 완료! 믹스커피 ${result.amount}개를 가방에 넣었어요. 같은 자리에 새 나무를 심을 수 있어요.`);
    });
  }

  function openPlant() {
    if (needLogin(openPlant)) return;
    showPanel('plant', `<button class="close-button" data-close aria-label="닫기">×</button><div class="eyebrow">PLANT · 커피나무 심기</div><h2 id="panel-title">이름표에 뭐라고 적을까요?</h2><p>생태 밭 입구 첫 자리에 심어요. 다른 선생님도 이 이름표를 보고 물을 줄 수 있어요.</p><label for="yard-tree-name">이름표 · ${LIMITS.treeName}자까지</label><input id="yard-tree-name" type="text" maxlength="${LIMITS.treeName}" placeholder="예: 정시퇴근 아메리카노" autocomplete="off"><p class="yard-error" id="yard-error" role="alert" hidden></p><div class="notice">이름·학교·연락처는 적지 마세요. ${FILTER_MESSAGE}</div><div class="actions"><button class="primary" id="yard-plant-go">심기 🌱</button><button class="secondary" data-close>취소</button></div>`);
    const input = $('yard-tree-name'), go = $('yard-plant-go');
    input.addEventListener('keydown', event => { if (event.key === 'Enter') go.click(); });
    go.onclick = () => guard(go, async () => {
      const check = checkText(input.value, {max: LIMITS.treeName});
      if (!check.ok && !['long'].includes(check.reason)) { errorBox(check.reason === 'empty' ? '이름표를 적어 주세요.' : `${check.message} ${check.detail}`); return; }
      await community.plant(input.value);
      playSound('success');
      await refresh({me: true});
      onTravel('my-tree');
      openFarm('🌱 커피나무를 심었어요! 수돗가에서 오늘의 퀴즈를 맞히면 첫 물을 줄 수 있어요.');
    });
  }

  async function openTree(id) {
    const tree = trees.find(t => t.id === id);
    if (!tree) { toast('나무 정보를 불러오는 중이에요. 잠시 후 다시 E를 눌러 주세요.'); void refresh({me: false}); return; }
    if (tree.mine) { openFarm(); return; }
    if (needLogin(() => openTree(id), '다른 선생님 나무에 물을 주려면 출근 코드가 필요해요.')) return;
    try { const me = await community.me(); remember(me.account); } catch {}
    const can = account?.can, coffee = account?.coffee || 0, watered = can?.wateredTrees?.includes(tree.id);
    showPanel('tree', `<button class="close-button" data-close aria-label="닫기">×</button><div class="eyebrow">${esc(teacherTitle(tree.owner))}의 커피나무</div><h2 id="panel-title">${esc(tree.name)}</h2>${stageTrack(tree.stage)}<p>동료가 준 물방울 💧 ${tree.hearts}개 · 수확 ${tree.harvests}번${tree.gifts ? ` · 받은 믹스커피 ☕ ${tree.gifts}잔` : ''}<br>내가 준 물은 이 나무를 자라게 하진 않지만, 수확 때 믹스커피를 늘려 줘요.</p><p class="yard-feedback" id="yard-feedback" role="status" aria-live="polite">${!can?.filled ? '물뿌리개가 비어 있어요. 수돗가에서 오늘의 퀴즈를 맞혀 주세요.' : watered ? '오늘 이 나무에는 이미 물을 줬어요.' : `다른 선생님 나무에 줄 물 ${can.others}그루 남음`}</p><p class="yard-error" id="yard-error" role="alert" hidden></p><div class="actions">${can?.filled && !watered && can.others > 0 ? '<button class="primary" id="yard-water-other">💧 물 주기</button>' : !can?.filled ? '<button class="primary" id="yard-to-faucet">수돗가로 가기</button>' : ''}<button class="secondary" id="yard-gift" ${coffee ? '' : 'disabled'}>☕ 믹스커피 선물 (${coffee}개)</button><button class="secondary yard-report" id="yard-report-tree" ${tree.reported ? 'disabled' : ''}>${tree.reported ? '신고함' : '이름표 신고'}</button></div>`);
    const close = () => document.querySelector('#app-overlay .close-button')?.click();
    if ($('yard-to-faucet')) $('yard-to-faucet').onclick = () => { onTravel('faucet'); close(); };
    if ($('yard-water-other')) $('yard-water-other').onclick = () => guard($('yard-water-other'), async () => {
      const result = await community.water(tree.id);
      playSound('success'); onSplash?.(); remember(account && {...account, can: result.can});
      $('yard-feedback').textContent = `💧 물을 줬어요! 이 나무의 물방울 ${result.hearts}개. 오늘 ${result.left}그루 더 줄 수 있어요.`;
      $('yard-water-other').remove(); void refresh({me: false});
    });
    $('yard-gift').onclick = () => guard($('yard-gift'), async () => {
      const result = await community.gift(tree.id);
      playSound('success'); remember(account && {...account, coffee: result.coffee});
      $('yard-feedback').textContent = `☕ ${teacherTitle(tree.owner)} 나무에 믹스커피를 두고 왔어요. 다음 출근 때 알림이 가요.`;
      $('yard-gift').textContent = `☕ 믹스커피 선물 (${result.coffee}개)`; $('yard-gift').disabled = !result.coffee;
    });
    $('yard-report-tree').onclick = () => guard($('yard-report-tree'), async () => {
      const result = await community.reportTree(tree.id);
      $('yard-report-tree').textContent = '신고함'; $('yard-report-tree').disabled = true;
      $('yard-feedback').textContent = result.hidden ? '신고가 모여 이름표를 숨겼어요. 운영자가 확인할게요.' : '신고했어요. 세 분이 신고하면 이름표가 숨겨지고 운영자가 확인해요.';
    });
  }

  async function loadNotes(order, reset) {
    if (reset) notesCache = {order, list: [], total: 0, offset: 0, index: 0, done: false};
    if (notesCache.done) return;
    const result = await community.notes({order: notesCache.order, offset: notesCache.offset, limit: 20});
    notesCache.list.push(...result.notes); notesCache.total = result.total; notesCache.offset += result.notes.length;
    notesCache.done = result.notes.length < 20 || notesCache.order === 'random';
    onNotes(result.decor, result.palette);
  }
  function noteCard(note) {
    const paper = PAPER_COLORS.find(c => c.id === note.color) || PAPER_COLORS[0];
    const date = new Date(note.createdAt).toLocaleDateString('ko-KR', {month: 'long', day: 'numeric', timeZone: 'Asia/Seoul'});
    return `<article class="yard-note" style="--paper:${paper.hex}"><p>${esc(note.text)}</p><small>${esc(teacherTitle(note.author))} · ${date}</small></article><div class="yard-reactions" role="group" aria-label="반응">${REACTIONS.map(r => `<button class="secondary" data-react="${r.id}" aria-pressed="${note.mine[r.id]}">${r.emoji} ${r.label} <b>${note.reactions[r.id]}</b></button>`).join('')}</div><div class="yard-note-tools">${note.own ? '<button class="secondary" id="yard-note-delete">내 쪽지 지우기</button>' : `<button class="secondary yard-report" id="yard-note-report" ${note.reported ? 'disabled' : ''}>${note.reported ? '신고함' : '신고'}</button>`}</div>`;
  }
  async function openZelkova(tab = 'read', message = '') {
    try { await loadNotes(notesCache.order || 'latest', true); } catch (error) { toast(describeError(error)); return; }
    renderZelkova(tab, message);
  }
  function renderZelkova(tab, message = '') {
    const total = notesCache.total, note = notesCache.list[notesCache.index];
    const left = account?.notesLeft ?? LIMITS.notesPerDay;
    const read = note ? `<div class="yard-note-nav"><button class="secondary" id="yard-prev" ${notesCache.index ? '' : 'disabled'}>← 이전</button><span>${notesCache.index + 1} / ${total}</span><button class="secondary" id="yard-next" ${notesCache.index + 1 < total ? '' : 'disabled'}>다음 →</button></div>${noteCard(note)}` : '<div class="yard-card empty"><b>아직 걸린 쪽지가 없어요.</b><p>첫 쪽지의 주인공이 되어 주세요.</p></div>';
    const write = `<label for="yard-note-text">한 줄 쪽지 · ${LIMITS.note}자까지 <span id="yard-note-count">0/${LIMITS.note}</span></label><textarea id="yard-note-text" maxlength="${LIMITS.note}" rows="3" placeholder="오늘 하루, 동료에게 건네고 싶은 한마디"></textarea><fieldset class="yard-colors"><legend>종이 색</legend>${PAPER_COLORS.map((c, index) => `<label style="--paper:${c.hex}"><input type="radio" name="yard-paper" value="${c.id}" ${index ? '' : 'checked'}><span>${c.label}</span></label>`).join('')}</fieldset><p class="yard-hint">오늘 걸 수 있는 쪽지 <b>${Math.max(0, left)}/${LIMITS.notesPerDay}</b> · 이름·학교·연락처는 적지 않아요.</p><div class="actions"><button class="primary" id="yard-note-send">쪽지 걸기 📝</button></div>`;
    showPanel('zelkova', `<button class="close-button" data-close aria-label="닫기">×</button><div class="eyebrow">ZELKOVA GUESTBOOK · 지금까지 ${total}장</div><h2 id="panel-title">느티나무에 걸린 한 줄</h2>${message ? `<p class="yard-feedback">${esc(message)}</p>` : ''}<div class="yard-tabs" role="tablist"><button role="tab" id="yard-tab-read" aria-selected="${tab === 'read'}">쪽지 읽기</button><button role="tab" id="yard-tab-write" aria-selected="${tab === 'write'}">쪽지 걸기</button>${tab === 'read' ? `<span class="yard-order"><button class="${notesCache.order === 'latest' ? 'on' : ''}" data-order="latest">최신순</button><button class="${notesCache.order === 'random' ? 'on' : ''}" data-order="random">무작위</button></span>` : ''}</div><div class="yard-tab-body">${tab === 'read' ? read : write}</div><p class="yard-feedback" id="yard-feedback" role="status" aria-live="polite"></p><p class="yard-error" id="yard-error" role="alert" hidden></p><div class="notice">쪽지가 100장을 넘으면 꼬마전구가, 500장을 넘으면 나무가 한 단계 커져요. 신고가 세 번 모이면 쪽지가 숨겨지고 운영자가 확인해요.${community.deviceOnly ? '<br><strong>지금은 서버 연결 전이라 이 기기에서 쓴 쪽지만 보여요.</strong>' : ''}</div>`, true);
    $('yard-tab-read').onclick = () => renderZelkova('read');
    $('yard-tab-write').onclick = () => { if (!needLogin(() => renderZelkova('write'), '쪽지를 걸려면 출근 코드가 필요해요.')) renderZelkova('write'); };
    for (const button of document.querySelectorAll('[data-order]')) button.onclick = () => guard(button, async () => { await loadNotes(button.dataset.order, true); renderZelkova('read'); });
    if (tab === 'read' && note) {
      $('yard-prev').onclick = () => { notesCache.index = Math.max(0, notesCache.index - 1); renderZelkova('read'); };
      $('yard-next').onclick = () => guard($('yard-next'), async () => { if (notesCache.index + 1 >= notesCache.list.length) await loadNotes(notesCache.order, false); notesCache.index = Math.min(notesCache.list.length - 1, notesCache.index + 1); renderZelkova('read'); });
      for (const button of document.querySelectorAll('[data-react]')) button.onclick = () => { if (needLogin(() => openZelkova('read'), '반응을 남기려면 출근 코드가 필요해요.')) return; void guard(button, async () => { const result = await community.react(note.id, button.dataset.react); notesCache.list[notesCache.index] = result.note; renderZelkova('read'); }); };
      if ($('yard-note-delete')) $('yard-note-delete').onclick = () => guard($('yard-note-delete'), async () => { await community.deleteNote(note.id); await loadNotes(notesCache.order, true); renderZelkova('read', '쪽지를 지웠어요.'); });
      if ($('yard-note-report')) $('yard-note-report').onclick = () => { if (needLogin(() => openZelkova('read'))) return; void guard($('yard-note-report'), async () => { const result = await community.reportNote(note.id); $('yard-note-report').textContent = '신고함'; $('yard-note-report').disabled = true; $('yard-feedback').textContent = result.hidden ? '신고가 모여 쪽지를 숨겼어요. 운영자가 확인할게요.' : '신고했어요. 세 분이 신고하면 쪽지가 숨겨져요.'; }); };
    }
    if (tab === 'write') {
      const text = $('yard-note-text'), count = $('yard-note-count');
      text.addEventListener('input', () => { count.textContent = `${[...text.value].length}/${LIMITS.note}`; });
      $('yard-note-send').onclick = () => guard($('yard-note-send'), async () => {
        const check = checkText(text.value, {max: LIMITS.note});
        if (!check.ok) { errorBox(check.reason === 'empty' ? '쪽지 내용을 적어 주세요.' : check.reason === 'long' ? `쪽지는 ${LIMITS.note}자까지 적을 수 있어요.` : `${check.message} ${check.detail}`); return; }
        const color = document.querySelector('input[name="yard-paper"]:checked')?.value;
        const result = await community.writeNote(text.value, color);
        if (account) account = {...account, notesLeft: result.notesLeft};
        playSound('success');
        await loadNotes('latest', true);
        renderZelkova('read', `📝 쪽지를 느티나무에 걸었어요! 오늘 ${result.notesLeft}장 더 걸 수 있어요.`);
      });
    }
  }

  return {
    refresh, openLogin, openFaucet, openFarm, openTree, openPlant, openZelkova, describeError,
    get account() { return account; },
    get trees() { return trees; },
    remember,
    async useCoffee(target) { const result = await community.useCoffee(target); remember(account && {...account, coffee: result.coffee}); return result; },
  };
}
