import {MISSIONS} from './missions-data.js';
import {createReminderScheduler} from './messenger-scheduler.js';
import {createMessengerHistory} from './messenger-history.js';
import {displaySender,COMPUTER_SUCCESS_NOTE} from './messenger-data.js';

/** A local school-messenger prop. No real messages are sent or received. */
export function createSchoolMessenger({getState,onLocate,onSound,onArchiveChange,onHistoryChange,storage,random,now}) {
  const scheduler=createReminderScheduler({random});
  const history=createMessengerHistory({storage,now});
  const box=document.createElement('aside');
  box.className='school-messenger';box.hidden=true;
  box.setAttribute('aria-label','퇴근톡 새 쪽지');
  box.innerHTML=`
    <header class="school-messenger-titlebar">
      <span class="school-messenger-title"><span aria-hidden="true">✉</span> 쪽지 수신함</span>
      <span class="school-messenger-brand">퇴근톡</span>
    </header>
    <div class="school-messenger-content">
      <nav class="school-messenger-toolbar" aria-label="쪽지 도구">
        <button type="button" data-note="archive"><span class="school-messenger-tool-icon" aria-hidden="true">▤</span>받은 쪽지함</button>
        <button type="button" data-note="locate"><span class="school-messenger-tool-icon locate" aria-hidden="true">↗</span>업무 위치</button>
        <span class="school-messenger-mail-count">보관 <b data-field="count">0</b></span>
      </nav>
      <dl class="school-messenger-address">
        <div><dt>보낸 사람</dt><dd><span data-field="sender"></span><small>수신</small></dd></div>
        <div><dt>받는 사람</dt><dd><span data-field="recipient"></span></dd></div>
      </dl>
      <div class="school-messenger-subject"><span>제목 :</span><strong data-field="subject"></strong></div>
      <div class="school-messenger-body">
        <span class="school-messenger-task" data-field="task"></span>
        <p data-field="line-one"></p><p data-field="line-two"></p>
      </div>
      <div class="school-messenger-actions">
        <button type="button" data-note="ack">확인했습니다…</button>
        <button type="button" data-note="go" class="school-messenger-go">업무 위치 보기 <span aria-hidden="true">↗</span></button>
      </div>
      <footer class="school-messenger-status"><span data-field="status"></span><span>직접 확인할 때까지 기다려요</span></footer>
    </div>
    <span class="school-messenger-announcement" role="status" aria-live="polite"></span>`;
  document.body.append(box);

  const archive=document.createElement('section');
  archive.className='messenger-archive overlay';archive.hidden=true;
  archive.setAttribute('role','dialog');archive.setAttribute('aria-modal','true');
  archive.setAttribute('aria-labelledby','messenger-archive-title');
  archive.innerHTML=`<div class="panel wide messenger-archive-panel">
    <header class="messenger-archive-header"><h2 id="messenger-archive-title">✉ 받은 쪽지함</h2>
      <button type="button" data-archive="close">학교로 돌아가기</button></header>
    <p class="messenger-archive-summary"></p>
    <div class="messenger-archive-layout">
      <nav class="messenger-archive-list" aria-label="받은 쪽지 목록"></nav>
      <article class="messenger-history-detail" aria-label="선택한 쪽지">
        <h3 data-history="subject"></h3><p class="messenger-history-meta" data-history="meta"></p>
        <p class="school-messenger-task" data-history="task"></p>
        <div class="messenger-history-lines"><p data-history="one"></p><p data-history="two"></p></div>
        <p class="messenger-history-reply" data-history="reply"></p>
        <div class="messenger-history-actions">
          <button type="button" data-archive="ack">확인했습니다…</button>
          <button type="button" data-archive="go">업무 위치 보기 ↗</button>
        </div>
      </article>
    </div><p class="messenger-archive-empty" hidden>아직 받은 쪽지가 없어요. 학교를 둘러보면 동료들의 쪽지가 도착해요.</p>
  </div>`;
  document.body.append(archive);
  const field=name=>box.querySelector(`[data-field="${name}"]`);
  const detail=name=>archive.querySelector(`[data-history="${name}"]`);
  const archiveButton=name=>archive.querySelector(`[data-archive="${name}"]`);
  const list=archive.querySelector('.messenger-archive-list');
  const announcement=box.querySelector('.school-messenger-announcement');
  const listeners=[];
  let rendered=null,pending=history.pending(),selectedId=null,allowed=false,disposed=false,returnFocus=null;
  if(pending)scheduler.restore(pending);

  function listen(element,type,handler){element.addEventListener(type,handler);listeners.push(()=>element.removeEventListener(type,handler));}
  function hide(){if(box.contains(document.activeElement))document.activeElement.blur?.();box.hidden=true;}
  function notifyHistory(){field('count').textContent=String(history.count());onHistoryChange?.(history.count());}
  function taskLabel(message){
    if(!message.missionId)return '교직원 수다 · 추가 업무 없음';
    const mission=MISSIONS.find(item=>item.id===message.missionId);
    const done=getState().completed.includes(message.missionId);
    return `${String(message.missionId).padStart(2,'0')} · ${mission?.floor||''}층 ${mission?.room||''} · ${done?'완료한 업무':'미완료'}`;
  }
  function sync(message){
    if(!message){rendered=null;hide();return;}
    if(message!==rendered){
      rendered=message;
      if(!pending){pending=history.receive(message);notifyHistory();onSound?.();}
      const state=getState();
      field('sender').textContent=displaySender(message.sender);
      field('recipient').textContent=`${String(state.name||'퇴근희망 교사')} (1명)`;
      field('subject').textContent=message.subject;
      field('line-one').textContent=message.lines?.[0]||'';
      field('line-two').textContent=message.lines?.[1]||'';
      field('status').textContent=message.missionId?'업무 독촉 · 받은 쪽지함에 보관됨':'교직원 수다 · 받은 쪽지함에 보관됨';
      box.dataset.missionId=message.missionId?String(message.missionId):'';
      for(const button of box.querySelectorAll('[data-note="locate"], [data-note="go"]'))button.hidden=!message.missionId;
      announcement.textContent=`${displaySender(message.sender)}의 쪽지. ${message.subject}`;
    }
    field('task').textContent=taskLabel(message);
    if(!allowed||!archive.hidden){hide();return;}
    box.hidden=false;
  }
  function acknowledge(){
    if(!pending)return;
    history.acknowledge(pending.id);pending=null;scheduler.dismiss();rendered=null;
    announcement.textContent='';hide();notifyHistory();
    if(!archive.hidden)renderArchive();
  }
  function locate(){
    const id=pending?.missionId;
    if(!id)return;
    acknowledge();onLocate?.(id);
  }
  function dateLabel(value){
    return new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  }
  function renderDetail(){
    const entry=history.get(selectedId);
    archive.querySelector('.messenger-history-detail').hidden=!entry;
    if(!entry)return;
    detail('subject').textContent=entry.subject;
    detail('meta').textContent=`${displaySender(entry.sender)} · ${dateLabel(entry.receivedAt)} · ${entry.acknowledgedAt===null?'확인 전':'확인함'}`;
    detail('task').textContent=taskLabel(entry);
    detail('one').textContent=entry.lines[0]||'';detail('two').textContent=entry.lines[1]||'';
    detail('reply').textContent=entry.acknowledgedAt===null?'':`내 속마음: ${entry.reply}`;
    detail('reply').hidden=entry.acknowledgedAt===null;
    archiveButton('ack').hidden=entry.id!==pending?.id;
    archiveButton('go').hidden=!entry.missionId;
    for(const row of list.querySelectorAll('[data-history-id]')){
      const active=row.dataset.historyId===selectedId;
      row.classList.toggle('is-selected',active);row.setAttribute('aria-pressed',String(active));
    }
  }
  function renderArchive(){
    const entries=history.list().reverse();
    if(!entries.some(entry=>entry.id===selectedId))selectedId=entries[0]?.id||null;
    list.replaceChildren();
    for(const entry of entries){
      const row=document.createElement('button');row.type='button';row.className='messenger-history-row';
      row.setAttribute('data-history-id',entry.id);row.dataset.historyId=entry.id;
      row.innerHTML='<span class="messenger-history-label"></span><strong class="messenger-history-subject"></strong><small class="messenger-history-time"></small>';
      row.querySelector('.messenger-history-label').textContent=`${entry.kind==='banter'?'☕ 수다':'📋 업무'} · ${entry.acknowledgedAt===null?'확인 전':'확인함'}`;
      row.querySelector('.messenger-history-subject').textContent=entry.subject;
      row.querySelector('.messenger-history-time').textContent=`${displaySender(entry.sender)} · ${dateLabel(entry.receivedAt)}`;
      row.onclick=()=>{selectedId=entry.id;renderDetail();};list.append(row);
    }
    archive.querySelector('.messenger-archive-summary').textContent=`받은 쪽지 ${entries.length}통 · 최근 60통 자동 보관 · 게임 속 가상 쪽지예요`;
    archive.querySelector('.messenger-archive-layout').hidden=!entries.length;
    archive.querySelector('.messenger-archive-empty').hidden=!!entries.length;
    renderDetail();
  }
  function openArchive(){
    if(disposed||!archive.hidden)return;
    returnFocus=document.activeElement;hide();selectedId=pending?.id||null;
    renderArchive();archive.hidden=false;onArchiveChange?.(true);archiveButton('close').focus();
  }
  function closeArchive({restoreFocus=true}={}){
    if(archive.hidden)return;
    archive.hidden=true;onArchiveChange?.(false);
    sync(scheduler.current);
    let focusVisible=!!returnFocus;
    for(let node=returnFocus;node;node=node.parentNode)if(node.hidden)focusVisible=false;
    if(restoreFocus&&focusVisible&&returnFocus?.isConnected!==false)returnFocus?.focus?.();
    returnFocus=null;
  }
  function archiveLocate(){
    if(archive.hidden)return;
    const entry=history.get(selectedId);
    if(!entry?.missionId)return;
    if(entry.id===pending?.id)acknowledge();
    // The game rejects travel while any modal is open. Close before callback.
    closeArchive({restoreFocus:false});onLocate?.(entry.missionId);
  }
  const actions={archive:openArchive,ack:acknowledge,go:locate,locate};
  for(const button of box.querySelectorAll('[data-note]'))listen(button,'click',()=>actions[button.dataset.note]?.());
  listen(archiveButton('close'),'click',()=>closeArchive());
  listen(archiveButton('ack'),'click',acknowledge);
  listen(archiveButton('go'),'click',archiveLocate);
  // Let Escape reach the game dispatcher. Keyup must release held walking keys.
  listen(box,'keydown',event=>{if(event.key!=='Escape')event.stopPropagation();});
  listen(archive,'keydown',event=>{
    if(event.key==='Escape')return;
    event.stopPropagation();
    if(event.key!=='Tab')return;
    const buttons=[...archive.querySelectorAll('button')].filter(button=>{
      if(button.disabled)return false;
      for(let node=button;node&&node!==archive;node=node.parentNode)if(node.hidden)return false;
      return true;
    });
    if(!buttons.length)return;
    const index=buttons.indexOf(document.activeElement);
    if(event.shiftKey&&(index<=0)){event.preventDefault();buttons.at(-1).focus();}
    else if(!event.shiftKey&&(index===buttons.length-1||index<0)){event.preventDefault();buttons[0].focus();}
  });
  notifyHistory();

  return {
    update(dt,canShow){
      if(disposed)return;
      allowed=!!canShow;
      sync(scheduler.tick(dt,{...getState(),enabled:allowed&&archive.hidden}));
    },
    request(){if(!disposed&&allowed&&archive.hidden)sync(scheduler.request(getState()));},
    notifyMissionSuccess(id){
      if(disposed||id!==5||history.list().some(entry=>entry.subject===COMPUTER_SUCCESS_NOTE.subject))return false;
      return scheduler.enqueue('computer-success',COMPUTER_SUCCESS_NOTE);
    },
    /** One-off note from elsewhere in the school (the playground's gifts and water hearts). */
    notify(key,copy){if(disposed)return false;return scheduler.enqueue(key,copy);},
    suspend(){allowed=false;hide();},
    reset({clearHistory=false}={}){
      if(disposed)return;
      allowed=false;closeArchive({restoreFocus:false});scheduler.reset();rendered=null;
      if(clearHistory)history.clear();
      pending=history.pending();if(pending)scheduler.restore(pending);
      announcement.textContent='';hide();notifyHistory();
    },
    dismiss:acknowledge,
    openArchive,closeArchive,
    isArchiveOpen:()=>!disposed&&!archive.hidden,
    historyCount:()=>history.count(),
    isOpen:()=>!disposed&&!box.hidden,
    dispose(){
      if(disposed)return;
      allowed=false;closeArchive({restoreFocus:false});disposed=true;
      scheduler.reset();listeners.forEach(remove=>remove());box.remove();archive.remove();
    }
  };
}
