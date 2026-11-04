import {createCanvasStage,COLORS as C,rounded,text,fitText,clamp} from './shared.js';

const ACTIONS=[{id:'pass',key:'arrowleft',icon:'←',label:'통과',color:'#8aba96'},{id:'alias',key:'arrowdown',icon:'↓',label:'가상 예시로',color:'#e2be66'},{id:'confiscate',key:'arrowright',icon:'→',label:'압수',color:'#ce7e69'}];
/** A rejected item returns to the belt; it never counts as learned. */
export function createSearchModel(items){
  const queue=items.map(item=>({...item}));let cleared=0,mistakes=0;
  return{get current(){return queue[0]||null;},get cleared(){return cleared;},get mistakes(){return mistakes;},get done(){return queue.length===0;},choose(action){if(!queue.length)return null;const item=queue.shift(),correct=action===item.action;if(correct)cleared++;else{mistakes++;queue.push(item);}return{correct,item,action};}};
}
export function start({container,data,onWin=()=>{},onFail=()=>{}}){
  const cfg=data.arcade||{},items=cfg.items;
  if(!Array.isArray(items)||items.length!==11||items.some(i=>!ACTIONS.some(a=>a.id===i.action)))throw new Error('m07 requires eleven classified objects.');
  const stage=createCanvasStage(container,{label:'개인정보 검색대'}),ctx=stage.ctx,duration=Math.min(90,cfg.duration||90);
  let model=createSearchModel(items),elapsed=0,travel=0,mode='play',reveal=0,result=null,tip='',won=false,finish=0;
  const sound=name=>data.runtime?.playSound?.(name);
  function reset(){model=createSearchModel(items);elapsed=0;travel=0;mode='play';reveal=0;result=null;tip='';finish=0;stage.announce('컨베이어의 물건을 세 갈래로 분류하세요.');}
  function choose(action){if(mode!=='play')return;result=model.choose(action);travel=0;mode='reveal';reveal=result.correct?.65:1.25;tip=result.correct?(action==='alias'?'원본 대신 완전히 가상인 예시!':''):(result.item.tip||'초록빛 분류함을 기억해요.');
    stage.flash(result.correct?'good':'bad',tip||'분류 완료');sound(result.correct?'click':'error');
    if(!result.correct)onFail({reason:action?'wrong-bin':'missed-item',item:result.item.id,tip});
  }
  function timeout(){mode='timeout';stage.flash('bad','다시 검색해도 괜찮아요.');sound('error');onFail({reason:'timeout',tip:'다시 검색해도 괜찮아요.'});}
  stage.onKey(key=>{const action=ACTIONS.find(a=>a.key===key);if(action)choose(action.id);else if(mode==='timeout'&&(key==='enter'||key===' '))reset();});
  stage.loop((dt,t,clockDt)=>{
    const W=stage.width,H=stage.height,font=clamp(Math.min(W/800,H/650)*24,16,26),beltY=H*.45,itemW=Math.min(180,W*.42),itemH=Math.min(126,H*.20),buttons=[];
    if(mode==='play'||mode==='reveal'){
      elapsed+=clockDt;
      if(mode==='play'){travel+=clockDt/(5.5-model.cleared*.16);if(travel>=1)choose(null);}
      else{reveal-=clockDt;if(reveal<=0){if(model.done){mode='success';finish=0;stage.announce('11개 모두 검색 완료!');}else{mode='play';result=null;stage.announce(`${model.current.label} 분류`);}}}
      if(elapsed>=duration&&mode!=='success')timeout();
    }else if(mode==='success'){finish+=clockDt;if(finish>.9&&!won){won=true;onWin({classified:model.cleared,mistakes:model.mistakes,seconds:Math.round(elapsed)});}}
    ctx.fillStyle=C.cream;ctx.fillRect(0,0,W,H);text(ctx,'개인정보 검색대',22,36,font,C.green,'left');text(ctx,`${Math.max(0,Math.ceil(duration-elapsed))}s`,W-85,36,font*.8,C.green,'right');
    fitText(ctx,'↔ 통과 · ↓ 가상 대체 · → 압수',W/2,72,W-30,font*.75,C.green);text(ctx,`✓ ${model.cleared}/11`,24,110,font*.85,C.green,'left');
    // A scanning arch and moving rollers make the decision a physical sorting job.
    rounded(ctx,W*.37,H*.21,W*.28,H*.39,18,'#9ab4aa');rounded(ctx,W*.41,H*.25,W*.20,H*.31,12,'#2b4c45');
    text(ctx,'SCAN',W*.51,H*.23,12,C.paper);ctx.fillStyle='#6ad6a7';ctx.fillRect(W*.43+Math.sin(t*2)*W*.025,H*.28,3,H*.25);
    rounded(ctx,12,beltY+itemH*.35,W-24,54,13,'#657b71');
    for(let x=-20;x<W+25;x+=34){const xx=x+(t*35)%34;ctx.fillStyle='#8da396';ctx.beginPath();ctx.arc(xx,beltY+itemH*.35+29,12,0,Math.PI*2);ctx.fill();}
    const item=mode==='reveal'?result?.item:model.current;
    if(item&&(mode==='play'||mode==='reveal')){
      const progress=mode==='reveal'?clamp(1-reveal/(result.correct?.65:1.25),0,1):0,targetIndex=result?ACTIONS.findIndex(a=>a.id===(result.action||result.item.action)):1;
      const x=mode==='reveal'?W*.52+(W*(targetIndex+.5)/3-W*.52)*progress:W*.15+travel*W*.70;
      const y=beltY+progress*(H*.70-beltY);
      ctx.save();ctx.translate(x,y);if(mode==='reveal')ctx.rotate(Math.sin(t*18)*.04);
      rounded(ctx,-itemW/2,-itemH/2,itemW,itemH,15,C.paper,mode==='reveal'?(result.correct?C.green:C.red):'#d8cbb0');
      text(ctx,item.icon||'▣',0,-itemH*.14,Math.min(42,itemH*.38),C.green);fitText(ctx,result?.correct&&result.action==='alias'?(item.aliasResult||'가상 예시'):item.label,0,itemH*.27,itemW-14,font*.85,C.green);if(result?.correct&&result.action==='alias'){ctx.rotate(-.15);rounded(ctx,-36,-itemH*.35,72,30,4,'#d8ed92',C.green);text(ctx,'가상 도장',0,-itemH*.35+15,13,C.green);}ctx.restore();
    }
    const boxY=H*.72,boxH=Math.min(100,H*.18),gap=10,boxW=(W-40-gap*2)/3;
    ACTIONS.forEach((action,i)=>{const x=20+i*(boxW+gap),correctBin=mode==='reveal'&&result&&!result.correct&&result.item.action===action.id;
      rounded(ctx,x,boxY,boxW,boxH,15,correctBin?C.lime:action.color,correctBin?C.green:undefined);
      text(ctx,correctBin?'✓':action.icon,x+boxW/2,boxY+boxH*.28,font*1.15,C.green);fitText(ctx,action.label,x+boxW/2,boxY+boxH*.65,boxW-10,font*.8,C.green);
      if(mode==='play')buttons.push({id:action.id,label:`${action.icon} ${action.label}`,x,y:boxY,w:boxW,h:boxH,onClick:()=>choose(action.id)});
    });
    if(mode==='reveal'&&tip)fitText(ctx,tip,W/2,H*.65,W-30,font*.8,result.correct?C.green:C.red);
    else if(mode==='play')fitText(ctx,'가명 도장 = 실제 기록 대신 가상 예시',W/2,H*.65,W-30,font*.7,C.green);
    if(mode==='success'){rounded(ctx,W*.12,H*.29,W*.76,H*.30,24,C.paper);text(ctx,'✓ 검색 완료',W/2,H*.40,font*1.5,C.green);text(ctx,'개인정보는 두고, 퇴근은 함께.',W/2,H*.50,font*.8,C.green);}
    if(mode==='timeout'){
      rounded(ctx,W*.1,H*.28,W*.8,H*.33,20,C.paper);text(ctx,'다시 검색하면 돼요',W/2,H*.38,font,C.green);
      const b={x:W/2-110,y:H*.46,w:220,h:52};rounded(ctx,b.x,b.y,b.w,b.h,15,C.green);text(ctx,'↻ 다시 검색',W/2,b.y+26,font*.85,C.paper);buttons.push({id:'retry',label:'다시 검색',...b,onClick:reset});
    }
    stage.setButtons(buttons);
  });
  return{destroy:()=>stage.destroy(),pause:()=>stage.pause(),resume:()=>stage.resume(),hint(){tip='실제 명단·상담 기록은 압수!';stage.announce(tip);if(mode==='play'){result={item:model.current,correct:false};mode='reveal';reveal=1.5;}}};
}
