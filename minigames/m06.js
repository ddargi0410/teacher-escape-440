import {createCanvasStage,COLORS as C,clamp,rounded,text,fitText} from './shared.js';

/** A fast swipe may skip the bubble between events, so test the whole segment. */
export function swipeHitsBubble(a,b,box){
  if(!a||!b||!box)return false;
  let low=0,high=1;const dx=b.x-a.x,dy=b.y-a.y;
  for(const [p,q] of [[-dx,a.x-box.x],[dx,box.x+box.w-a.x],[-dy,a.y-box.y],[dy,box.y+box.h-a.y]]){
    if(p===0){if(q<0)return false;continue;}
    const r=q/p;if(p<0)low=Math.max(low,r);else high=Math.min(high,r);if(low>high)return false;
  }
  return true;
}
export function judgeScienceAction(statement,action){return !!statement&&(action==='slice'?statement.wrong===true:action==='keep'&&statement.wrong===false);}

function wrap(ctx,value,width,size){ctx.font=`700 ${size}px system-ui, sans-serif`;const result=[];let line='';for(const ch of String(value)){if(line&&ctx.measureText(line+ch).width>width){result.push(line);line=ch;}else line+=ch;}if(line)result.push(line);return result;}

export function start({container,data,onWin=()=>{},onFail=()=>{}}){
  const cfg=data.arcade;
  if(cfg?.statements?.length!==9||cfg.statements.some(s=>typeof s.wrong!=='boolean'))throw new Error('m06 requires nine science statements.');
  const statements=cfg.statements,stage=createCanvasStage(container,{label:cfg.title||'틀린 문장 썰기'}),ctx=stage.ctx,duration=Math.min(90,cfg.duration||90);
  const flight=6.2;
  let elapsed=0,queue=[],current=-1,age=0,mode='play',feedback=0,finish=0,won=false,mistakes=0,cleared=new Set(),tip='',tipTime=0,cracked=0,trail=[],pointer=null,bubble=null,slicePieces=false,correctLast=false,disposed=false,paused=false;
  const sound=name=>data.runtime?.playSound?.(name);
  function next(){
    if(!queue.length){mode='success';finish=0;stage.announce('아홉 문장 검증 완료!');sound('success');return;}
    current=queue.shift();age=0;mode='play';pointer=null;bubble=null;slicePieces=false;stage.announce(`${cleared.size+1}번째 검증. ${statements[current].text}`);
  }
  function reset(){elapsed=0;queue=statements.map((_,i)=>i);current=-1;age=0;feedback=0;finish=0;won=false;mistakes=0;cleared=new Set();tip='';tipTime=0;cracked=0;trail=[];pointer=null;bubble=null;slicePieces=false;next();}
  function decide(action){
    if(mode!=='play'||current<0)return;
    correctLast=judgeScienceAction(statements[current],action);mode='feedback';feedback=0;slicePieces=action==='slice';pointer=null;
    if(correctLast){cleared.add(current);stage.flash('good',action==='slice'?'틀린 문장을 잘랐어요.':'맞는 문장을 담았어요.');sound('click');tip='';}
    else{queue.push(current);mistakes++;cracked=action==='slice'?1.8:0;tip=statements[current].tip||'틀린 문장만 잘라 주세요.';tipTime=2;stage.flash('bad',tip);sound('error');onFail({reason:action==='slice'?'cut-correct-statement':'kept-wrong-statement',sourceIndex:statements[current].sourceIndex,tip});}
  }
  stage.onPointer(p=>{
    if(mode!=='play')return;
    if(p.type==='pointerdown'){pointer={x:p.x,y:p.y};trail=[{...pointer,life:.3}];}
    else if(p.type==='pointermove'&&pointer){const nextPoint={x:p.x,y:p.y};trail.push({...nextPoint,life:.3});if(Math.hypot(p.x-pointer.x,p.y-pointer.y)>6&&swipeHitsBubble(pointer,nextPoint,bubble))decide('slice');pointer=mode==='play'?nextPoint:null;}
    else if(p.type==='pointerup'){
      if(pointer&&Math.hypot(p.x-pointer.x,p.y-pointer.y)>6&&swipeHitsBubble(pointer,p,bubble))decide('slice');pointer=null;
    }
  });
  stage.onKey(k=>{if(mode==='timeout'&&(k==='enter'||k===' '))reset();else if(mode==='play'){if(k==='x'||k==='1')decide('slice');if(k==='o'||k==='2'||k==='arrowdown')decide('keep');}});
  const cancelStroke=()=>{pointer=null;trail=[];};
  stage.canvas.addEventListener('pointercancel',cancelStroke);
  window.addEventListener('blur',cancelStroke);
  function beaker(x,y,w,h,amount,t){
    ctx.save();ctx.translate(x,y);ctx.fillStyle='#ffffff88';ctx.beginPath();ctx.moveTo(-w*.27,-h*.8);ctx.lineTo(-w*.27,-h*.55);ctx.lineTo(-w*.48,h*.13);ctx.quadraticCurveTo(-w*.56,h*.28,-w*.3,h*.28);ctx.lineTo(w*.3,h*.28);ctx.quadraticCurveTo(w*.56,h*.28,w*.48,h*.13);ctx.lineTo(w*.27,-h*.55);ctx.lineTo(w*.27,-h*.8);ctx.closePath();ctx.fill();ctx.strokeStyle='#6e9f9a';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle=cracked?'#eaa896':amount;ctx.beginPath();ctx.moveTo(-w*.37,-h*.05);ctx.quadraticCurveTo(0,-h*.12+Math.sin(t*3)*3,w*.37,-h*.05);ctx.lineTo(w*.42,h*.16);ctx.lineTo(-w*.42,h*.16);ctx.closePath();ctx.fill();
    ctx.strokeStyle=cracked?C.red:'#b4d2c5';ctx.lineWidth=cracked?3:2;if(cracked){ctx.beginPath();ctx.moveTo(-w*.1,-h*.72);ctx.lineTo(w*.12,-h*.45);ctx.lineTo(-w*.15,-h*.2);ctx.lineTo(w*.13,h*.15);ctx.stroke();}
    rounded(ctx,-w*.34,-h*.85,w*.68,h*.09,3,'#a7c8bc');ctx.restore();
  }
  function bubbleBox(W,H){
    const width=Math.min(W-48,640),progress=clamp(age/flight,0,1),yStart=H-175,yPeak=Math.max(180,H*.38);
    // Rise, hover long enough to read, then descend toward the worksheet basket.
    const y=progress<.17?yStart+(yPeak-yStart)*(progress/.17):progress<.73?yPeak+Math.sin(age*2)*7:yPeak+(yStart-yPeak)*((progress-.73)/.27);
    const font=clamp(W*.027,18,25),wrapped=wrap(ctx,statements[current].text,width-42,font),height=Math.max(94,wrapped.length*font*1.28+32);
    return{x:W/2-width/2,y:y-height/2,w:width,h:height,font,wrapped};
  }
  function drawSentence(box,t){
    const wrongReveal=mode==='feedback'&&!correctLast,fill=wrongReveal?'#f5d1c1':'#fafdedae',border=wrongReveal?C.red:'#78ada6';
    const pieces=slicePieces&&mode==='feedback'?[-1,1]:[0];
    for(const half of pieces){ctx.save();const shift=half?half*feedback*100:0;ctx.translate(shift,half?feedback*38:0);if(half){ctx.beginPath();ctx.rect(half<0?box.x-200:box.x+box.w/2,box.y-80,half<0?box.w/2+200:box.w/2+200,box.h+180);ctx.clip();}
      ctx.shadowColor='#3c87742b';ctx.shadowBlur=18;rounded(ctx,box.x,box.y,box.w,box.h,Math.min(45,box.h*.35),fill,border);ctx.shadowBlur=0;
      box.wrapped.forEach((line,i)=>text(ctx,line,box.x+box.w/2,box.y+box.h/2+(i-(box.wrapped.length-1)/2)*box.font*1.28,box.font,C.green));
      ctx.strokeStyle='#ffffffaa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(box.x+26,box.y+22,9,Math.PI,Math.PI*1.6);ctx.stroke();ctx.restore();}
  }
  stage.loop((dt,t,clockDt)=>{
    const W=stage.width,H=stage.height,font=clamp(Math.min(W/800,H/650)*23,16,25),buttons=[];
    trail=trail.map(p=>({...p,life:p.life-clockDt})).filter(p=>p.life>0);cracked=Math.max(0,cracked-clockDt);tipTime=Math.max(0,tipTime-clockDt);
    if(mode==='play'||mode==='feedback'){
      elapsed+=clockDt;
      if(mode==='play'){age+=clockDt;if(age>=flight)decide('keep');}
      else{feedback+=clockDt;if(feedback>=(correctLast?.7:2.0))next();}
      if(elapsed>=duration&&mode!=='success'){mode='timeout';pointer=null;mistakes++;stage.flash('bad','틀린 문장만 잘라 다시 도전!');sound('error');onFail({reason:'timeout',tip:'틀린 문장만 잘라 다시 도전!'});}
    }else if(mode==='success'){finish+=clockDt;if(finish>1&&!won){won=true;onWin({verified:cleared.size,seconds:Math.round(elapsed),mistakes});}}
    ctx.fillStyle='#e5eee6';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#dae6dc';for(let x=0;x<W;x+=80){ctx.fillRect(x,124,1,H-215);}for(let y=124;y<H-90;y+=65)ctx.fillRect(0,y,W,1);
    text(ctx,cfg.title||'틀린 문장 썰기',22,36,clamp(font*1.15,20,28),C.green,'left');text(ctx,`${Math.max(0,Math.ceil(duration-elapsed))}s`,W-90,36,font*.9,C.green,'right');
    fitText(ctx,'╱ 틀린 문장만 긋고, 맞는 문장은 두세요',W/2,72,W-30,font*.8,C.green);text(ctx,`✓ ${cleared.size}/9`,24,106,font,C.green,'left');
    const meterW=Math.min(180,W*.42);rounded(ctx,W-24-meterW,100,meterW,8,4,'#c3d5c7');rounded(ctx,W-24-meterW,100,meterW*cleared.size/9,8,4,C.green);
    const bench=H-135;ctx.fillStyle='#aa9474';ctx.fillRect(0,bench+24,W,H-bench-24);ctx.fillStyle='#c7b493';ctx.fillRect(0,bench+19,W,8);
    beaker(W*.16,bench,clamp(W*.12,44,90),95,C.mint,t);beaker(W*.84,bench,clamp(W*.10,40,70),76,'#f1d68d',t+1);
    const basket={x:W*.29,y:bench-21,w:W*.42,h:51};rounded(ctx,basket.x,basket.y,basket.w,basket.h,9,'#fffdf2',C.green);text(ctx,'✓ 학습지',W/2,bench+3,clamp(font*.8,13,20),C.green);
    for(let n=0;n<cleared.size;n++){ctx.strokeStyle='#9ab697';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(basket.x+12+n*3,basket.y-6-n*2);ctx.lineTo(basket.x+basket.w-10-n*2,basket.y-6-n*2);ctx.stroke();}
    if(mode==='play'||mode==='feedback'){
      bubble=bubbleBox(W,H);drawSentence(bubble,t);
      if(mode==='play'){
        const barW=Math.min(W*.45,270);rounded(ctx,W/2-barW/2,130,barW,5,3,'#c2d5c6');rounded(ctx,W/2-barW/2,130,barW*clamp(1-age/flight,0,1),5,3,C.blue);
        const bw=Math.min((W-48)/2,210),y=H-67;
        const cut={x:W/2-bw-8,y,w:bw,h:48},keep={x:W/2+8,y,w:bw,h:48};
        rounded(ctx,cut.x,cut.y,cut.w,cut.h,14,C.paper,C.orange);rounded(ctx,keep.x,keep.y,keep.w,keep.h,14,C.paper,C.green);
        text(ctx,'╱ 자르기 [X]',cut.x+bw/2,y+24,font*.8,C.red);text(ctx,'↓ 담기 [O]',keep.x+bw/2,y+24,font*.8,C.green);
        buttons.push({id:'slice',label:'틀린 문장 자르기',...cut,onClick:()=>decide('slice')},{id:'keep',label:'맞는 문장 학습지로 보내기',...keep,onClick:()=>decide('keep')});
      }else if(tipTime>0)fitText(ctx,tip,W/2,H-43,W-30,font*.8,C.red);
      if(mode==='feedback'&&!correctLast)text(ctx,statements[current].wrong?'╱ 잘라야 해요':'✓ 담아야 해요',W/2,150,font*.8,C.red);
    }else if(mode==='success'){
      text(ctx,'✓ 아홉 문장 검증 완료!',W/2,H*.4,font*1.3,C.green);text(ctx,'말투보다 과학적 근거!',W/2,H*.51,font,C.green);
    }else{
      text(ctx,'비커는 다시 채우면 돼요',W/2,H*.36,font*1.1,C.green);const b={x:W/2-110,y:H*.47,w:220,h:54};rounded(ctx,b.x,b.y,b.w,b.h,16,C.green);text(ctx,'↻ 다시 검증하기',W/2,b.y+27,font*.9,C.paper);buttons.push({id:'retry',label:'과학 문장 다시 검증하기',...b,onClick:reset});
    }
    if(trail.length>1){ctx.strokeStyle='#ed965b';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(trail[0].x,trail[0].y);for(const p of trail.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();}
    stage.setButtons(buttons);
  });
  reset();
  return{pause(){paused=true;pointer=null;trail=[];stage.pause();},resume(){paused=false;stage.resume();},hint(){tip='에너지 방향과 “모두”를 살펴요.';tipTime=2.5;stage.announce(tip);},destroy(){if(disposed)return;disposed=true;pointer=null;trail=[];stage.canvas.removeEventListener('pointercancel',cancelStroke);window.removeEventListener('blur',cancelStroke);stage.destroy();}};
}
