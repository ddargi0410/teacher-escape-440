import {MISSIONS} from './missions-data.js';
import {createReminderScheduler} from './messenger-scheduler.js';

/** A local, nonmodal school-messenger prop. It never sends a real message. */
export function createSchoolMessenger({getState, onLocate, onSound}) {
  const scheduler = createReminderScheduler();
  const box = document.createElement('aside');
  box.className = 'school-messenger';
  box.hidden = true;
  box.setAttribute('aria-label', '퇴근톡 업무 독촉 쪽지');
  box.innerHTML = `
    <header class="school-messenger-titlebar">
      <span class="school-messenger-title"><span aria-hidden="true">✉</span> 쪽지 수신함</span>
      <span class="school-messenger-brand">퇴근톡</span>
      <button type="button" data-note="minimize" aria-label="쪽지 창 최소화" title="최소화">−</button>
      <button type="button" data-note="close" aria-label="쪽지 닫기" title="닫기">×</button>
    </header>
    <div class="school-messenger-content">
      <nav class="school-messenger-toolbar" aria-label="쪽지 도구">
        <button type="button" data-note="reply"><span class="school-messenger-tool-icon reply" aria-hidden="true">↶</span>회신</button>
        <button type="button" data-note="later"><span class="school-messenger-tool-icon later" aria-hidden="true">◷</span>1분 뒤</button>
        <button type="button" data-note="locate"><span class="school-messenger-tool-icon locate" aria-hidden="true">↗</span>업무 위치</button>
        <button type="button" data-note="delete"><span class="school-messenger-tool-icon delete" aria-hidden="true">⌫</span>삭제</button>
        <span class="school-messenger-mail-count">새 쪽지 <b>1</b></span>
      </nav>
      <dl class="school-messenger-address">
        <div><dt>보낸 사람</dt><dd><span data-field="sender"></span><small>방금</small></dd></div>
        <div><dt>받는 사람</dt><dd><span data-field="recipient"></span></dd></div>
      </dl>
      <div class="school-messenger-subject"><span>제목 :</span><strong data-field="subject"></strong></div>
      <div class="school-messenger-body">
        <span class="school-messenger-task" data-field="task"></span>
        <p data-field="line-one"></p><p data-field="line-two"></p>
        <div class="school-messenger-local-reply" data-field="reply" hidden></div>
      </div>
      <div class="school-messenger-actions">
        <button type="button" data-note="ack">확인했습니다…</button>
        <button type="button" data-note="go" class="school-messenger-go">업무 위치 보기 <span aria-hidden="true">↗</span></button>
      </div>
      <footer class="school-messenger-status"><span data-field="status">읽음 1 · 퇴근 0</span><span>자동 닫힘 <b data-field="seconds">14</b>s</span></footer>
    </div>
    <span class="school-messenger-announcement" role="status" aria-live="polite"></span>`;
  document.body.append(box);
  const field = name => box.querySelector(`[data-field="${name}"]`);
  const minimizer = box.querySelector('[data-note="minimize"]');
  const announcement = box.querySelector('.school-messenger-announcement');
  const listeners = [];
  let rendered = null;
  let visibleAge = 0;
  let replyAge = null;
  let allowed = false;
  let minimized = false;
  let disposed = false;

  function hide() {
    if (box.contains(document.activeElement)) document.activeElement.blur?.();
    box.hidden = true;
  }
  function setMinimized(value) {
    minimized = value;
    box.classList.toggle('is-minimized', value);
    minimizer.textContent = value ? '□' : '−';
    minimizer.setAttribute('aria-label', value ? '쪽지 창 펼치기' : '쪽지 창 최소화');
    minimizer.title = value ? '펼치기' : '최소화';
  }
  function dismiss(seconds) {
    scheduler.dismiss(seconds);
    rendered = null;
    visibleAge = 0;
    replyAge = null;
    announcement.textContent = '';
    hide();
  }
  function acknowledge() {
    if (!rendered || replyAge !== null) return;
    field('reply').textContent = rendered.reply || '확인했습니다. 제 퇴근도 확인 부탁드려요.';
    field('reply').hidden = false;
    field('status').textContent = '내 속마음에만 회신 완료';
    replyAge = 0;
  }
  function locate() {
    const id = rendered?.missionId;
    if (id === undefined) return;
    dismiss();
    onLocate?.(id);
  }
  const actions = {close: () => dismiss(), delete: () => dismiss(), later: () => dismiss(60),
    minimize: () => setMinimized(!minimized), reply: acknowledge, ack: acknowledge,
    locate, go: locate};
  for (const button of box.querySelectorAll('[data-note]')) {
    const click = () => actions[button.dataset.note]?.();
    button.addEventListener('click', click);
    listeners.push(() => button.removeEventListener('click', click));
  }
  // Buttons keep their normal keyboard behavior without triggering world hotkeys.
  // Let Escape reach the game dispatcher, and let keyup release any held walking key.
  const stopHotkeys = event => { if (event.key !== 'Escape') event.stopPropagation(); };
  box.addEventListener('keydown', stopHotkeys);
  listeners.push(() => box.removeEventListener('keydown', stopHotkeys));

  function sync(message) {
    if (!message) {
      rendered = null;
      visibleAge = 0;
      replyAge = null;
      hide();
      return;
    }
    if (!allowed) { hide(); return; }
    if (message !== rendered) {
      rendered = message;
      visibleAge = 0;
      replyAge = null;
      setMinimized(false);
      const state = getState();
      const mission = MISSIONS.find(item => item.id === message.missionId);
      const name = String(state.name || '퇴근희망 교사');
      field('sender').textContent = `${message.sender} (교직원)`;
      field('recipient').textContent = `${name} (1명)`;
      field('subject').textContent = message.subject;
      field('task').textContent = `${String(message.missionId).padStart(2, '0')} · ${mission?.floor || ''}층 ${mission?.room || ''} · 미완료`;
      field('line-one').textContent = message.lines?.[0] || '';
      field('line-two').textContent = message.lines?.[1] || '';
      field('reply').hidden = true;
      field('reply').textContent = '';
      field('status').textContent = `읽음 1 · 남은 업무 ${10 - state.completed.length}`;
      field('seconds').textContent = '14';
      box.dataset.missionId = String(message.missionId);
      announcement.textContent = `${message.sender}의 쪽지. ${message.subject}`;
      onSound?.();
    }
    box.hidden = false;
  }

  return {
    update(dt, canShow) {
      if (disposed) return;
      allowed = !!canShow;
      const message = scheduler.tick(dt, {...getState(), enabled: allowed});
      const wasVisible = !box.hidden && message === rendered;
      sync(message);
      if (box.hidden) return;
      // A paused or hidden game never consumes the note's reading time.
      const step = wasVisible && Number.isFinite(dt) ? Math.max(0, dt) : 0;
      visibleAge += step;
      if (replyAge !== null) replyAge += step;
      field('seconds').textContent = String(Math.max(0, Math.ceil(14 - visibleAge)));
      if (visibleAge >= 14 || replyAge >= 1.4) dismiss();
    },
    request() {
      if (disposed || !allowed) return;
      sync(scheduler.request(getState()));
    },
    suspend() { allowed = false; hide(); },
    reset() {
      scheduler.reset();
      rendered = null;
      visibleAge = 0;
      replyAge = null;
      allowed = false;
      setMinimized(false);
      announcement.textContent = '';
      hide();
    },
    dismiss,
    isOpen: () => !disposed && !box.hidden,
    dispose() {
      if (disposed) return;
      disposed = true;
      scheduler.reset();
      listeners.forEach(remove => remove());
      box.remove();
    }
  };
}
