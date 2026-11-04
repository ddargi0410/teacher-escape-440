import {getArcadeData} from './content.js';

// One lazy module per game. A failed or cancelled load cannot reopen a later game.
const loaders = {
  1: () => import('./m01.js'),
  2: () => import('./m02.js'),
  3: () => import('./m03.js'),
  4: () => import('./m04.js'),
  5: () => import('./m05.js'),
  6: () => import('./m06.js'),
  7: () => import('./m07.js'),
  8: () => import('./m08.js'),
  9: () => import('./m09.js'),
  10: () => import('./m10.js')
};
export function createMinigameRunner({container,onSuccess,onFailure,onClose,onDraft,loaders:moduleLoaders=loaders}) {
  let current=null, controller=null, generation=0, timer=null, awarded=false;
  let removeDraftListener=()=>{};
  const stop=()=>{clearTimeout(timer);timer=null;if(current===10&&controller?.getDraft)onDraft?.(controller.getDraft());removeDraftListener();removeDraftListener=()=>{};controller?.destroy?.();controller=null;};
  function close(){
    if(current===null)return;
    generation++;stop();current=null;container.hidden=true;container.replaceChildren();
    document.body.classList.remove('arcade-active');onClose?.();
  }
  async function open(data){
    close();const token=++generation;current=data.id;awarded=false;
    container.hidden=false;document.body.classList.add('arcade-active');
    container.innerHTML='<div class="arcade-mount"></div><button class="arcade-exit" aria-label="미니게임 나가기">×</button><span class="arcade-loading" role="status">◌</span>';
    container.querySelector('.arcade-exit').onclick=close;
    const mount=container.querySelector('.arcade-mount');
    const draftListener=event=>{if(token===generation&&current===10&&typeof event.detail?.prompt==='string')onDraft?.(event.detail.prompt);};
    mount.addEventListener?.('boss-draft',draftListener);
    removeDraftListener=()=>mount.removeEventListener?.('boss-draft',draftListener);
    try{
      const module=await moduleLoaders[data.id]();
      if(token!==generation)return;
      container.querySelector('.arcade-loading')?.remove();
      controller=module.start({container:mount,data:getArcadeData(data),
        onFail:payload=>{if(token===generation&&!awarded)onFailure?.(data.id,payload);},
        onWin:payload=>{
          if(token!==generation||awarded)return;awarded=true;
          onSuccess?.(data.id,payload);
          timer=setTimeout(()=>{if(token===generation)close();},1800);
        }
      });
      if(document.hidden)controller?.pause?.();
      container.querySelector('.arcade-exit').focus();
    }catch(error){
      if(token!==generation)return;
      console.error('Minigame load failed',error);
      mount.textContent='게임을 열지 못했어요. 닫고 다시 시도해 주세요.';
    }
  }
  const visibility=()=>document.hidden?controller?.pause?.():controller?.resume?.();
  document.addEventListener('visibilitychange',visibility);
  return {open,close,isOpen:()=>current!==null,hint:()=>controller?.hint?.(),
    dispose(){close();document.removeEventListener('visibilitychange',visibility);}};
}
