import {createCanvasStage,COLORS as C,clamp,rounded,text,fitText,wrapText} from './shared.js';

export function start({container,data,onWin=()=>{},onFail=()=>{}}){
  const cfg=data.arcade||{};
  const slots=cfg.slots||data.slots;
  const cards=(cfg.cards||data.cards.map(c=>({...c,label:c.text,good:!!c.slot}))).map(c=>({...c}));
  const duration=Math.min(90,cfg.duration||75),stage=createCanvasStage(container,{label:'믹스커피 카드 캐치'}),ctx=stage.ctx;
  let elapsed=0,slotIndex=0,mugX=.5,falling=[],nextWave=.4,mode='play',finishTime=0,won=false,spill=0,tip='',tipTime=0,failCount=0,correctReveal=0;
  const caught=[];
  function reset(){elapsed=0;slotIndex=0;mugX=.5;falling=[];nextWave=.4;mode='play';finishTime=0;spill=0;tip='';tipTime=0;correctReveal=0;failCount=0;caught.length=0;stage.announce('역할 카드를 받으세요.');}
  function fail(reason,message){spill=.8;tip=message;tipTime=1.5;correctReveal=1.4;failCount++;stage.flash('bad',message);onFail({reason,tip:message});}
  function wave(){
    const wanted=slots[slotIndex].id;const correct=cards.find(c=>c.slot===wanted);
    const others=cards.filter(c=>c.slot!==wanted);const bad=others.filter(c=>!c.slot);
    const a=bad[Math.floor(Math.random()*bad.length)]||others[0];let b=others[Math.floor(Math.random()*others.length)];if(b.id===a.id)b=others.find(c=>c.id!==a.id)||b;
    const choices=[correct,a,b].sort(()=>Math.random()-.5);
    falling=choices.map((card,i)=>({card,x:(i+.5)/3,y:stage.height*.23,rotation:(i-1)*.07}));
    nextWave=7;
  }
  function pick(card){
    if(card.slot!==slots[slotIndex].id){fail('wrong-card','지금 필요한 칸에 맞는 카드만!');return;}
    caught.push(card);slotIndex++;stage.flash('good',`${slots[slotIndex-1].label} 완성`);data.runtime?.playSound?.('click');falling=[];nextWave=.65;
    if(slotIndex===slots.length){mode='success';finishTime=0;stage.announce('프롬프트 다섯 칸 완성!');}
    else stage.announce(`${slots[slotIndex].label} 카드를 받으세요.`);
  }
  stage.onPointer(p=>{if(mode==='play'&&(p.type==='pointerdown'||p.type==='pointermove'))mugX=clamp(p.x/stage.width,.09,.91);});
  stage.onKey(k=>{if(mode==='timeout'&&(k===' '||k==='enter'))reset();});
  function drawMug(x,y,w,h){
    ctx.strokeStyle=C.green;ctx.lineWidth=8;ctx.beginPath();ctx.arc(x+w*.55,y+h*.41,w*.22,-Math.PI/2,Math.PI/2);ctx.stroke();
    rounded(ctx,x-w/2,y,w,h,16,C.paper,C.green);ctx.fillStyle='#8e5c3d';ctx.beginPath();ctx.ellipse(x,y+8,w*.44,8,0,0,Math.PI*2);ctx.fill();
    text(ctx,'☕',x,y+h*.56,28,C.green);text(ctx,`${slotIndex}/5`,x,y+h*.87,14,C.green);
    if(spill>0){for(let i=0;i<9;i++){ctx.fillStyle='#8e5c3d';ctx.beginPath();ctx.arc(x+Math.sin(i*8.3)*w,y-(.8-spill)*100+Math.cos(i)*25,3+(i%3),0,Math.PI*2);ctx.fill();}}
  }
  stage.loop((dt,t,clockDt)=>{
    const W=stage.width,H=stage.height,narrow=W<600,s=Math.min(W/800,H/650),font=clamp(24*s,20,27),mugW=clamp(W*.12,82,125),mugH=65,mugY=H-116;
    if(mode==='play'){
      elapsed+=clockDt;nextWave-=clockDt;spill=Math.max(0,spill-clockDt);tipTime=Math.max(0,tipTime-clockDt);correctReveal=Math.max(0,correctReveal-clockDt);
      const direction=(stage.keys.has('arrowright')||stage.keys.has('d')?1:0)-(stage.keys.has('arrowleft')||stage.keys.has('a')?1:0);mugX=clamp(mugX+direction*clockDt*.75,.09,.91);
      if(nextWave<=0&&falling.length===0)wave();
      const speed=Math.max(60,(H*.77-116)/4.6);
      for(const item of [...falling]){
        const previousY=item.y;item.y+=clockDt*speed;
        const half=clamp(W*.1,44,90);
        if(item.y>=mugY-20&&previousY<mugY+25&&Math.abs(item.x*W-mugX*W)<mugW*.47+half*.65){
          falling=falling.filter(f=>f!==item);pick(item.card);if(mode!=='play'||falling.length===0)break;
        }else if(item.y>H-55)falling=falling.filter(f=>f!==item);
      }
      if(falling.length===0)nextWave=Math.min(nextWave,.8);
      if(elapsed>=duration&&mode==='play'){mode='timeout';falling=[];fail('timeout','다섯 칸을 모아 다시 도전!');stage.announce('시간 종료. 다시 내리기를 누르세요.');}
    }else if(mode==='success'){finishTime+=clockDt;if(finishTime>2.8&&!won){won=true;onWin({collected:caught.map(c=>c.id),seconds:Math.round(elapsed),mistakes:failCount});}}
    ctx.fillStyle=C.cream;ctx.fillRect(0,0,W,H);
    // Coffee-station backsplash and the long vending machine mouth.
    ctx.fillStyle='#e7e1c8';ctx.fillRect(0,H*.19,W,H*.59);
    ctx.strokeStyle='#d9d4bc';ctx.lineWidth=1;for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,H*.19);ctx.lineTo(x,H*.78);ctx.stroke();}for(let y=H*.19;y<H*.78;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    text(ctx,`${Math.max(0,Math.ceil(duration-elapsed))}s`,W-22,38,Math.max(16,font*.9),C.green,'right');
    text(ctx,'↔ 머그컵으로 필요한 카드만 받기',W/2,72,clamp(Math.max(16,font*.8),16,20),C.green);
    const slotW=Math.min((W-28)/5,150),slotStart=(W-slotW*5)/2;
    slots.forEach((slot,i)=>{const x=slotStart+i*slotW;rounded(ctx,x+3,96,slotW-6,34,12,i<slotIndex?C.green:i===slotIndex?C.lime:'#e6e5d9');fitText(ctx,`${i<slotIndex?'✓ ':''}${slot.label}`,x+slotW/2,113,slotW-12,clamp(Math.max(16,font*.76),16,19),i<slotIndex?C.paper:C.green);});
    if(mode==='play'){
      rounded(ctx,20,H*.22-8,W-40,33,9,C.green);rounded(ctx,35,H*.22+2,W-70,12,6,'#122c28');
      text(ctx,`↓ ${slots[slotIndex].label}`,W/2,H*.22+55,font,C.green);
      for(const item of falling){const w=clamp(W*.29,108,220),h=92,x=item.x*W,y=item.y,isAnswer=correctReveal>0&&item.card.slot===slots[slotIndex].id;ctx.save();ctx.translate(x,y);ctx.rotate(item.rotation+Math.sin(t*2+item.x)*.025);ctx.shadowColor='#203a3522';ctx.shadowBlur=8;ctx.shadowOffsetY=6;rounded(ctx,-w/2,-h/2,w,h,11,isAnswer?C.lime:C.paper,isAnswer?C.green:undefined);ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle='#cfb28d';ctx.fillRect(-w/2+10,-h/2+8,w-20,4);wrapText(ctx,item.card.label,0,8,w-18,{size:Math.max(17,font*.9),color:C.green,lineHeight:23});ctx.restore();}
      ctx.fillStyle='#c7ad88';ctx.fillRect(0,H-52,W,52);ctx.fillStyle='#a68965';ctx.fillRect(0,H-55,W,6);drawMug(mugX*W,mugY,mugW,mugH);
      if(tipTime>0)wrapText(ctx,tip,W/2,H-170,W-30,{size:18,color:C.red});
      if(correctReveal>0){const right=cards.find(c=>c.slot===slots[slotIndex].id);if(right){rounded(ctx,W/2-130,H-204,260,32,12,C.lime);fitText(ctx,`✓ ${right.label}`,W/2,H-188,240,Math.max(16,font*.85),C.green);}}
      text(ctx,'◀',28,H-25,24,C.green);text(ctx,'▶',W-28,H-25,24,C.green);
      stage.setButtons([{id:'left',label:'머그컵 왼쪽 이동',x:0,y:H-65,w:70,h:65,onClick:()=>{mugX=clamp(mugX-.23,.09,.91);}},{id:'right',label:'머그컵 오른쪽 이동',x:W-70,y:H-65,w:70,h:65,onClick:()=>{mugX=clamp(mugX+.23,.09,.91);}}]);
    }else if(mode==='success'){
      const ticketW=Math.min(W-48,740),x=(W-ticketW)/2,y=H*.27;
      text(ctx,'✓ 다섯 칸, 한 잔 완성!',W/2,y,font*1.4,C.green);
      const rowH=Math.min(51,(H*.6)/6);caught.forEach((card,i)=>{const slide=Math.max(0,1-finishTime*2+i*.2)*80;rounded(ctx,x+slide,y+45+i*rowH,ticketW,rowH-6,8,i%2?C.paper:'#e3e9d7');fitText(ctx,`${slots[i].label}  ·  ${card.label}`,W/2+slide,y+45+i*rowH+(rowH-6)/2,ticketW-25,font,C.green);});
      stage.setButtons([]);
    }else{
      text(ctx,'☕',W/2,H*.40,80,C.orange);text(ctx,'커피 한 잔 더?',W/2,H*.55,font*1.4,C.green);
      const box={x:W/2-110,y:H*.65,w:220,h:58};rounded(ctx,box.x,box.y,box.w,box.h,18,C.green);text(ctx,'↻ 다시 내리기',W/2,box.y+29,font,C.paper);stage.setButtons([{id:'retry',label:'다시 내리기',...box,onClick:reset}]);
    }
  });
  return{destroy:()=>stage.destroy(),pause:()=>stage.pause(),resume:()=>stage.resume(),hint(){tip='화면 위 초록 칸과 맞는 카드!';tipTime=2;stage.announce(tip);}};
}
