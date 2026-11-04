import {createCanvasStage,COLORS as C,clamp,rounded,text,fitText} from './shared.js';

const KINDS=['html','css','js'];
const LABELS=['HTML','CSS','JS'];
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
  return {width:trayWidth,compartment:trayWidth/3,y:height-178,height:104,min:trayWidth/2+edge,max:width-trayWidth/2-edge};
}

// The term is read on the large serving board; only this small food token falls.
// Its entire silhouette fits inside a compartment, including on a 320px screen.
export function fallingFoodGeometry(width,height,progress,lane=.5){
  const g=trayGeometry(width,height),w=Math.min(128,g.compartment-22),h=Math.min(54,w*1.1);
  const start=Math.min(224,g.y-70),end=g.y+h/2+6;
  return {x:lane*width,y:start+clamp(progress,0,1)*(end-start),width:w,height:h};
}
export function dropLane(width,sequence){
  const g=trayGeometry(width,700);
  const available=Math.max(0,Math.min(.035,(g.max-g.compartment-width/2)/width));
  return .5+Math.sin(sequence*1.83)*available;
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
    const lane=dropLane(stage.width,coreIndex+bonusIndex);
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
    ctx.fillStyle='#203a3522';ctx.beginPath();ctx.ellipse(x,top+104,g.width*.56,13,0,0,Math.PI*2);ctx.fill();
    rounded(ctx,x-g.width/2-7,top-7,g.width+14,118,16,'#b9c4bb','#7b9584');
    for(let i=0;i<3;i++){
      const left=x-g.width/2+i*g.compartment+4,highlight=revealTime>0&&reveal===i;
      rounded(ctx,left,top,g.compartment-8,104,10,highlight?C.lime:i===0?'#f8e6b7':i===1?'#dfd0ea':'#c5e2da',highlight?C.green:'#8aa294');
      if(phase==='bonus'&&item){
        const size=g.compartment<100?16:20,lines=labelLines(item.food.options[i],g.compartment-16,size);
        lines.forEach((line,j)=>text(ctx,line,left+(g.compartment-8)/2,top+52+(j-(lines.length-1)/2)*(size+3),size,C.green));
      }else{text(ctx,LABELS[i],left+(g.compartment-8)/2,top+36,g.compartment<100?17:24,C.green);text(ctx,NAMES[i],left+(g.compartment-8)/2,top+69,g.compartment<100?16:20,C.green);}
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
    ctx.fillStyle='#d7e1d3';ctx.fillRect(0,204,W,Math.max(0,H-286));ctx.strokeStyle='#bdcebb';ctx.lineWidth=1;
    for(let x=0;x<W;x+=72){ctx.beginPath();ctx.moveTo(x,204);ctx.lineTo(x,H-90);ctx.stroke();}
    for(let y=204;y<H-90;y+=65){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.fillStyle='#baa285';ctx.fillRect(0,H-77,W,77);
    text(ctx,'3칸 식판',20,35,small?26:32,C.green,'left');text(ctx,relaxed?'천천히':`${Math.max(0,Math.ceil(LENGTH-elapsed))}s`,W-76,35,relaxed?18:24,C.green,'right');
    text(ctx,'← → 이동 · 아래 버튼으로 칸 맞추기',W/2,71,small?17:21,C.green);
    const progress=KINDS.map((kind,i)=>`${LABELS[i]} ${Math.min(counts[kind],2)}/2`).join('   ');
    fitText(ctx,`${progress}  ·  ★ ${Math.min(bonusCount,3)}/3`,W/2,102,W-24,small?16:20,C.green);
    rounded(ctx,16,122,W-32,80,15,C.green);
    text(ctx,phase==='bonus'?'보너스 · 용어의 뜻에 맞춰 담으세요':'지금 받을 반찬 · 뼈대 / 모양 / 동작?',W/2,143,small?16:19,C.paper);
    text(ctx,item?.food.label||'다음 반찬 준비 중',W/2,177,small?27:32,C.paper);
    if(mode==='play'){
      if(item){
        const foodBox=fallingFoodGeometry(W,H,item.progress,item.lane),{x,y,width:w,height:h}=foodBox;
        ctx.save();ctx.translate(x,y);ctx.fillStyle='#203a3522';ctx.beginPath();ctx.ellipse(0,h*.4,w*.4,7,0,0,Math.PI*2);ctx.fill();
        rounded(ctx,-w/2,-h/2,w,h,Math.min(16,w/3),item.bonus?'#f2d08e':C.paper,item.bonus?'#9b6d2d':'#90aa92');
        text(ctx,item.food.icon||'★',0,0,Math.min(30,w-12),C.green);ctx.restore();
        const options=item.bonus?item.food.options:LABELS;
        stage.setButtons(options.map((option,i)=>({id:`align-${i}`,label:`${i+1}번 칸 맞추기 · ${option}`,x:W*i/3,y:H-70,w:W/3,h:70,onClick:()=>align(i)})));
      }else stage.setButtons([]);
      drawTray(W,H,g,t);
      if(tipTime>0){
        const lines=labelLines(tip,W-44,small?17:20),tipY=Math.max(224,g.y-50);
        rounded(ctx,12,tipY-17,W-24,lines.length*22+14,10,C.paper);
        lines.forEach((line,j)=>text(ctx,line,W/2,tipY+j*22,small?17:20,revealTime>0?C.red:C.green));
      }
      for(let i=0;i<3;i++){
        const option=phase==='bonus'&&item?item.food.options[i]:`${LABELS[i]} · ${NAMES[i]}`;
        rounded(ctx,W*i/3+4,H-68,W/3-8,64,10,C.paper,C.green);
        const lines=labelLines(`${i+1} ${option}`,W/3-22,small?17:20);
        lines.forEach((line,j)=>text(ctx,line,W*(i+.5)/3,H-36+(j-(lines.length-1)/2)*21,small?17:20,C.green));
      }
    }else{
      const y=Math.max(220,H*.4);text(ctx,mode==='won'?'✓':'↻',W/2,y,70,mode==='won'?C.green:C.orange);text(ctx,mode==='won'?'퇴식 완료!':'반찬 한 번 더?',W/2,y+68,small?28:36,C.green);
      fitText(ctx,mode==='won'?'구조·모양·동작, 이제 구분돼요.':'세 칸 두 개씩 + 보너스 세 개',W/2,y+111,W-32,small?18:22,C.green);
      if(mode==='retry'){const box={x:W/2-105,y:Math.min(H-87,y+150),w:210,h:55};rounded(ctx,box.x,box.y,box.w,box.h,18,C.green);text(ctx,'↻ 다시 받기',W/2,box.y+27,22,C.paper);stage.setButtons([{id:'retry',label:'식판 다시 받기',...box,onClick:reset}]);}else stage.setButtons([]);
    }
  });
  return {pause:()=>stage.pause(),resume:()=>stage.resume(),destroy:()=>stage.destroy(),hint(){say(phase==='core'?'HTML 뼈대 · CSS 옷 · JS 움직임':'용어의 뜻이 적힌 칸에 받아요.');}};
}
