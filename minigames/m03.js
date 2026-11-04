import {createCanvasStage,COLORS as C,rounded,text,fitText,wrapText,clamp} from './shared.js';

export function start({container,data,onWin=()=>{},onFail=()=>{}}){
  const cfg=data.arcade||{},calls=cfg.calls||data.items.map((item,i)=>({parent:'선생님, 잠깐 통화 괜찮으세요?',choices:item.options,answer:item.answer,tip:'확인할 수 있는 조건을 말해요.',sourceIndex:i}));
  const duration=Math.min(90,cfg.duration||75),answerSeconds=cfg.answerSeconds||3;
  const stage=createCanvasStage(container,{label:'민원 전화 두더지'}),ctx=stage.ctx;
  let elapsed=0,completed=0,missed=0,mode='waiting',next=.7,phone=-1,previousPhone=-1,ringLeft=0,answerLeft=0,revealLeft=0,selected=-1,correct=false,finished=0,won=false,tip='',mistakes=0;
  function sound(name){data.runtime?.playSound?.(name);}
  function reset(){elapsed=0;completed=0;missed=0;mode='waiting';next=.7;phone=-1;previousPhone=-1;ringLeft=0;answerLeft=0;revealLeft=0;selected=-1;correct=false;finished=0;tip='';mistakes=0;stage.announce('울리는 전화기를 누르세요.');}
  function ring(){let p=Math.floor(Math.random()*6);if(p===previousPhone)p=(p+1)%6;phone=p;previousPhone=p;ringLeft=4.5;mode='ringing';sound('notify');stage.announce(`${p+1}번 전화가 울립니다.`);}
  function answerPhone(index){if(mode!=='ringing'||index!==phone)return;mode='answer';answerLeft=answerSeconds;selected=-1;sound('click');stage.announce(`${calls[completed].parent} 1번 ${calls[completed].choices[0]}, 2번 ${calls[completed].choices[1]}`);}
  function fail(reason,message){mistakes++;stage.flash('bad',message);onFail({reason,tip:message});}
  function choose(index){
    if(mode!=='answer')return;selected=index;correct=index===calls[completed].answer;mode='reveal';revealLeft=1.2;
    if(correct){tip='';stage.flash('good','통화 처리 완료');sound('success');}
    else{tip=calls[completed].tip||'구체적인 조건을 골라 주세요.';fail('wrong-prompt',tip);}
  }
  function miss(){missed++;tip='부재중! 다음 전화는 받아 주세요.';fail('missed-call',tip);mode='waiting';next=.7;phone=-1;}
  function timeout(){mode='timeout';phone=-1;fail('timeout','다섯 통을 처리하고 퇴근해요.');stage.announce('시간 종료. 다시 받기를 누르세요.');}
  stage.onKey(k=>{if(mode==='ringing'&&/^[1-6]$/.test(k))answerPhone(Number(k)-1);else if(mode==='answer'&&(k==='1'||k==='2'))choose(Number(k)-1);else if(mode==='timeout'&&(k===' '||k==='enter'))reset();});
  function phoneBox(index,W,H){const narrow=W<590,cols=narrow?2:3,rows=narrow?3:2,gridTop=H*.28,gridHeight=H*.39,cellW=(W-36)/cols,cellH=gridHeight/rows;const w=Math.min(cellW-16,narrow?136:190),h=Math.min(cellH-12,narrow?72:110);return{x:18+(index%cols)*cellW+(cellW-w)/2,y:gridTop+Math.floor(index/cols)*cellH+(cellH-h)/2,w,h};}
  function drawPhone(index,box,t){
    const ringing=mode==='ringing'&&phone===index,active=phone===index&&(mode==='answer'||mode==='reveal'),x=box.x+box.w/2,y=box.y+box.h/2;
    ctx.save();ctx.translate(x,y);if(ringing)ctx.rotate(Math.sin(t*28)*.07);
    ctx.shadowColor='#182e3028';ctx.shadowBlur=10;ctx.shadowOffsetY=8;rounded(ctx,-box.w/2,-box.h/2,box.w,box.h,17,active?C.mint:'#d1d7cc');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    rounded(ctx,-box.w*.33,-box.h*.18,box.w*.66,box.h*.30,5,ringing?C.lime:C.green);
    text(ctx,ringing?'☎ RING':active?'통화 중':String(index+1).padStart(2,'0'),0,-box.h*.03,clamp(box.h*.17,12,17),ringing?C.green:C.paper);
    for(let i=0;i<6;i++)rounded(ctx,-box.w*.14+(i%3)*box.w*.115,box.h*.18+Math.floor(i/3)*box.h*.13,box.w*.075,box.h*.07,2,'#78897f');
    ctx.strokeStyle=ringing?C.orange:C.green;ctx.lineWidth=Math.max(7,box.h*.12);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-box.w*.35,-box.h*.33);ctx.quadraticCurveTo(0,-box.h*.53,box.w*.35,-box.h*.33);ctx.stroke();
    if(ringing){ctx.strokeStyle=C.orange;ctx.lineWidth=3;[-1,1].forEach(sign=>{ctx.beginPath();ctx.arc(sign*box.w*.49,-box.h*.35,12,sign<0?Math.PI*.6:-Math.PI*.4,sign<0?Math.PI*1.4:Math.PI*.4);ctx.stroke();});}
    ctx.restore();
  }
  stage.loop((dt,t,clockDt)=>{
    const W=stage.width,H=stage.height,narrow=W<590,font=clamp(Math.min(W/800,H/650)*25,20,28);
    if(['waiting','ringing','answer','reveal'].includes(mode)){
      elapsed+=clockDt;
      if(mode==='waiting'){next-=clockDt;if(next<=0)ring();}
      else if(mode==='ringing'){ringLeft-=clockDt;if(ringLeft<=0)miss();}
      else if(mode==='answer'){answerLeft-=clockDt;if(answerLeft<=0){missed++;choose(-1);tip='시간 초과! 초록 카드를 기억해요.';}}
      else if(mode==='reveal'){revealLeft-=clockDt;if(revealLeft<=0){if(correct)completed++;if(completed===calls.length){mode='success';finished=0;stage.announce('다섯 통 처리 완료!');}else{mode='waiting';next=.65;phone=-1;}}}
      if(elapsed>=duration&&mode!=='success')timeout();
    }else if(mode==='success'){finished+=clockDt;if(finished>1.8&&!won){won=true;onWin({answered:completed,missed,seconds:Math.round(elapsed),mistakes});}}
    ctx.fillStyle=C.cream;ctx.fillRect(0,0,W,H);
    text(ctx,'민원 전화 두더지',24,36,clamp(font*1.12,20,28),C.green,'left');text(ctx,`${Math.max(0,Math.ceil(duration-elapsed))}s`,W-22,36,Math.max(16,font*.9),C.green,'right');
    text(ctx,'☎ 전화 받고, 구체적인 요청 고르기',W/2,70,clamp(Math.max(16,font*.78),16,20),C.green);
    text(ctx,`✓ ${completed}/${calls.length}`,28,106,font,C.green,'left');text(ctx,`부재중 ${missed}통`,W-25,106,Math.max(16,font*.8),missed?C.red:C.green,'right');
    // An open desktop, not a quiz dialog: phones, paper slips and timer live in place.
    rounded(ctx,10,H*.22,W-20,H*.48,24,'#b99268');ctx.strokeStyle='#a68059';ctx.lineWidth=2;for(let y=H*.25;y<H*.68;y+=38){ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(W-12,y+5);ctx.stroke();}
    for(let i=0;i<6;i++)drawPhone(i,phoneBox(i,W,H),t);
    const buttons=[];
    if(mode==='ringing'){
      const b=phoneBox(phone,W,H);buttons.push({id:`phone-${phone}`,label:`${phone+1}번 전화 받기`,...b,onClick:()=>answerPhone(phone)});
      const barW=Math.min(W*.5,320);rounded(ctx,W/2-barW/2,H*.19,barW,8,4,'#d6dacc');rounded(ctx,W/2-barW/2,H*.19,barW*clamp(ringLeft/4.5,0,1),8,4,C.orange);
      text(ctx,'☎',W/2,H*.81,60,C.orange);text(ctx,'울리는 전화기를 눌러요',W/2,H*.90,Math.max(16,font*.8),C.green);
    }else if(mode==='answer'||mode==='reveal'){
      const call=calls[completed];const bubbleW=Math.min(W-32,650),bubbleY=H*.16;
      rounded(ctx,(W-bubbleW)/2,bubbleY,bubbleW,Math.max(34,H*.055),18,C.paper);fitText(ctx,call.parent,W/2,bubbleY+Math.max(17,H*.0275),bubbleW-26,Math.max(16,font*.85),C.green);
      const gap=12,stacked=W<590,cardW=stacked?W-32:(W-40-gap)/2,cardY=stacked?H*.72:H*.77,cardH=stacked?Math.min(68,H*.12):Math.min(90,H*.14);
      call.choices.forEach((choice,i)=>{
        const x=stacked?16:20+i*(cardW+gap),y=cardY+(stacked?i*(cardH+8):0);const isAnswer=mode==='reveal'&&i===call.answer;const isWrong=mode==='reveal'&&i===selected&&!correct;
        const pulse=isAnswer?1+Math.sin(t*18)*.015:1;ctx.save();ctx.translate(x+cardW/2,y+cardH/2);ctx.scale(pulse,pulse);rounded(ctx,-cardW/2,-cardH/2,cardW,cardH,15,isAnswer?C.lime:isWrong?'#f6c6b9':C.paper,isAnswer?C.green:undefined);text(ctx,isAnswer?'✓':`${i+1}`,-cardW/2+24,0,20,isWrong?C.red:C.green);wrapText(ctx,choice,14,0,cardW-70,{size:Math.max(18,font),color:C.green,lineHeight:24});ctx.restore();
        if(mode==='answer')buttons.push({id:`choice-${i}`,label:`${i+1}번 ${choice}`,x,y,w:cardW,h:cardH,onClick:()=>choose(i)});
      });
      if(mode==='answer'){
        const timerW=W-42;rounded(ctx,21,H*.68,timerW,10,5,'#e0d7c5');rounded(ctx,21,H*.68,timerW*clamp(answerLeft/answerSeconds,0,1),10,5,answerLeft<1?C.red:C.orange);text(ctx,`${answerLeft.toFixed(1)}s`,W/2,H*.68-19,Math.max(16,font*.8),C.green);
      }else if(tip)wrapText(ctx,tip,W/2,H*.67,W-35,{size:17,color:C.red});
    }else if(mode==='waiting'){
      text(ctx,'…',W/2,H*.81,54,C.green);text(ctx,completed?'잠깐의 평화…':'벨이 울리면 받아 주세요',W/2,H*.90,Math.max(16,font*.8),C.green);
    }else if(mode==='success'){
      text(ctx,'✓ 5통 처리 완료',W/2,H*.79,font*1.3,C.green);text(ctx,'잠시, 전화기와 거리 두기.',W/2,H*.9,Math.max(16,font*.8),C.green);
    }else if(mode==='timeout'){
      text(ctx,'☎ 다시 받으면 됩니다',W/2,H*.77,font,C.green);const box={x:W/2-112,y:H*.84,w:224,h:54};rounded(ctx,box.x,box.y,box.w,box.h,16,C.green);text(ctx,'↻ 다시 받기',W/2,box.y+27,font,C.paper);buttons.push({id:'retry',label:'다시 받기',...box,onClick:reset});
    }
    stage.setButtons(buttons);
  });
  return{destroy:()=>stage.destroy(),pause:()=>stage.pause(),resume:()=>stage.resume(),hint(){tip='숫자·대상·행동이 있는 쪽!';stage.announce(tip);if(mode==='answer'){mode='reveal';correct=false;selected=-1;revealLeft=1.2;}}};
}
