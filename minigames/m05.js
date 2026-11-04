import {createCanvasStage,COLORS as C,clamp,rounded,text,fitText,wrapText,hit} from './shared.js';

/** Slots are semantic, so moving a piece never silently changes its answer. */
export function judgeReportDrop(fragment,slot,placed={}){
  return !!fragment && fragment.slot===slot && !placed[slot];
}

function lines(ctx,value,x,y,width,size,color=C.ink,maxLines=3){
  ctx.font=`700 ${size}px system-ui, sans-serif`;
  const result=[];let line='';
  for(const ch of String(value)){if(line&&ctx.measureText(line+ch).width>width){result.push(line);line=ch;}else line+=ch;}
  if(line)result.push(line);
  const shown=result.slice(0,maxLines),step=size*1.28;
  shown.forEach((s,i)=>text(ctx,s,x,y+(i-(shown.length-1)/2)*step,size,color));
}

export function start({container,data,onWin=()=>{},onFail=()=>{}}){
  const cfg=data.arcade;
  if(!cfg?.bugs?.length||cfg.slots?.length!==4)throw new Error('m05 requires bugs and four report slots.');
  const stage=createCanvasStage(container,{label:cfg.title||'버그 잡기'}),ctx=stage.ctx;
  const duration=Math.min(90,cfg.duration||90),bugs=cfg.bugs,slots=cfg.slots;
  let elapsed=0,completed=0,mode='hunt',cycle=0,monitor=0,previous=-1,placed={},selected=null,drag=null,layout=null;
  let won=false,disposed=false,paused=false,finish=0,tip='',tipTime=0,revealSlot=null,revealTime=0,mistakes=0,burst=0,suppressClick=false;
  const sound=name=>data.runtime?.playSound?.(name);
  function announce(){stage.announce(mode==='hunt'?'모니터에서 나온 벌레를 잡으세요.':`${bugs[completed].label}. 조각을 고른 뒤 맞는 칸에 놓으세요.`);}
  function reset(){elapsed=0;completed=0;mode='hunt';cycle=0;monitor=0;previous=-1;placed={};selected=null;drag=null;won=false;finish=0;tip='';tipTime=0;revealSlot=null;revealTime=0;mistakes=0;burst=0;suppressClick=false;announce();}
  function bugVisible(){return mode==='hunt'&&cycle%3.6<2.7;}
  function catchBug(index){if(mode!=='hunt'||index!==monitor||!bugVisible())return;mode='report';placed={};selected=null;drag=null;cycle=0;sound('click');announce();}
  function fail(reason,message){mistakes++;tip=message;tipTime=2.1;stage.flash('bad',message);sound('error');onFail({reason,tip:message});}
  function select(id){if(mode!=='report'||suppressClick)return;const fragment=bugs[completed].fragments.find(f=>f.id===id);if(!fragment||placed[fragment.slot])return;selected=id;sound('click');stage.announce(`${fragment.label}. 놓을 칸을 선택하세요.`);}
  function drop(slot,id=selected){
    if(mode!=='report'||!id)return;
    const fragment=bugs[completed].fragments.find(f=>f.id===id);
    if(!fragment||placed[fragment.slot])return;
    if(!judgeReportDrop(fragment,slot,placed)){
      revealSlot=fragment.slot;revealTime=2;fail('wrong-report-slot','반짝이는 칸에 증거를 놓아요.');return;
    }
    placed[slot]=fragment;selected=null;drag=null;stage.flash('good',`${slots.find(s=>s.id===slot)?.label||slot} 확인`);sound('click');
    if(slots.every(s=>placed[s.id])){mode='burst';burst=0;tip='';stage.announce('오류 신고서 완성! 버그를 잡았어요.');sound('success');}
  }
  function onKey(k){
    suppressClick=false;
    if(mode==='timeout'&&(k==='enter'||k===' ')){reset();return;}
    if(mode==='hunt'&&/^[1-6]$/.test(k)){catchBug(Number(k)-1);return;}
    if(mode==='report'&&/^[1-4]$/.test(k)){
      const n=Number(k)-1;
      if(selected)drop(slots[n].id);else{const fragment=availableFragments()[n];if(fragment)select(fragment.id);}
    }
  }
  stage.onKey(onKey);
  function availableFragments(){return bugs[completed].fragments.filter(f=>!placed[f.slot]);}
  function coordinates(e){const r=stage.canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*stage.width/r.width,y:(e.clientY-r.top)*stage.height/r.height};}
  function pointerDown(e){
    if(paused||disposed||document.hidden||mode!=='report'||!layout)return;
    suppressClick=false;const p=coordinates(e),card=layout.cards.find(c=>hit(p,c));
    if(card)drag={id:card.fragment.id,start:p,p,moved:false};
  }
  function pointerMove(e){if(!drag||paused||disposed||document.hidden)return;drag.p=coordinates(e);if(Math.hypot(drag.p.x-drag.start.x,drag.p.y-drag.start.y)>8){if(!drag.moved)stage.root.setPointerCapture?.(e.pointerId);drag.moved=true;selected=drag.id;}}
  function pointerUp(e){
    if(!drag||paused||disposed||document.hidden)return;
    const active=drag,p=coordinates(e);drag=null;
    if(active.moved){suppressClick=true;const target=layout?.slots.find(s=>hit(p,s));if(target)drop(target.slot.id,active.id);}
  }
  const pointerCancel=()=>{drag=null;suppressClick=false;};
  stage.root.addEventListener('pointerdown',pointerDown);
  stage.root.addEventListener('pointermove',pointerMove);
  stage.root.addEventListener('pointerup',pointerUp);
  stage.root.addEventListener('pointercancel',pointerCancel);
  window.addEventListener('blur',pointerCancel);
  function monitorBox(i,W,H){const cols=W<560?2:3,rows=6/cols,pad=24,gap=16,top=150,space=Math.max(150,H-top-80),cellW=(W-pad*2)/cols,cellH=space/rows;return{x:pad+(i%cols)*cellW+gap/2,y:top+Math.floor(i/cols)*cellH+6,w:cellW-gap,h:Math.max(42,cellH-30)};}
  function drawBug(x,y,size,t,color=C.orange){
    ctx.strokeStyle=color;ctx.lineWidth=3;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(x-size*.25,y+i*size*.23);ctx.lineTo(x-size*.65,y+i*size*.35+Math.sin(t*15)*2);ctx.moveTo(x+size*.25,y+i*size*.23);ctx.lineTo(x+size*.65,y+i*size*.35-Math.sin(t*15)*2);ctx.stroke();}
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,size*.34,size*.45,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=C.paper;ctx.beginPath();ctx.arc(x-size*.12,y-size*.2,size*.055,0,Math.PI*2);ctx.arc(x+size*.12,y-size*.2,size*.055,0,Math.PI*2);ctx.fill();
  }
  function reportLayout(W,H){
    const outer={x:18,y:124,w:W-36,h:Math.max(168,H-190)},rowH=(outer.h-30)/4,slotW=(W-72)*.49,cardW=(W-72)*.45;
    return {outer,slots:slots.map((slot,i)=>({slot,x:34,y:outer.y+16+i*rowH,w:slotW,h:rowH-9})),cards:bugs[completed].fragments.map((fragment,i)=>({fragment,x:W-cardW-32,y:outer.y+16+((i+2+completed)%4)*rowH,w:cardW,h:rowH-9})).filter(c=>!placed[c.fragment.slot])};
  }
  stage.loop((dt,t,clockDt)=>{
    const W=stage.width,H=stage.height,font=clamp(Math.min(W/800,H/650)*25,20,28),buttons=[];
    if(['hunt','report','burst'].includes(mode)){
      elapsed+=clockDt;tipTime=Math.max(0,tipTime-clockDt);revealTime=Math.max(0,revealTime-clockDt);
      if(mode==='hunt'){
        const priorCycle=Math.floor(cycle/3.6);cycle+=clockDt;
        if(Math.floor(cycle/3.6)!==priorCycle){previous=monitor;monitor=(monitor+1+Math.floor(Math.random()*5))%6;if(previous===monitor)monitor=(monitor+1)%6;}
      }else if(mode==='burst'){
        burst+=clockDt;if(burst>=.8){completed++;if(completed===bugs.length){mode='success';finish=0;stage.announce('벌레 세 마리 모두 해결!');}else{mode='hunt';cycle=0;placed={};monitor=(monitor+2)%6;announce();}}
      }
      if(elapsed>=duration&&mode!=='success'){mode='timeout';drag=null;selected=null;fail('timeout','증거 네 칸으로 다시 잡아봐요.');}
    }else if(mode==='success'){finish+=clockDt;if(finish>.8&&!won){won=true;onWin({caught:completed,seconds:Math.round(elapsed),mistakes});}}
    ctx.fillStyle='#dce6df';ctx.fillRect(0,0,W,H);
    text(ctx,`${Math.max(0,Math.ceil(duration-elapsed))}s`,W-22,36,Math.max(16,font*.9),C.green,'right');
    fitText(ctx,mode==='report'||mode==='burst'?bugs[completed].report||bugs[completed].label:'☝ 모니터의 벌레를 잡아요',W/2,72,W-32,Math.max(16,font*.8),C.green);
    text(ctx,`✓ ${completed}/${bugs.length}`,24,106,font,C.green,'left');fitText(ctx,mode==='report'||mode==='burst'?bugs[completed].errorText||'오류 메시지 없음':'BUG HUNT · 정보 담당 구조대',W-24,106,W*.72,Math.max(16,font*.75),C.green,'right');
    if(mode==='hunt'){
      for(let i=0;i<6;i++){
        const b=monitorBox(i,W,H),active=i===monitor&&bugVisible();
        rounded(ctx,b.x,b.y,b.w,b.h,12,'#3c5650');rounded(ctx,b.x+7,b.y+7,b.w-14,b.h-14,7,active?'#e8efc9':'#122f2c');
        ctx.fillStyle='#6e8379';ctx.fillRect(b.x+b.w*.43,b.y+b.h,b.w*.14,12);rounded(ctx,b.x+b.w*.27,b.y+b.h+10,b.w*.46,7,3,'#6e8379');
        text(ctx,String(i+1).padStart(2,'0'),b.x+14,b.y+18,12,active?C.green:'#82a899','left');
        if(active){drawBug(b.x+b.w/2,b.y+b.h*.54,Math.min(b.w,b.h)*.57,t);buttons.push({id:`bug-${i}`,label:`${i+1}번 모니터 벌레 잡기`,...b,onClick:()=>catchBug(i)});}
        else{for(let line=0;line<3;line++){ctx.fillStyle=line%2?'#386357':'#527d65';ctx.fillRect(b.x+20,b.y+b.h*.33+line*12,(b.w-40)*(.6+line*.12),3);}}
      }
      text(ctx,'숨어도 다시 나와요. 숫자 1–6도 가능!',W/2,H-30,clamp(Math.max(16,font*.75),16,20),C.green);
    }else if(mode==='report'||mode==='burst'){
      layout=reportLayout(W,H);const o=layout.outer;rounded(ctx,o.x,o.y,o.w,o.h,18,'#243f3b');
      for(const b of layout.slots){const filled=placed[b.slot.id],glow=revealTime>0&&revealSlot===b.slot.id;rounded(ctx,b.x,b.y,b.w,b.h,9,filled?C.mint:glow?C.lime:'#eef1e4',glow&&Math.sin(t*16)>0?C.orange:undefined);text(ctx,`${filled?'✓':'○'} ${b.slot.label}`,b.x+10,b.y+18,clamp(Math.max(16,font*.66),16,19),C.green,'left');
        if(filled)lines(ctx,filled.label,b.x+b.w/2,b.y+b.h*.66,b.w-16,clamp(Math.max(16,font*.75),16,20),C.green,2);
        else{ text(ctx,'＋',b.x+b.w/2,b.y+b.h*.65,Math.min(26,b.h*.33),glow?C.orange:'#91a899');if(mode==='report')buttons.push({id:`slot-${b.slot.id}`,label:`${b.slot.label} 칸에 놓기`,x:b.x,y:b.y,w:b.w,h:b.h,onClick:()=>{if(!suppressClick)drop(b.slot.id);}});}
      }
      for(const b of layout.cards){
        if(drag?.moved&&drag.id===b.fragment.id)continue;
        rounded(ctx,b.x,b.y,b.w,b.h,9,selected===b.fragment.id?C.lime:C.paper,selected===b.fragment.id?C.orange:undefined);lines(ctx,b.fragment.label,b.x+b.w/2,b.y+b.h/2,b.w-18,clamp(Math.max(16,font*.83),18,22),C.green,3);
        if(mode==='report')buttons.push({id:`piece-${b.fragment.id}`,label:`조각 선택: ${b.fragment.label}`,x:b.x,y:b.y,w:b.w,h:b.h,onClick:()=>select(b.fragment.id)});
      }
      if(drag?.moved){const fragment=bugs[completed].fragments.find(f=>f.id===drag.id),w=clamp(W*.38,125,270),h=60;rounded(ctx,drag.p.x-w/2,drag.p.y-h/2,w,h,10,C.lime,C.orange);lines(ctx,fragment.label,drag.p.x,drag.p.y,w-16,clamp(Math.max(16,font*.8),17,21),C.green,2);}
      if(mode==='burst')for(let n=0;n<14;n++){const angle=n*Math.PI*2/14;ctx.fillStyle=n%2?C.orange:C.lime;ctx.beginPath();ctx.arc(W/2+Math.cos(angle)*burst*220,H*.5+Math.sin(angle)*burst*160,Math.max(1,7-burst*7),0,Math.PI*2);ctx.fill();}
      if(tipTime>0)fitText(ctx,tip,W/2,H-31,W-30,Math.max(16,font*.8),C.red);
      else text(ctx,'☝ 조각을 끌거나, 조각 → 칸을 눌러요',W/2,H-31,clamp(Math.max(16,font*.73),16,20),C.green);
    }else if(mode==='success'){
      drawBug(W/2,H*.40,70,t,C.mint);text(ctx,'✓ 버그 3마리 해결!',W/2,H*.58,font*1.4,C.green);text(ctx,'“안 돼요” 대신 정확한 증거!',W/2,H*.68,Math.max(16,font*.85),C.green);
    }else{
      drawBug(W/2,H*.38,70,t);text(ctx,'버그는 잡힐 때까지!',W/2,H*.54,font*1.2,C.green);const b={x:W/2-110,y:H*.66,w:220,h:54};rounded(ctx,b.x,b.y,b.w,b.h,16,C.green);text(ctx,'↻ 다시 잡기',W/2,b.y+27,font,C.paper);buttons.push({id:'retry',label:'버그 잡기 다시 도전',...b,onClick:reset});
    }
    stage.setButtons(buttons);
  });
  announce();
  return{pause(){paused=true;drag=null;stage.pause();},resume(){paused=false;stage.resume();},hint(){tip='실제 증상과 기대 결과를 나눠요.';tipTime=2.5;stage.announce(tip);},destroy(){if(disposed)return;disposed=true;drag=null;stage.root.removeEventListener('pointerdown',pointerDown);stage.root.removeEventListener('pointermove',pointerMove);stage.root.removeEventListener('pointerup',pointerUp);stage.root.removeEventListener('pointercancel',pointerCancel);window.removeEventListener('blur',pointerCancel);stage.destroy();}};
}
