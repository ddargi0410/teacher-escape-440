import {createCanvasStage,COLORS as C,clamp,rounded,text,fitText} from './shared.js';

const KINDS=['html','css','js'];
const LABELS=['HTML','CSS','JS'];
const ICONS=['▤','✿','↗'];
const NAMES=['뼈대','옷','움직임'];
const LENGTH=60, BONUS_AT=40;

// A falling item must cross a real compartment, not just the outside of a tray.
export function trayCompartment(dropX,trayX,trayWidth){
  const left=trayX-trayWidth/2,relative=(dropX-left)/trayWidth;
  if(relative<0||relative>=1)return -1;
  const index=Math.floor(relative*3),local=relative*3-index;
  return local>.06&&local<.94?index:-1;
}
export function trayComplete(counts,bonusCount){return KINDS.every(k=>(counts[k]||0)>=2)&&bonusCount>=3;}
export function trayGeometry(width,height){
  const trayWidth=Math.min(550,width*.54),edge=12;
  return {width:trayWidth,compartment:trayWidth/3,y:height-128,min:trayWidth/2+edge,max:width-trayWidth/2-edge};
}

export function start({container,data,onWin=()=>{},onFail=()=>{}}){
  const cfg=data.arcade||{},foods=cfg.foods||[],bonuses=cfg.bonus||[],relaxed=!!data.runtime?.relaxed;
  if(KINDS.some(kind=>!foods.some(f=>f.kind===kind))||bonuses.length<3||bonuses.some(b=>b.options?.length!==3||!Number.isInteger(b.answer)||b.answer<0||b.answer>2))throw new Error('m09 needs HTML/CSS/JS foods and three-choice bonus definitions.');
  const stage=createCanvasStage(container,{label:'3칸 식판'}),ctx=stage.ctx;
  const coreOrder=[];
  for(let cycle=0;cycle<5;cycle++)for(const kind of KINDS){const group=foods.filter(f=>f.kind===kind);coreOrder.push(group[cycle%group.length]);}
  let overtime=false;
  let elapsed=0,tray=.5,item=null,coreIndex=0,bonusIndex=0,next=.35,phase='core',mode='play',tip='',tipTime=0,reveal=-1,revealTime=0,splash=0,winSent=false,mistakes=0,bonusCount=0,points=0;
  let counts={html:0,css:0,js:0};const missedBonus=[],clearedBonus=new Set();
  const say=message=>{tip=message;tipTime=2;stage.announce(message);};
  function reset(){overtime=false;elapsed=0;tray=.5;item=null;coreIndex=0;bonusIndex=0;next=.35;phase='core';mode='play';tip='';tipTime=0;reveal=-1;revealTime=0;splash=0;winSent=false;mistakes=0;bonusCount=0;points=0;counts={html:0,css:0,js:0};missedBonus.length=0;clearedBonus.clear();stage.announce('HTML·CSS·JS를 두 개씩, 보너스 세 개!');}
  function feedback(ok,message){stage.flash(ok?'good':'bad',message);say(message);data.runtime?.playSound?.(ok?'click':'error');}
  function spawn(){
    let food,answer;
    if(phase==='core'){food=overtime?foods.find(f=>counts[f.kind]<2)||coreOrder[coreIndex%coreOrder.length]:coreOrder[coreIndex%coreOrder.length];coreIndex++;answer=KINDS.indexOf(food.kind);}
    else{food=bonusIndex<bonuses.length?bonuses[bonusIndex++]:missedBonus.shift()||bonuses[(bonusIndex++-bonuses.length)%bonuses.length];answer=food.answer;}
    // All three compartments can reach this central drop lane even on a phone.
    const lane=.5+Math.sin((coreIndex+bonusIndex)*1.83)*.035;
    item={food,answer,lane,progress:0,bonus:phase==='bonus'};
    stage.announce(`${item.bonus?'보너스 · ':''}${food.label} · ${item.bonus?food.options.join(' / '):'HTML / CSS / JS'}`);
  }
  function align(index){if(mode!=='play'||!item)return;const g=trayGeometry(stage.width,stage.height);tray=clamp(item.lane*stage.width-(index-1)*g.compartment,g.min,g.max)/stage.width;}
  function resolve(index){
    const current=item;if(!current)return;item=null;next=.33;
    if(index===current.answer){
      points++;if(current.bonus){bonusCount++;clearedBonus.add(current.food.id);}else counts[current.food.kind]++;
      feedback(true,current.bonus?current.food.tip||'뜻까지 알면 공유도 든든해요.':`${LABELS[index]} · ${NAMES[index]} ✓`);
    }else{
      mistakes++;splash=.7;reveal=current.answer;revealTime=1.5;
      const message=current.bonus?current.food.tip||'용어의 뜻에 맞는 칸으로!':`${LABELS[current.answer]} · ${NAMES[current.answer]} 칸에 담아요.`;
      feedback(false,message);if(current.bonus&&!clearedBonus.has(current.food.id))missedBonus.push(current.food);
      onFail({reason:index<0?'missed-food':'wrong-compartment',item:current.food.id,tip:message});
    }
  }
  function finish(){
    item=null;
    if(trayComplete(counts,bonusCount)){mode='won';stage.announce('퇴식 완료! 세 칸과 보너스를 모두 배웠어요.');if(!winSent){winSent=true;onWin({seconds:Math.round(elapsed),relaxed,counts:{...counts},bonus:bonusCount,bonusIds:[...clearedBonus],correct:points,mistakes});}}
    else{mode='retry';feedback(false,'세 칸 두 개씩, 보너스 세 개!');onFail({reason:'timeout',tip:'세 칸 두 개씩, 보너스 세 개!'});}
  }
  stage.onPointer(p=>{if(mode==='play'&&(p.type==='pointerdown'||p.type==='pointermove')){const g=trayGeometry(stage.width,stage.height);tray=clamp(p.x,g.min,g.max)/stage.width;}});
  stage.onKey(k=>{if(mode==='retry'&&(k==='enter'||k===' '))reset();else if(['1','2','3'].includes(k))align(+k-1);});
  function labelLines(value,maxWidth,size){
    const chars=[...String(value)],lines=[];let line='';ctx.font=`700 ${size}px system-ui, sans-serif`;
    for(const char of chars){if(line&&ctx.measureText(line+char).width>maxWidth){lines.push(line);line=char;}else line+=char;}if(line)lines.push(line);return lines;
  }
  function drawTray(W,H,g,t){
    const x=tray*W,top=g.y;
    ctx.fillStyle='#203a3522';ctx.beginPath();ctx.ellipse(x,top+75,g.width*.56,13,0,0,Math.PI*2);ctx.fill();
    rounded(ctx,x-g.width/2-7,top-7,g.width+14,91,16,'#b9c4bb','#7b9584');
    for(let i=0;i<3;i++){
      const left=x-g.width/2+i*g.compartment+4,highlight=revealTime>0&&reveal===i;
      rounded(ctx,left,top,g.compartment-8,76,10,highlight?C.lime:i===0?'#f8e6b7':i===1?'#dfd0ea':'#c5e2da',highlight?C.green:'#8aa294');
      if(phase==='bonus'&&item){
        const size=clamp(g.compartment*.2,11,17),lines=labelLines(item.food.options[i],g.compartment-16,size);
        lines.slice(0,3).forEach((line,j)=>text(ctx,line,left+(g.compartment-8)/2,top+37+(j-(Math.min(lines.length,3)-1)/2)*(size+3),size,C.green));
      }else{fitText(ctx,LABELS[i],left+(g.compartment-8)/2,top+25,g.compartment-15,clamp(g.compartment*.24,13,24),C.green);fitText(ctx,NAMES[i],left+(g.compartment-8)/2,top+53,g.compartment-15,clamp(g.compartment*.18,11,17),C.green);}
      if(splash>0)for(let j=0;j<3;j++){ctx.fillStyle=C.orange;ctx.beginPath();ctx.arc(x+(i-1)*g.compartment+(j-1)*10,top-8-(.7-splash)*50+Math.sin(j*3)*9,3,0,Math.PI*2);ctx.fill();}
    }
  }
  stage.loop((dt,t,clockDt)=>{
    const W=stage.width,H=stage.height,g=trayGeometry(W,H),small=W<600;
    if(mode==='play'){
      const advance=relaxed?clockDt:Math.min(clockDt,LENGTH-elapsed);elapsed+=advance;tipTime=Math.max(0,tipTime-advance);revealTime=Math.max(0,revealTime-advance);splash=Math.max(0,splash-advance);
      if(elapsed>=BONUS_AT&&!overtime&&phase==='core'){phase='bonus';item=null;next=.25;say('보너스! 이제 뜻이 적힌 칸으로!');}
      const direction=(stage.keys.has('arrowright')||stage.keys.has('d')?1:0)-(stage.keys.has('arrowleft')||stage.keys.has('a')?1:0);
      tray=clamp(tray*W+direction*advance*W*.75,g.min,g.max)/W;
      if(item){item.progress+=advance/(item.bonus?2.85:2.45);if(item.progress>=1)resolve(trayCompartment(item.lane*W,tray*W,g.width));}
      else{next-=advance;if(next<=0&&(relaxed||elapsed<LENGTH-.2))spawn();}
      if(elapsed>=LENGTH){
        if(!relaxed||trayComplete(counts,bonusCount))finish();
        else if(!overtime){overtime=true;phase=KINDS.every(k=>counts[k]>=2)?'bonus':'core';item=null;next=.35;say('시간 걱정 없이 마저 받아요.');}
        else if(phase==='core'&&KINDS.every(k=>counts[k]>=2)){phase='bonus';item=null;next=.35;}
      }
    }
    ctx.fillStyle=C.cream;ctx.fillRect(0,0,W,H);
    // Serving hatch, wall tiles and a school-cafeteria floor establish the room.
    ctx.fillStyle='#d7e1d3';ctx.fillRect(0,128,W,Math.max(0,H-210));ctx.strokeStyle='#bdcebb';ctx.lineWidth=1;
    for(let x=0;x<W;x+=72){ctx.beginPath();ctx.moveTo(x,128);ctx.lineTo(x,H-90);ctx.stroke();}
    for(let y=128;y<H-90;y+=65){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.fillStyle='#baa285';ctx.fillRect(0,H-77,W,77);
    text(ctx,'3칸 식판',20,35,small?23:29,C.green,'left');text(ctx,relaxed?'천천히':`${Math.max(0,Math.ceil(LENGTH-elapsed))}s`,W-76,35,relaxed?17:22,C.green,'right');
    text(ctx,'↔ 식판을 움직여 맞는 칸에 받기',W/2,75,small?14:18,C.green);
    const progress=KINDS.map((kind,i)=>`${LABELS[i]} ${Math.min(counts[kind],2)}/2`).join('   ');
    fitText(ctx,`${progress}  ·  ★ ${Math.min(bonusCount,3)}/3`,W/2,108,W-24,small?13:18,C.green);
    rounded(ctx,W*.14,142,W*.72,48,12,C.green);fitText(ctx,phase==='bonus'?'★ 후식 · 용어의 뜻 맞추기':'오늘의 반찬 · 구조 / 모양 / 동작',W/2,166,W*.66,small?15:20,C.paper);
    if(mode==='play'){
      if(item){
        const y=205+item.progress*Math.max(20,g.y-218),x=item.lane*W,w=Math.min(W*.7,340),h=64;
        ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*3)*.025);ctx.fillStyle='#203a3522';ctx.beginPath();ctx.ellipse(0,h*.4,w*.4,9,0,0,Math.PI*2);ctx.fill();
        rounded(ctx,-w/2,-h/2,w,h,20,item.bonus?'#f2d08e':C.paper,item.bonus?'#9b6d2d':'#90aa92');
        fitText(ctx,item.food.label,0,0,w-24,small?21:27,C.green);ctx.restore();
        const options=item.bonus?item.food.options:LABELS;
        stage.setButtons(options.map((option,i)=>({id:`align-${i}`,label:`${i+1}번 칸 맞추기 · ${option}`,x:W*i/3,y:H-42,w:W/3,h:42,onClick:()=>align(i)})));
      }else stage.setButtons([]);
      drawTray(W,H,g,t);
      if(tipTime>0)fitText(ctx,tip,W/2,Math.max(198,g.y-45),W-24,small?14:18,revealTime>0?C.red:C.green);
      for(let i=0;i<3;i++){rounded(ctx,W*i/3+5,H-40,W/3-10,33,10,'#f6f1e1cc');text(ctx,`${i+1}번 칸`,W*(i+.5)/3,H-23,14,C.green);}
    }else{
      const y=Math.max(220,H*.4);text(ctx,mode==='won'?'✓':'↻',W/2,y,70,mode==='won'?C.green:C.orange);text(ctx,mode==='won'?'퇴식 완료!':'반찬 한 번 더?',W/2,y+68,small?28:36,C.green);
      fitText(ctx,mode==='won'?'구조·모양·동작, 이제 구분돼요.':'세 칸 두 개씩 + 보너스 세 개',W/2,y+111,W-32,small?15:19,C.green);
      if(mode==='retry'){const box={x:W/2-105,y:Math.min(H-87,y+150),w:210,h:55};rounded(ctx,box.x,box.y,box.w,box.h,18,C.green);text(ctx,'↻ 다시 받기',W/2,box.y+27,22,C.paper);stage.setButtons([{id:'retry',label:'식판 다시 받기',...box,onClick:reset}]);}else stage.setButtons([]);
    }
  });
  return {pause:()=>stage.pause(),resume:()=>stage.resume(),destroy:()=>stage.destroy(),hint(){say(phase==='core'?'HTML 뼈대 · CSS 옷 · JS 움직임':'용어의 뜻이 적힌 칸에 받아요.');}};
}
