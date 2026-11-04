import {getArcadeData} from './content.js';
import {getMissionBriefing} from './briefings.js';

// Module code may load while the teacher reads. Its timer/scene starts only after
// the explicit start action; stale loads can never start a different mission.
const loaders = {
  1: () => import('./m01.js'), 2: () => import('./m02.js'),
  3: () => import('./m03.js'), 4: () => import('./m04.js'),
  5: () => import('./m05.js'), 6: () => import('./m06.js'),
  7: () => import('./m07.js'), 8: () => import('./m08.js'),
  9: () => import('./m09.js'), 10: () => import('./m10.js')
};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createMinigameRunner({container,onSuccess,onFailure,onClose,onDraft,loaders:moduleLoaders=loaders}) {
  let current=null, controller=null, generation=0, timer=null, awarded=false;
  let module=null, ready=false, started=false, briefingOpen=false, missionData=null;
  let mount=null, briefing=null, beginButton=null, helpButton=null;
  let removeDraftListener=()=>{};
  const stop=()=>{clearTimeout(timer);timer=null;if(current===10&&controller?.getDraft)onDraft?.(controller.getDraft());removeDraftListener();removeDraftListener=()=>{};controller?.destroy?.();controller=null;};
  function close(){
    if(current===null)return;
    generation++;stop();current=null;module=null;ready=false;started=false;briefingOpen=false;missionData=null;
    mount=null;briefing=null;beginButton=null;helpButton=null;
    container.hidden=true;container.replaceChildren();
    document.body.classList.remove('arcade-active');onClose?.();
  }
  function setBriefing(show){
    if(!briefing||current===null)return;
    briefingOpen=show;briefing.hidden=!show;mount.inert=show;
    if(show){controller?.pause?.();beginButton.textContent=started?'이어서 하기':'준비됐어요 · 게임 시작';beginButton.disabled=!ready;beginButton.focus();}
    else if(started&&!document.hidden)controller?.resume?.();
  }
  function showBriefing(){if(current!==null&&!awarded)setBriefing(true);}
  function begin(){
    if(!ready||!module||current===null)return;
    if(started){setBriefing(false);helpButton.focus();return;}
    const token=generation,id=current;
    started=true;briefingOpen=false;briefing.hidden=true;mount.inert=false;helpButton.hidden=false;
    try{
      controller=module.start({container:mount,data:getArcadeData(missionData),
        onFail:payload=>{if(token===generation&&!awarded)onFailure?.(id,payload);},
        onWin:payload=>{
          if(token!==generation||awarded)return;awarded=true;
          helpButton.disabled=true;onSuccess?.(id,payload);
          timer=setTimeout(()=>{if(token===generation)close();},1800);
        }
      });
      if(document.hidden)controller?.pause?.();
      mount.querySelector?.('canvas,textarea,button')?.focus?.();
    }catch(error){
      if(token!==generation)return;
      console.error('Minigame start failed',error);started=false;
      mount.textContent='게임을 시작하지 못했어요. 닫고 다시 시도해 주세요.';
    }
  }
  async function open(data){
    close();const token=++generation;current=data.id;missionData=data;awarded=false;ready=false;started=false;briefingOpen=true;
    const info=getMissionBriefing(data);
    container.hidden=false;document.body.classList.add('arcade-active');
    container.innerHTML=`<header class="arcade-shell-header"><div class="arcade-heading"><span class="arcade-number">미션 ${String(data.id).padStart(2,'0')}</span><h1>${esc(info.title)}</h1><p>${esc(info.goal)}</p></div><button class="arcade-help" hidden>미션 설명</button></header><div class="arcade-mount"></div><button class="arcade-exit" aria-label="미니게임 나가기">×</button><section class="arcade-briefing" role="dialog" aria-modal="true" aria-labelledby="arcade-brief-title"><div class="arcade-brief-card"><div class="arcade-brief-top"><span>미션 ${String(data.id).padStart(2,'0')} · ${esc(data.room||'')}</span><span class="arcade-untimed">안내를 읽는 동안 시간 정지</span></div><h2 id="arcade-brief-title">${esc(info.title)}</h2><div class="arcade-project"><span class="arcade-project-picture" aria-hidden="true">🌿 <b>→</b> 🐛 <b>→</b> 🐦</span><span>${esc(info.project)}</span></div><div class="arcade-brief-goal"><span aria-hidden="true">${esc(info.icon)}</span><div><small>지금 할 일</small><strong>${esc(info.goal)}</strong></div></div><ol class="arcade-brief-steps">${info.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><div class="arcade-brief-bottom"><p><b>완료 조건</b>${esc(info.win)}</p><p><b>배우는 것</b>${esc(info.learn)}</p></div><div class="arcade-brief-actions"><button class="arcade-brief-exit">학교로 나가기</button><button class="arcade-begin" disabled>게임 준비 중…</button></div><p class="arcade-load-status" role="status"></p></div></section>`;
    container.querySelector('.arcade-exit').onclick=close;
    container.querySelector('.arcade-brief-exit').onclick=close;
    mount=container.querySelector('.arcade-mount');mount.inert=true;
    briefing=container.querySelector('.arcade-briefing');
    beginButton=container.querySelector('.arcade-begin');beginButton.onclick=begin;
    helpButton=container.querySelector('.arcade-help');helpButton.onclick=showBriefing;
    const draftListener=event=>{if(token===generation&&current===10&&typeof event.detail?.prompt==='string')onDraft?.(event.detail.prompt);};
    mount.addEventListener?.('boss-draft',draftListener);
    removeDraftListener=()=>mount?.removeEventListener?.('boss-draft',draftListener);
    try{
      const loaded=await moduleLoaders[data.id]();
      if(token!==generation)return;
      module=loaded;ready=true;beginButton.disabled=false;beginButton.textContent='준비됐어요 · 게임 시작';beginButton.focus();
    }catch(error){
      if(token!==generation)return;
      console.error('Minigame load failed',error);
      const message='게임을 준비하지 못했어요. 학교로 나간 뒤 다시 시도해 주세요.';
      container.querySelector('.arcade-load-status').textContent=message;
      beginButton.textContent='불러오기 실패';
    }
  }
  const visibility=()=>{if(document.hidden||briefingOpen)controller?.pause?.();else if(started)controller?.resume?.();};
  const keydown=event=>{
    if(current===null)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();
      if(briefingOpen&&started)setBriefing(false);else close();
      return;
    }
    if(event.key==='Tab'&&briefingOpen){
      const buttons=[...briefing.querySelectorAll('button')].filter(button=>!button.disabled);
      const first=buttons[0],last=buttons.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  };
  document.addEventListener('visibilitychange',visibility);document.addEventListener('keydown',keydown);
  return {open,close,isOpen:()=>current!==null,isPlaying:()=>current!==null&&started&&!briefingOpen&&!document.hidden&&!controller?.isPaused?.(),
    hint:()=>{if(current===10&&started&&!briefingOpen&&controller?.hint)controller.hint();else showBriefing();},
    dispose(){close();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',keydown);}};
}
