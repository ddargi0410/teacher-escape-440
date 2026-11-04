import {createCanvasStage,COLORS as C,rounded,text,fitText,clamp,hit} from './shared.js';

const FIXES=['font','color','button'];
/** Only one change can be in flight; an overlap cancels both changes. */
export function createBroadcastModel(duration=80){
  let phase='source',elapsed=0,pending=null,processing=0,saveLeft=10,mistakes=0;const fixed=new Set();
  const fail=reason=>{mistakes++;return{type:'fail',reason};};
  return{get phase(){return phase;},get elapsed(){return elapsed;},get fixed(){return new Set(fixed);},get pending(){return pending;},get processing(){return processing;},get saveLeft(){return saveLeft;},get mistakes(){return mistakes;},
    connect(){if(phase!=='source')return false;phase='edit';return true;},
    apply(fix){if(phase!=='edit')return null;if(pending){pending=null;processing=0;return fail('overlap');}if(!FIXES.includes(fix))return fail('vague');if(fixed.has(fix))return null;pending=fix;processing=.95;return{type:'applying',fix};},
    save(){if(phase!=='save'||saveLeft<=0)return null;phase='success';return{type:'win'};},
    tick(dt){if(['success','timeout'].includes(phase))return null;elapsed+=dt;if(elapsed>=duration){phase='timeout';pending=null;return fail('timeout');}
      if(phase==='edit'&&pending){processing-=dt;if(processing<=0){const fix=pending;fixed.add(fix);pending=null;if(fixed.size===3){phase='save';saveLeft=10;}return{type:'fixed',fix};}}
      else if(phase==='save'){saveLeft-=dt;if(saveLeft<=0){phase='timeout';return fail('unsaved');}}return null;}
  };
}
export function start({container,data,onWin=()=>{},onFail=()=>{}}){
  const cfg=data.arcade||{},chips=cfg.chips;
  if(!Array.isArray(chips)||!FIXES.every(f=>chips.some(c=>c.fix===f)))throw new Error('m08 requires three correction chips.');
  const stage=createCanvasStage(container,{label:'ON AIR 10초 전'}),ctx=stage.ctx,duration=Math.min(90,cfg.duration||80);
  let model=createBroadcastModel(duration),selected=null,drag=null,suppressClick=false,staticLeft=0,tip='',tipLeft=0,won=false,finish=0,layout=null,destroyed=false;
  const sound=name=>data.runtime?.playSound?.(name);
  function reset(){model=createBroadcastModel(duration);selected=null;drag=null;staticLeft=0;tip='';tipLeft=0;finish=0;stage.announce('코드 수정 전에 현장의 입력 소스를 확인하세요.');}
  function report(event){if(!event)return;
    if(event.type==='fail'){staticLeft=1.0;tip=event.reason==='overlap'?(cfg.busyTip||'한 번에 하나만 고쳐요!'):event.reason==='vague'?'느낌 대신 바꿀 부분을 콕!':event.reason==='unsaved'?'잘 된 버전은 꼭 저장해요!':'작게 고치고, 저장까지!';tipLeft=2;stage.flash('bad',tip);sound('error');onFail({reason:event.reason,tip});}
    else if(event.type==='fixed'){stage.flash('good','한 부분 수정 완료');sound('click');stage.announce(model.phase==='save'?'10초 안에 저장하고 실제 송출 확인!':'다음 부분만 고쳐 주세요.');}
    else if(event.type==='win'){stage.flash('good','저장 · 송출 확인 완료');sound('success');}
  }
  function apply(index){if(!Number.isInteger(index)||!chips[index])return;report(model.apply(chips[index].fix));selected=null;}
  function select(index){if(suppressClick){suppressClick=false;return;}if(model.phase!=='edit'||model.fixed.has(chips[index].fix))return;selected=index;stage.announce(`${chips[index].label} 선택. AI 입력칸을 누르세요.`);}
  function connect(){if(model.connect()){sound('click');stage.announce('입력 소스 연결. 이제 웹 화면 세 부분을 하나씩 고쳐요.');}}
  function save(){report(model.save());}
  function point(event){const r=stage.root.getBoundingClientRect();return{x:(event.clientX-r.left)*stage.width/r.width,y:(event.clientY-r.top)*stage.height/r.height};}
  function down(event){suppressClick=false;if(document.hidden||paused||model.phase!=='edit'||!layout)return;const p=point(event),index=layout.chips.findIndex(box=>hit(p,box));if(index<0||model.fixed.has(chips[index].fix))return;drag={index,start:p,point:p,moved:false};}
  function move(event){if(!drag||paused)return;const p=point(event);drag.point=p;if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>8){drag.moved=true;stage.root.setPointerCapture?.(event.pointerId);}}
  function up(event){if(!drag||paused)return;const p=point(event),was=drag;drag=null;if(was.moved){suppressClick=true;if(layout&&hit(p,layout.input))apply(was.index);else selected=was.index;}}
  let paused=false;
  stage.root.addEventListener('pointerdown',down);stage.root.addEventListener('pointermove',move);stage.root.addEventListener('pointerup',up);
  const cancel=()=>{drag=null;suppressClick=false;};stage.root.addEventListener('pointercancel',cancel);
  stage.onKey(key=>{suppressClick=false;if(model.phase==='source'&&(key==='enter'||key===' '))connect();else if(model.phase==='edit'&&/^[1-4]$/.test(key))select(Number(key)-1);else if(model.phase==='edit'&&(key==='enter'||key===' ')&&selected!==null)apply(selected);else if(model.phase==='save'&&(key==='enter'||key===' '))save();else if(model.phase==='timeout'&&(key==='enter'||key===' '))reset();});
  stage.loop((dt,t,clockDt)=>{
    const W=stage.width,H=stage.height,font=clamp(Math.min(W/800,H/650)*24,16,26),narrow=W<560,buttons=[];
    report(model.tick(clockDt));staticLeft=Math.max(0,staticLeft-clockDt);tipLeft=Math.max(0,tipLeft-clockDt);
    if(model.phase==='success'){finish+=clockDt;if(finish>.9&&!won){won=true;onWin({fixed:[...model.fixed],saved:true,equipmentChecked:true,mistakes:model.mistakes,seconds:Math.round(model.elapsed)});}}
    ctx.fillStyle='#e7e9df';ctx.fillRect(0,0,W,H);text(ctx,'ON AIR 10초 전',22,36,font,C.green,'left');text(ctx,`${Math.max(0,Math.ceil(duration-model.elapsed))}s`,W-85,36,font*.8,C.green,'right');
    fitText(ctx,model.phase==='source'?'🔌 행사 당일! 먼저 입력 소스 확인':'☝ 수정 칩을 하나씩 AI 입력칸으로',W/2,71,W-30,font*.75,C.green);
    const monitor={x:W*.08,y:H*.17,w:W*.84,h:H*.36};rounded(ctx,monitor.x-8,monitor.y-8,monitor.w+16,monitor.h+27,18,'#3b514b');
    const fixed=model.fixed;
    if(model.phase==='source'){
      rounded(ctx,monitor.x,monitor.y,monitor.w,monitor.h,10,'#1a2828');text(ctx,'NO SIGNAL',W/2,monitor.y+monitor.h*.40,font*1.25,'#cad7c8');fitText(ctx,'노트북 정상 · 송출 화면만 먹통',W/2,monitor.y+monitor.h*.62,monitor.w-20,font*.75,'#a7b5a8');
    }else if(model.phase==='timeout'){
      rounded(ctx,monitor.x,monitor.y,monitor.w,monitor.h,10,'#c9ccb7');
      ctx.fillStyle='#e4bc96';ctx.beginPath();ctx.arc(W/2,monitor.y+monitor.h*.32,Math.min(32,monitor.h*.19),0,Math.PI*2);ctx.fill();rounded(ctx,W/2-45,monitor.y+monitor.h*.53,90,monitor.h*.37,12,'#344b53');text(ctx,'👔',W/2,monitor.y+monitor.h*.68,33,C.paper);
      const line=cfg.failureLine||'지금부터 간단히 한 말씀…';rounded(ctx,W*.12,monitor.y+5,W*.76,32,15,C.paper);fitText(ctx,line,W/2,monitor.y+21,W*.72,font*.7,C.green);
      text(ctx,'훈화 채널 자동 송출 중',W/2,monitor.y+monitor.h-9,font*.65,C.red);
    }else{
      rounded(ctx,monitor.x,monitor.y,monitor.w,monitor.h,10,fixed.has('color')?'#edf3e1':'#ff1cda');
      const previewFont=fixed.has('font')?clamp(font*1.1,21,29):11;
      text(ctx,'생태 퀴즈',W/2,monitor.y+monitor.h*.25,previewFont,C.green);
      fitText(ctx,'생산자 · 소비자 · 분해자',W/2,monitor.y+monitor.h*.46,monitor.w-20,previewFont,C.green);
      if(fixed.has('button')){rounded(ctx,W/2-monitor.w*.21,monitor.y+monitor.h*.63,monitor.w*.42,42,12,C.green);text(ctx,'▶ 소리 · 테스트',W/2,monitor.y+monitor.h*.63+21,font*.75,C.paper);}
      else{ctx.setLineDash?.([5,5]);ctx.strokeStyle='#733653';ctx.strokeRect?.(W/2-monitor.w*.21,monitor.y+monitor.h*.68,monitor.w*.42,32);ctx.setLineDash?.([]);text(ctx,'버튼 없음',W/2,monitor.y+monitor.h*.68+16,12,'#733653');}
    }
    const light=model.phase==='success'?'#62c989':model.phase==='save'?C.red:'#a8b5a7';rounded(ctx,W/2-50,monitor.y-23,100,21,7,light);text(ctx,model.phase==='success'?'ON AIR':'PREVIEW',W/2,monitor.y-12,11,model.phase==='save'?C.paper:C.green);
    FIXES.forEach((fix,i)=>{const labels={font:'글씨',color:'색',button:'버튼'};text(ctx,`${fixed.has(fix)?'✓':'○'} ${labels[fix]}`,W*(.25+i*.25),H*.58,font*.73,fixed.has(fix)?C.green:'#7d8b81');});
    const chipCols=narrow?2:4,gap=10,cw=(W-40-gap*(chipCols-1))/chipCols,ch=clamp(H*.08,43,59),cy=H*.64;
    layout={chips:chips.map((chip,i)=>({x:20+(i%chipCols)*(cw+gap),y:cy+Math.floor(i/chipCols)*(ch+8),w:cw,h:ch})),input:{x:W*.12,y:narrow?H*.85:H*.80,w:W*.76,h:Math.min(66,H*.105)}};
    if(model.phase==='edit'){
      chips.forEach((chip,i)=>{const box=layout.chips[i],done=fixed.has(chip.fix);rounded(ctx,box.x,box.y,box.w,box.h,13,done?'#a8c6ac':selected===i?C.lime:C.paper,selected===i?C.green:undefined);fitText(ctx,`${done?'✓ ':''}${chip.label}`,box.x+box.w/2,box.y+box.h/2,box.w-12,font*.73,done?'#526f5b':C.green);buttons.push({id:`chip-${i}`,label:`수정 칩 ${i+1}: ${chip.label}`,...box,disabled:done,onClick:()=>select(i)});});
      const b=layout.input;rounded(ctx,b.x,b.y,b.w,b.h,16,model.pending?'#cedbb8':C.green,drag?C.orange:undefined);fitText(ctx,model.pending?'◌ 적용 중… 하나씩!':selected!==null?`↳ ${chips[selected].label} 적용`:'AI 입력칸 · 여기에 놓기',W/2,b.y+b.h/2,b.w-18,font*.82,model.pending?C.green:C.paper);buttons.push({id:'apply',label:'선택한 수정 칩을 AI 입력칸에 넣기',...b,onClick:()=>{if(selected!==null)apply(selected);}});
    }else if(model.phase==='source'){
      const b={x:W*.18,y:H*.71,w:W*.64,h:65};rounded(ctx,b.x,b.y,b.w,b.h,16,C.green);fitText(ctx,cfg.equipmentLabel||'🔌 입력 소스 · HDMI 확인',W/2,b.y+32,b.w-20,font*.82,C.paper);buttons.push({id:'source',label:'현장 입력 소스 확인',...b,onClick:connect});fitText(ctx,'연결은 현장에서, 화면은 코드로!',W/2,H*.87,W-30,font*.72,C.green);
    }else if(model.phase==='save'){
      text(ctx,`${Math.max(0,Math.ceil(model.saveLeft))}`,W/2,H*.68,font*2.4,C.red);
      const b={x:W*.18,y:H*.79,w:W*.64,h:65};rounded(ctx,b.x,b.y,b.w,b.h,16,C.green);fitText(ctx,'💾 저장 · 실제 송출 확인',W/2,b.y+32,b.w-20,font*.84,C.paper);buttons.push({id:'save',label:'저장하고 실제 송출 확인',...b,onClick:save});
    }else if(model.phase==='timeout'){
      text(ctx,'어제 됐는데 오늘 왜 이래!',W/2,H*.68,font,C.green);const b={x:W/2-112,y:H*.78,w:224,h:55};rounded(ctx,b.x,b.y,b.w,b.h,16,C.green);text(ctx,'↻ 다시 복구',W/2,b.y+27,font*.85,C.paper);buttons.push({id:'retry',label:'방송 다시 복구',...b,onClick:reset});
    }else if(model.phase==='success'){text(ctx,'✓ 저장 · 송출 확인 완료',W/2,H*.73,font*1.15,C.green);text(ctx,'방송 담당, 드디어 숨 쉬는 중.',W/2,H*.84,font*.75,C.green);}
    if(tipLeft>0)fitText(ctx,tip,W/2,H*.615,W-25,font*.72,C.red);
    if(drag?.moved){ctx.globalAlpha=.90;rounded(ctx,drag.point.x-70,drag.point.y-24,140,48,11,C.lime,C.green);fitText(ctx,chips[drag.index].label,drag.point.x,drag.point.y,128,font*.75,C.green);ctx.globalAlpha=1;}
    if(staticLeft>0){ctx.save();ctx.globalAlpha=.34;for(let i=0;i<24;i++){ctx.fillStyle=i%2?'#f6fcf5':'#102c22';ctx.fillRect(monitor.x,monitor.y+((i*17+t*193)%monitor.h),monitor.w,3+i%5);}ctx.restore();}
    stage.setButtons(buttons);
  });
  return{destroy(){if(destroyed)return;destroyed=true;cancel();stage.root.removeEventListener('pointerdown',down);stage.root.removeEventListener('pointermove',move);stage.root.removeEventListener('pointerup',up);stage.root.removeEventListener('pointercancel',cancel);stage.destroy();},pause(){paused=true;cancel();stage.pause();},resume(){paused=false;stage.resume();},hint(){tip=model.phase==='source'?'노트북 정상? 입력 소스부터!':model.phase==='save'?'저장하고 실제 장비에서 확인!':'글씨 → 색 → 버튼, 하나씩!';tipLeft=2;stage.announce(tip);}};
}
