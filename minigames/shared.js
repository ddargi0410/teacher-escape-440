// Small shared drawing/input shell. Each game owns its own state and timers.
export const COLORS = Object.freeze({cream:'#f5f0df',paper:'#fffdf3',green:'#234c43',mint:'#b9d8bb',lime:'#d8ed92',orange:'#e77952',red:'#c84245',blue:'#709eb6',ink:'#203a35'});
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function rounded(ctx,x,y,w,h,r=14,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
export function text(ctx,value,x,y,size=24,color=COLORS.ink,align='center',weight=700){ctx.fillStyle=color;ctx.font=`${weight} ${size}px system-ui, sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(value),x,y);}
export function fitText(ctx,value,x,y,maxWidth,size=24,color=COLORS.ink,align='center',weight=700){ctx.font=`${weight} ${size}px system-ui, sans-serif`;while(ctx.measureText(String(value)).width>maxWidth&&size>11){size-=1;ctx.font=`${weight} ${size}px system-ui, sans-serif`;}text(ctx,value,x,y,size,color,align,weight);}
// Large labels may wrap instead of becoming tiny. y is the block centre.
export function wrapText(ctx,value,x,y,maxWidth,{size=24,color=COLORS.ink,align='center',weight=700,lineHeight=size*1.35}={}){
  ctx.font=`${weight} ${size}px system-ui, sans-serif`;
  const lines=[];
  for(const paragraph of String(value).split('\n')){
    let line='';
    for(const char of paragraph){
      if(line&&ctx.measureText(line+char).width>maxWidth){lines.push(line.trimEnd());line=char.trimStart();}
      else line+=char;
    }
    lines.push(line.trimEnd());
  }
  lines.forEach((line,i)=>text(ctx,line,x,y+(i-(lines.length-1)/2)*lineHeight,size,color,align,weight));
  return lines;
}
export function hit(point,box){return point.x>=box.x&&point.x<=box.x+box.w&&point.y>=box.y&&point.y<=box.y+box.h;}

export function createCanvasStage(container,{label='미니게임'}={}){
  const root=document.createElement('section');root.className='arcade-stage';root.setAttribute('aria-label',label);
  const canvas=document.createElement('canvas');canvas.className='arcade-canvas';canvas.setAttribute('aria-label',label);canvas.tabIndex=0;
  const buttons=document.createElement('div');buttons.className='arcade-hit-layer';
  const status=document.createElement('div');status.className='arcade-sr';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const feedback=document.createElement('div');feedback.className='arcade-feedback';feedback.setAttribute('aria-hidden','true');
  const tipText=document.createElement('div');tipText.className='arcade-feedback-tip';tipText.setAttribute('aria-hidden','true');
  root.append(canvas,buttons,status,feedback,tipText);container.append(root);
  const ctx=canvas.getContext('2d');const keys=new Set();const removers=[];const buttonMap=new Map();
  let width=1,height=1,raf=0,last=0,disposed=false,paused=false,draw=null,pointer=null,keyHandler=null,feedbackTimer,tipTimer;
  function listen(target,type,fn,options){target.addEventListener(type,fn,options);removers.push(()=>target.removeEventListener(type,fn,options));}
  function resize(){const rect=root.getBoundingClientRect();width=Math.max(320,rect.width);height=Math.max(320,rect.height);const dpr=Math.min(globalThis.devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
  const observer=new ResizeObserver(resize);observer.observe(root);resize();
  const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*width/r.width,y:(e.clientY-r.top)*height/r.height,type:e.type,pointerType:e.pointerType};};
  listen(canvas,'pointerdown',e=>{if(paused||document.hidden)return;canvas.focus({preventScroll:true});canvas.setPointerCapture?.(e.pointerId);pointer?.(point(e));});
  listen(canvas,'pointermove',e=>{if(!paused&&!document.hidden)pointer?.(point(e));});listen(canvas,'pointerup',e=>{if(!paused&&!document.hidden)pointer?.(point(e));});
  listen(window,'keydown',e=>{if(disposed||paused||document.hidden)return;if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;const k=e.key.toLowerCase();keys.add(k);if(['arrowleft','arrowright','arrowup','arrowdown',' ','1','2','3','4','5','6'].includes(k))e.preventDefault();if(!e.repeat)keyHandler?.(k,e);});
  listen(window,'keyup',e=>keys.delete(e.key.toLowerCase()));listen(window,'blur',()=>{keys.clear();last=0;});listen(document,'visibilitychange',()=>{keys.clear();last=0;});
  function tick(now){if(disposed)return;raf=requestAnimationFrame(tick);if(paused||document.hidden){last=0;return;}const clockDt=last?Math.max(0,(now-last)/1000):0,dt=Math.min(.05,clockDt);last=now;ctx.clearRect(0,0,width,height);draw?.(dt,now/1000,clockDt);}
  function setButtons(items){const next=new Set(items.map(b=>b.id));for(const[id,button]of buttonMap)if(!next.has(id)){button.remove();buttonMap.delete(id);}for(const item of items){let button=buttonMap.get(item.id);if(!button){button=document.createElement('button');button.type='button';button.className='arcade-hit';buttons.append(button);buttonMap.set(item.id,button);}button.setAttribute('aria-label',item.label);button.title=item.label;button.disabled=!!item.disabled;button.onclick=()=>{if(!paused&&!document.hidden&&!disposed)item.onClick?.();};Object.assign(button.style,{left:item.x+'px',top:item.y+'px',width:item.w+'px',height:item.h+'px'});}}
  function flash(type,tip=''){clearTimeout(feedbackTimer);clearTimeout(tipTimer);tipText.textContent=tip;tipText.className=`arcade-feedback-tip ${tip?'show':''} ${type}`;tipTimer=setTimeout(()=>tipText.classList.remove('show'),2400);root.classList.remove('arcade-shake');void root.offsetWidth;if(type==='bad'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)root.classList.add('arcade-shake');feedback.textContent=type==='good'?'✓':'!';feedback.className=`arcade-feedback show ${type}`;status.textContent=tip;feedbackTimer=setTimeout(()=>{feedback.classList.remove('show');root.classList.remove('arcade-shake');},550);}
  return{root,canvas,ctx,keys,get width(){return width;},get height(){return height;},onPointer(fn){pointer=fn;},onKey(fn){keyHandler=fn;},announce(value){status.textContent=value;},setButtons,flash,loop(fn){draw=fn;if(!raf)raf=requestAnimationFrame(tick);},pause(){paused=true;keys.clear();last=0;},resume(){paused=false;last=0;},destroy(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);clearTimeout(feedbackTimer);clearTimeout(tipTimer);observer.disconnect();removers.forEach(fn=>fn());keys.clear();root.remove();}};
}
