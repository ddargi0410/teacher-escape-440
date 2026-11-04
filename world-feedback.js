import * as THREE from './vendor/three.module.js';

/** Short clickable speech anchored to an actual character, never a dialogue modal. */
export function createWorldFeedback({camera}){
  const layer=document.createElement('div');layer.id='character-feedback';
  const bubble=document.createElement('button');bubble.className='character-bubble';bubble.hidden=true;
  bubble.setAttribute('aria-label','대사 건너뛰기');bubble.setAttribute('aria-live','polite');
  const message=document.createElement('button');message.className='messenger-pop';message.hidden=true;
  const badge=document.createElement('div');badge.className='encounter-badge';badge.hidden=true;
  layer.append(bubble,message,badge);document.body.append(layer);
  let lines=[],index=0,remaining=0,anchor=null,messageTime=0;
  const point=new THREE.Vector3();
  function next(){index++;remaining=2;if(index>=lines.length){bubble.hidden=true;anchor=null;}else bubble.textContent=lines[index];}
  bubble.onclick=next;message.onclick=()=>{messageTime=0;message.hidden=true;};
  function speak(target,text){
    anchor=target;lines=(Array.isArray(text)?text:[text]).flatMap(line=>{
      const chars=Array.from(String(line));const result=[];
      for(let i=0;i<chars.length;i+=25)result.push(chars.slice(i,i+25).join(''));
      return result;
    });index=0;remaining=2;bubble.textContent=lines[0]||'';bubble.hidden=!lines.length;
  }
  function update(dt,visible=true){
    layer.hidden=!visible;if(!visible)return;
    if(anchor){
      remaining-=dt;if(remaining<=0)next();
      if(anchor){
        if(typeof anchor==='function')point.copy(anchor());
        else if(anchor.getWorldPosition){anchor.getWorldPosition(point);point.y+=2.15;}
        else point.copy(anchor);
        point.project(camera);
        bubble.hidden=point.z>1||point.z< -1||Math.abs(point.x)>1.1||Math.abs(point.y)>1.1;
        bubble.style.left=`${(point.x*.5+.5)*innerWidth}px`;
        bubble.style.top=`${(-point.y*.5+.5)*innerHeight}px`;
      }
    }
    if(messageTime>0){messageTime-=dt;if(messageTime<=0)message.hidden=true;}
  }
  return {speak,update,
    notify(text){message.textContent='✉ '+Array.from(text).slice(0,25).join('');message.hidden=false;messageTime=4;},
    status(kind,remaining){badge.hidden=remaining<=0;badge.textContent=kind==='principal'?`👔 ${Math.ceil(remaining)}s · +1분`:'💫';badge.dataset.kind=kind;},
    clear(){anchor=null;lines=[];bubble.hidden=true;message.hidden=true;badge.hidden=true;},
    dispose(){layer.remove();}};
}
