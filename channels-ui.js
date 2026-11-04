/** A code-free public channel chooser. Switching and networking belong to channels.js. */
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=(value,max)=>Number.isInteger(value)&&value>=0&&value<=max?value:null;

export function createChannelUI({container,onSelect,onClose,onRefresh,onSolo,onReconnect}) {
  const doc=container.ownerDocument||document;
  let opened=false,disposed=false,returnFocus=null,state={},lastRender='';
  container.classList.add('channels-overlay');
  container.hidden=true;
  const q=selector=>container.querySelector(selector);
  const buttons=()=>[...container.querySelectorAll('button')].filter(button=>!button.disabled);

  function render(first=false) {
    if(!opened||disposed)return;
    const key=JSON.stringify(state);
    if(!first&&key===lastRender)return;
    lastRender=key;
    const focusKey=doc.activeElement?.dataset?.channelFocus;
    const scroll=q('.channel-room')?.scrollTop||0;
    const known=state.directoryKnown!==false;
    const selected=Number(state.selected)||1;
    const nickname=typeof state.nickname==='string'?state.nickname.trim():'';
    const total=known&&Array.isArray(state.channels)&&state.channels.every(c=>count(c.count,30)!==null)
      ?state.channels.reduce((sum,c)=>sum+c.count,0):null;
    const cards=Array.from({length:10},(_,i)=>{
      const id=i+1,entry=(state.channels||[]).find(channel=>Number(channel.id)===id)||{};
      const people=known?count(entry.count,30):null;
      const occupied=known?count(entry.occupiedBeds,5):null;
      const free=known?count(entry.freeBeds,5):null;
      const here=state.connected&&selected===id;
      const full=people!==null&&people>=30;
      const unavailable=!!state.loading||full||here;
      const bedText=free===null?'빈 침대 확인 중':free===0?'침대 5/5 · 둘러보기 가능':`빈 침대 ${free} / 5`;
      return `<button type="button" class="channel-card${here?' is-current':''}${free===0?' beds-full':''}" data-channel="${id}" data-channel-focus="channel-${id}" ${unavailable?'disabled':''} ${here?'aria-current="true"':''} aria-label="채널 ${id}, ${people===null?'인원 확인 중':`${people}명 접속`}, ${bedText}${here?', 현재 채널':full?', 입장 정원 초과':''}"><span class="channel-card-top"><b>채널 ${id}</b><span class="channel-card-state">${here?'현재 채널':full?'가득 참':state.loading&&selected===id?'연결 중…':'이동 ↗'}</span></span><span class="channel-people"><span aria-hidden="true">♧</span> ${people===null?'—':people}<small> / 30명</small></span><span class="channel-beds" aria-hidden="true">${Array.from({length:5},(_,n)=>`<i class="${occupied===null?'unknown':n<occupied?'occupied':'free'}"></i>`).join('')}</span><span class="channel-bed-caption">${bedText}</span></button>`;
    }).join('');
    const status=state.loading?'채널로 이동 중…':state.connected?`채널 ${selected}에서 함께 쉬는 중`:state.offline?'지금은 혼자 쉬는 중':'함께할 선생님들을 찾는 중…';
    container.innerHTML=`<section class="channel-room" role="dialog" aria-modal="true" aria-labelledby="channel-heading"><header class="channel-header"><div><span class="channel-eyebrow">TEACHERS LOUNGE</span><h2 id="channel-heading" tabindex="-1">같이 쉬는 학교</h2><p><strong class="channel-nickname">${nickname?`내 닉네임: ${escapeHTML(nickname)}`:'입력한 닉네임으로 함께해요'}</strong><br>코드 없이 자동 입장 · 채널마다 침대 5개</p></div><button type="button" class="channel-close" data-channel-action="close" data-channel-focus="close" aria-label="채널 선택 닫기">×</button></header><div class="channel-summary"><span class="channel-current" role="status">${status}</span><span>${total===null?'접속 인원 확인 중':`전체 ${total}명`}</span><button type="button" data-channel-action="refresh" data-channel-focus="refresh" ${state.refreshing?'disabled':''}>${state.refreshing?'↻ 확인 중':'↻ 새로고침'}</button></div><div class="channel-error" role="status" ${state.error?'':'hidden'}>${escapeHTML(state.error)}</div><div class="channel-grid">${cards}</div><footer class="channel-footer"><p><span class="channel-free-key" aria-hidden="true"></span> 초록 침대는 빈자리예요.<br><small>빈 침대가 없으면 다른 채널로 옮겨 보세요.</small></p><button type="button" class="channel-solo" data-channel-action="${state.offline?'reconnect':'solo'}" data-channel-focus="mode" ${state.loading?'disabled':''}>${state.offline?'♧ 다시 함께하기':'잠깐 혼자 쉬기'}</button></footer></section>`;
    q('[data-channel-action="close"]').onclick=close;
    q('[data-channel-action="refresh"]').onclick=()=>{if(!state.refreshing)onRefresh?.();};
    if(q('[data-channel-action="solo"]'))q('[data-channel-action="solo"]').onclick=()=>onSolo?.();
    if(q('[data-channel-action="reconnect"]'))q('[data-channel-action="reconnect"]').onclick=()=>onReconnect?.();
    for(const button of container.querySelectorAll('[data-channel]'))button.onclick=()=>{
      if(!button.disabled&&!state.loading)onSelect?.(Number(button.dataset.channel));
    };
    q('.channel-room').scrollTop=scroll;
    if(first)q('#channel-heading')?.focus();
    else if(focusKey){const target=q(`[data-channel-focus="${focusKey}"]`);if(target&&!target.disabled)target.focus();else q('#channel-heading')?.focus();}
  }
  function close() {
    if(!opened)return;
    opened=false;container.hidden=true;container.replaceChildren();lastRender='';
    if(returnFocus?.isConnected)returnFocus.focus?.();
    onClose?.();
  }
  const keydown=event=>{
    if(!opened)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    if(event.key==='Tab'){
      const nodes=buttons(),first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&(doc.activeElement===first||doc.activeElement===q('#channel-heading'))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
    }
    event.stopPropagation();
  };
  container.onkeydown=keydown;
  return {
    open(snapshot={}){if(disposed)return;state=snapshot;if(!opened){returnFocus=doc.activeElement;opened=true;container.hidden=false;render(true);}else render();},
    update(snapshot={}){state=snapshot;render();},
    close,isOpen:()=>opened&&!disposed,
    dispose(){if(disposed)return;close();disposed=true;container.onkeydown=null;container.classList.remove('channels-overlay');}
  };
}
