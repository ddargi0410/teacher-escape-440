import { MISSIONS, COMMON_COPY } from './missions-data.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = values => { const a=[...values]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; };

/** Local checklist only. It never calls an AI service or assesses teaching quality. */
export function evaluatePrompt(value) {
  const text = String(value || '').normalize('NFKC');
  const compact = text.replace(/\s+/g,' ');
  const has = re => re.test(compact);
  const enough = text.trim().length >= 120;
  const negativePrivate = has(/(?:개인정보|실명|학생\s*이름|얼굴|연락처)[^.!?\n]{0,28}(?:제외|금지|않|말|넣지|쓰지|사용하지|수집하지|저장하지|입력하지|하지\s*마|필요\s*없)/);
  const positivePrivate = has(/(?:실제\s*학생\s*(?:이름|사진|정보)|학생\s*실명|학생\s*얼굴|개인정보)[^.!?\n]{0,18}(?:넣어|포함해|수집해|저장해|보내|업로드해)/);
  const checks = {
    audience: has(/초등(?:학교|학생)?\s*(?:[1-6]|일|이|삼|사|오|육)\s*학년|(?:[1-6]|일|이|삼|사|오|육)\s*학년\s*(?:인\s*)?초등(?:학교|학생)?/),
    goal: has(/생태|생물|먹이\s*(?:관계|사슬|그물)|환경/) && has(/이해|배우|학습|설명|알아|구분|익히|탐구|관찰/),
    interaction: has(/클릭|드래그|선택|누르|연결|퀴즈/) && has(/정답|피드백|해설|결과|오답|성공|다시/),
    constraints: negativePrivate && !positivePrivate && has(/태블릿|PC|브라우저|설치|모바일|스마트폰/) && has(/직접\s*(?:그린|만든|제작)|저작권|이용\s*허락|사용\s*허락|라이선스|공개\s*라이선스|도형/),
    format: has(/HTML/i) && has(/파일|코드|페이지/) && has(/GitHub\s*Pages|깃허브\s*페이지|브라우저|설치\s*없이|단일|하나/),
    validation: has(/과학|생태|먹이|생물/) && has(/검증|확인|검토|출처/) && has(/동작|버튼|오류|테스트|정답/) && !has(/(?:검증|확인|테스트)[^.!?\n]{0,8}(?:하지\s*마|하지\s*않|생략|필요\s*없)/),
    steps: has(/먼저|1단계|1\s*[.)]|첫째/) && has(/다음|그다음|그\s*다음|2단계|2\s*[.)]|이후/),
    scope: has(/유지|그대로|건드리지|바꾸지/) && has(/수정|변경|바꿔|고쳐|고칠|부분만/) && has(/\d+\s*문항|핵심|시제품|범위/) && has(/까지만|만\s*만들|제외|나중|범위/)
  };
  const rubric = MISSIONS.find(m=>m.id===10).rubric;
  return {passed:enough && Object.values(checks).every(Boolean),lengthOK:enough,characters:text.trim().length,checks:rubric.map(r=>({...r,passed:!!checks[r.id]}))};
}

export function createMissionUI({container,onSuccess=()=>{},onFailure=()=>{},onClose=()=>{},onDraft=()=>{},getDraft=()=>'',getRelaxed=()=>false}) {
  let mission=null, round=0, answers={}, selected=null, order=[], staged={}, timer=null, remaining=0, timed=false, timerAt=0, settled=false, showing=false, awarded=false, previousFocus=null;
  const $ = s=>container.querySelector(s);
  const $$ = s=>[...container.querySelectorAll(s)];
  const clearTimer=()=>{if(timer)clearInterval(timer);timer=null;};
  document.addEventListener('visibilitychange',()=>{timerAt=performance.now();});
  function close(){if(!showing)return;clearTimer();showing=false;mission=null;container.hidden=true;container.replaceChildren();previousFocus?.focus?.();onClose();}
  function shell(){
    container.hidden=false;
    container.innerHTML=`<section class="mission-dialog" role="dialog" aria-modal="true" aria-labelledby="mission-title"><div class="mission-top"><span class="mission-kicker">MISSION ${String(mission.id).padStart(2,'0')} / 10 · ${mission.floor}F ${esc(mission.room)}</span><button class="mission-close" type="button" aria-label="미션 닫기">×</button></div><h2 id="mission-title">${esc(mission.title)}</h2><div class="npc-line"><span class="npc-avatar" aria-hidden="true">${mission.id===10?'👔':'☕'}</span><div><b>${esc(mission.npc)}</b><p>${esc(mission.intro)}</p></div></div><div id="mission-body"></div><div id="mission-feedback" aria-live="polite"></div><div id="mission-hint-panel" hidden></div><div class="mission-bottom"><button class="mission-hint" type="button">힌트 보기 <kbd>H</kbd></button><span class="mission-caption">오답도 배움입니다. 퇴근만 조금 늦어집니다.</span></div></section>`;
    $('.mission-close').onclick=close;
    $('.mission-hint').onclick=hint;
  }
  function hint(){if(!showing)return;$('#mission-hint-panel').hidden=false;$('#mission-hint-panel').innerHTML=`<div class="mission-note"><b>${esc(COMMON_COPY.hintTitle)}</b><p>${esc(mission.hint)}</p></div>`;$('#mission-hint-panel').scrollIntoView({block:'nearest'});}
  function body(html){$('#mission-body').innerHTML=html;$('#mission-feedback').innerHTML='';settled=false;}
  function feedback(ok, explanation, next){
    if(settled)return;settled=true;
    if(!ok)onFailure(mission.id);
    $('#mission-feedback').innerHTML=`<div class="mission-result ${ok?'good':'bad'}" tabindex="-1"><strong>${esc(ok?COMMON_COPY.success:COMMON_COPY.failure)}</strong><p>${esc(explanation)}</p><button class="mission-primary feedback-next" type="button">${ok?'다음으로 →':'확인하고 다시 도전'}</button></div>`;
    $('#mission-body').querySelectorAll('button,input').forEach(b=>b.disabled=true);
    $('.feedback-next').onclick=next;
    $('.mission-result').focus();
  }
  function complete(payload={}){
    clearTimer();settled=true;
    $('#mission-body').innerHTML=`<div class="mission-clear" tabindex="-1"><div class="clear-seal">✓</div><span class="mission-kicker">업무 처리 완료</span><h3>${esc(mission.success || '수고했어요. 이 업무는 끝났습니다.')}</h3><article class="knowledge-card"><span>획득한 업무 노하우 ${String(mission.id).padStart(2,'0')}</span><h4>${esc(mission.card.title)}</h4><p>${esc(mission.card.body)}</p></article><button class="mission-primary collect-card" type="button">노하우 챙기고 돌아가기 →</button></div>`;
    $('#mission-feedback').innerHTML='';
    $('.collect-card').onclick=close;$('.mission-clear').focus();
    if(!awarded){awarded=true;onSuccess(mission.id,payload);}
  }
  function choiceScreen(item,choices,answer,explanation,onCorrect){
    body(`<div class="mission-progress"><span>${round+1} / ${mission.items?.length||mission.turns?.length||(mission.type==='bug'?2:1)}</span><div><i style="width:${100*(round+1)/(mission.items?.length||mission.turns?.length||(mission.type==='bug'?2:1))}%"></i></div></div><h3 class="question">${esc(item)}</h3><div class="answer-options">${choices.map((t,i)=>`<button type="button" class="answer-option" data-choice="${i}"><span>${String.fromCharCode(65+i)}</span><div>${esc(t)}</div></button>`).join('')}</div>`);
    $('.mission-dialog').scrollTop=0;
    $$('[data-choice]').forEach(b=>b.onclick=()=>{const ok=+b.dataset.choice===answer;b.classList.add(ok?'correct':'incorrect');feedback(ok,ok?explanation:`정답: ${choices[answer]}\n\n${explanation}`,ok?onCorrect:render);});
  }
  function quiz(){
    const q=mission.items[round];
    choiceScreen(q.q,mission.type==='ox'?['O · 그렇다','X · 아니다']:q.options,mission.type==='ox'?(q.answer?0:1):q.answer,q.explanation,()=>{round++;round===mission.items.length?complete():render();});
    if(q.aside)$('.question').insertAdjacentHTML('beforebegin',`<div class="round-aside">${esc(q.aside)}</div>`);
  }
  function assemble(){
    body(`<p class="mission-instruction">카드를 끌어 놓거나, 카드 → 빈칸을 차례로 눌러 프롬프트를 완성하세요. 불필요한 카드는 남겨 두세요.</p><div class="prompt-slots">${mission.slots.map(s=>`<button type="button" class="prompt-slot ${staged[s.id]?'filled':''}" data-slot="${s.id}"><b>${esc(s.label)}</b><span>${esc(mission.cards.find(c=>c.id===staged[s.id])?.text||'카드를 여기에 놓기')}</span></button>`).join('')}</div><div class="card-bank">${mission.cards.filter(c=>!Object.values(staged).includes(c.id)).map(c=>`<button type="button" draggable="true" data-card="${c.id}" class="prompt-piece ${selected===c.id?'selected':''}">${esc(c.text)}</button>`).join('')}</div><div class="mission-actions"><button type="button" class="mission-secondary" id="reset-assemble">처음부터</button><button type="button" class="mission-primary" id="check-assemble">프롬프트 제출</button></div>`);
    $$('[data-card]').forEach(b=>{b.onclick=()=>{selected=b.dataset.card;assemble();};b.ondragstart=e=>{selected=b.dataset.card;e.dataTransfer.setData('text/plain',selected);};});
    $$('[data-slot]').forEach(b=>{const put=id=>{if(!id)return;if(!mission.cards.some(c=>c.id===id))return;for(const k of Object.keys(staged))if(staged[k]===id)delete staged[k];staged[b.dataset.slot]=id;selected=null;assemble();};b.onclick=()=>{if(selected)put(selected);else if(staged[b.dataset.slot]){delete staged[b.dataset.slot];assemble();}};b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();put(e.dataTransfer.getData('text/plain'));};});
    $('#reset-assemble').onclick=()=>{staged={};selected=null;assemble();};
    $('#check-assemble').onclick=()=>{const ok=mission.slots.every(s=>mission.cards.find(c=>c.id===staged[s.id])?.slot===s.id);feedback(ok,mission.explanation,ok?()=>complete():assemble);};
  }
  function ordering(){
    body(`<p class="mission-instruction">한 번에 전부 시키면 복사기도 AI도 멈춥니다. 요청을 실행할 순서로 정리하세요. 카드를 끌거나 ↑ ↓ 버튼을 누르세요.</p><div class="order-list">${order.map((id,i)=>`<div class="order-piece" draggable="true" data-order="${id}"><b>${i+1}</b><p>${esc(mission.cards.find(c=>c.id===id).text)}</p><div><button type="button" data-move="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="${i+1}번 카드 위로">↑</button><button type="button" data-move="${i}" data-direction="1" ${i===order.length-1?'disabled':''} aria-label="${i+1}번 카드 아래로">↓</button></div></div>`).join('')}</div><button type="button" class="mission-primary" id="check-order">이 순서로 요청하기</button>`);
    $$('[data-move]').forEach(b=>b.onclick=()=>{const i=+b.dataset.move,j=i+(+b.dataset.direction);[order[i],order[j]]=[order[j],order[i]];ordering();});
    $$('[data-order]').forEach(b=>{b.ondragstart=e=>e.dataTransfer.setData('text/plain',b.dataset.order);b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain'),from=order.indexOf(id),to=order.indexOf(b.dataset.order);if(from<0||to<0)return;order.splice(from,1);order.splice(to,0,id);ordering();};});
    $('#check-order').onclick=()=>feedback(order.every((id,i)=>id===mission.answer[i]),mission.explanation,order.every((id,i)=>id===mission.answer[i])?()=>complete():ordering);
  }
  function bug(){
    if(round===1){const q=mission.repair;choiceScreen(q.q,q.options,q.answer,q.explanation,()=>complete());return;}
    body(`<p class="mission-instruction">아래는 고장 난 학습자료의 미리보기입니다. 화면의 버튼을 직접 눌러 보고, 오류가 있는 기능을 골라 주세요.</p><div class="bug-browser"><div class="browser-chrome"><i></i><i></i><i></i><span>생태 탐구실 / 미리보기</span></div><div class="bug-app"><span class="bug-leaf">🌱</span><h3>${esc(mission.screen.title)}</h3><p>${esc(mission.screen.caption)}</p><div class="bug-buttons">${mission.screen.buttons.map(b=>`<button type="button" class="mission-secondary" data-probe="${b.id}">${esc(b.label)}</button>`).join('')}</div><div class="bug-log" role="status">버튼을 눌러 작동을 확인하세요.</div></div></div><h3 class="question">${esc(mission.screen.question)}</h3><div class="answer-options">${mission.screen.buttons.map(b=>`<button type="button" class="answer-option" data-bug="${b.id}"><span>?</span>${esc(b.label)}</button>`).join('')}</div>`);
    $$('[data-probe]').forEach(b=>b.onclick=()=>{const q=mission.screen.buttons.find(q=>q.id===b.dataset.probe);$('.bug-log').textContent=q.result;$('.bug-log').classList.toggle('error',q.bug);});
    $$('[data-bug]').forEach(b=>b.onclick=()=>{const ok=mission.screen.buttons.find(q=>q.id===b.dataset.bug).bug;feedback(ok,mission.explanation,ok?()=>{round=1;render();}:bug);});
  }
  function science(){
    body(`<p class="mission-instruction">AI가 자신 있게 만든 자료입니다. <strong>과학적으로 틀린 설명을 모두</strong> 눌러 표시하세요.</p><div class="science-notes">${mission.items.map((q,i)=>`<button type="button" class="science-note ${answers[i]?'selected':''}" data-fact="${i}" aria-pressed="${!!answers[i]}"><span>${answers[i]?'✓':String(i+1).padStart(2,'0')}</span><p>${esc(q.q)}</p><small>검토 메모</small></button>`).join('')}</div><button type="button" class="mission-primary" id="check-science">검증 결과 제출</button>`);
    $$('[data-fact]').forEach(b=>b.onclick=()=>{answers[b.dataset.fact]=!answers[b.dataset.fact];science();});
    $('#check-science').onclick=()=>{const ok=mission.items.every((q,i)=>!!answers[i]===q.wrong);const why=mission.items.map((q,i)=>`${i+1}. ${q.wrong?'수정 필요':'맞는 설명'} — ${q.explanation}`).join('\n');feedback(ok,why,ok?()=>complete():science);};
  }
  function sorting(){
    body(`<p class="mission-instruction">공개 AI 서비스에 요청하고, 결과를 웹에 배포하는 상황입니다. 카드 → 분류함을 누르거나 끌어 놓으세요.</p><div class="sort-bins">${mission.categories.map(c=>`<section class="sort-bin" data-bin="${c.id}" tabindex="0" role="button" aria-label="${esc(c.label)}"><h3>${esc(c.label)}</h3>${mission.items.filter(i=>staged[i.id]===c.id).map(i=>`<button type="button" class="sorted-item" data-unsort="${i.id}" title="누르면 다시 꺼내기">${esc(i.text)} <span>↶</span></button>`).join('')}<span class="drop-label">여기에 놓기</span></section>`).join('')}</div><div class="card-bank">${mission.items.filter(i=>!staged[i.id]).map(i=>`<button type="button" class="prompt-piece ${selected===i.id?'selected':''}" draggable="true" data-sort="${i.id}">${esc(i.text)}</button>`).join('')}</div><button type="button" class="mission-primary" id="check-sort">분류 완료</button>`);
    $$('[data-sort]').forEach(b=>{b.onclick=()=>{selected=b.dataset.sort;sorting();};b.ondragstart=e=>{selected=b.dataset.sort;e.dataTransfer.setData('text/plain',selected);};});
    $$('[data-unsort]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(selected){staged[selected]=staged[b.dataset.unsort];selected=null;}else delete staged[b.dataset.unsort];sorting();});
    $$('[data-bin]').forEach(b=>{const put=id=>{if(!mission.items.some(i=>i.id===id))return;staged[id]=b.dataset.bin;selected=null;sorting();};b.onclick=()=>{if(selected)put(selected);};b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(selected)put(selected);}};b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();put(e.dataTransfer.getData('text/plain'));};});
    $('#check-sort').onclick=()=>{const ok=mission.items.every(i=>staged[i.id]===i.category);feedback(ok,mission.explanation+'\n'+mission.items.map(i=>`${i.text} → ${mission.categories.find(c=>c.id===i.category).label}: ${i.explanation}`).join('\n'),ok?()=>complete():sorting);};
  }
  function chat(){
    const turn=mission.turns[round];
    choiceScreen(turn.q,turn.options,turn.answer,turn.explanation,()=>{round++;round===mission.turns.length?complete():chat();});
    $('.question').insertAdjacentHTML('beforebegin',`<div class="chat-thread"><div class="ai-message"><b>AI 동료 · ${round+1}차 결과</b><p>${esc(turn.ai)}</p></div>${round>0?`<div class="chat-stamp">이전 수정 사항을 유지한 채 대화를 이어갑니다.</div>`:''}${turn.preview?`<div class="broadcast-preview turn-${round}"><div><i></i><span>${esc(turn.preview.title)}</span><b>${esc(turn.preview.status)}</b></div><section><strong>${esc(turn.preview.screenText)}</strong><span>${esc(turn.preview.button)}</span></section></div>`:''}</div>`);
  }
  function speedIntro(){
    body(`<div class="speed-intro"><span class="speed-icon">⏱</span><h3>급식 종이 울리기 전에!</h3><p>용어 ${mission.items.length}문제 · 기본 ${mission.timeLimit||90}초<br>틀려도 해설을 읽고 다시 고를 수 있어요.</p><label class="relaxed-toggle"><input type="checkbox" id="relaxed-mode" ${getRelaxed()?'checked':''}> 천천히 읽기 · 시간 제한 없이 도전</label><button type="button" class="mission-primary" id="speed-start">준비됐어요, 시작!</button></div>`);
    $('#speed-start').onclick=()=>{timed=!$('#relaxed-mode').checked;remaining=mission.timeLimit||90;round=0;speedQuestion();if(timed)startTimer();};
  }
  function startTimer(){clearTimer();timerAt=performance.now();timer=setInterval(()=>{const now=performance.now();const delta=(now-timerAt)/1000;timerAt=now;if(document.hidden||settled)return;remaining=Math.max(0,remaining-delta);const el=$('#speed-time');if(el)el.textContent=Math.ceil(remaining)+'초';if(remaining<=0){clearTimer();feedback(false,COMMON_COPY.speedTimeout,()=>{round=0;speedIntro();});}},150);}
  function speedQuestion(){
    const q=mission.items[round];choiceScreen(q.q,q.options,q.answer,q.explanation,()=>{round++;if(round===mission.items.length)complete();else speedQuestion();});
    $('#mission-body').insertAdjacentHTML('afterbegin',`<div class="speed-timer">${timed?'남은 시간':'천천히 읽기 모드'} <b id="speed-time">${timed?Math.ceil(remaining)+'초':'∞'}</b><small>해설을 읽는 동안 시간은 멈춰요.</small></div>`);
    // Wrong answers return to this round, not to the speed-quiz introduction.
    $$('[data-choice]').forEach(b=>b.onclick=()=>{const ok=+b.dataset.choice===q.answer;feedback(ok,ok?q.explanation:`정답: ${q.options[q.answer]}\n\n${q.explanation}`,ok?()=>{round++;round===mission.items.length?complete():speedQuestion();}:speedQuestion);});
  }
  function boss(){
    const draft=getDraft()||'';
    body(`<div class="boss-brief"><span>교문 앞 / 새 업무가 도착했습니다</span><p>${esc(mission.prompt)}</p></div><label class="prompt-label" for="boss-prompt">AI에게 보낼 요청을 직접 작성해 주세요.</label><p class="mission-instruction">${esc(COMMON_COPY.noPersonalData)}</p><textarea id="boss-prompt" maxlength="6000" rows="9" placeholder="당신은 초등 과학 수업자료 개발자야. 초등…">${esc(draft)}</textarea><div class="prompt-meta"><span id="prompt-count">${draft.length} / 6,000자</span><span>브라우저에 자동 저장</span></div><div class="rubric-grid">${mission.rubric.map(r=>`<div class="rubric-item" data-rule="${r.id}"><span>○</span><div><b>${esc(r.label)}</b><small>${esc(r.help)}</small></div></div>`).join('')}</div><p class="local-grading">${esc(COMMON_COPY.promptNotice)}</p><div class="mission-actions"><button type="button" class="mission-secondary" id="show-sample">예시 읽기</button><button type="button" class="mission-primary" id="check-prompt">최종 퇴근 결재 요청 →</button></div><div id="prompt-sample" hidden></div>`);
    $('#boss-prompt').oninput=e=>{onDraft(e.target.value);$('#prompt-count').textContent=e.target.value.length+' / 6,000자';settled=false;$('#mission-feedback').innerHTML='';};
    $('#show-sample').onclick=()=>{const sample=$('#prompt-sample');sample.hidden=!sample.hidden;sample.innerHTML=`<div class="mission-note"><b>참고용 예시 · 내 수업에 맞게 고쳐 쓰기</b><p>${esc(mission.sample)}</p></div>`;};
    $('#check-prompt').onclick=()=>{
      if(settled)return;const text=$('#boss-prompt').value;onDraft(text);const result=evaluatePrompt(text);
      result.checks.forEach(r=>{const el=$(`[data-rule="${r.id}"]`);el.classList.toggle('passed',r.passed);el.classList.toggle('missing',!r.passed);el.querySelector('span').textContent=r.passed?'✓':'!';});
      if(result.passed){boundary({prompt:text,rubric:result.checks});return;}
      settled=true;onFailure(mission.id);
      $('#mission-feedback').innerHTML=`<div class="mission-result bad"><strong>조금만 더 구체적으로 써 주세요.</strong><p>${!result.lengthOK?'짧은 키워드 목록 대신 120자 이상의 실제 요청 문장으로 써 주세요.\n':''}${result.checks.filter(r=>!r.passed).map(r=>`• ${r.label}: ${r.help}`).join('\n')}</p><small>검출되지 않은 조건만 보완하면 됩니다. 자유로운 표현을 모두 이해하는 채점기는 아니므로 위의 핵심 표현을 참고하세요.</small></div>`;
    };
  }
  function boundary(payload){
    if(!mission.boundary){complete(payload);return;}
    const b=mission.boundary;
    body(`<div class="boundary-brief"><span class="mission-kicker">마지막 결재</span><h3>${esc(b.npc)}</h3><p>${esc(b.prompt || '')}</p></div><div class="answer-options">${b.options.map((o,i)=>`<button type="button" class="answer-option" data-boundary="${i}"><span>${i+1}</span><div>${esc(o.text)}</div></button>`).join('')}</div>`);
    $$('[data-boundary]').forEach(el=>el.onclick=()=>{const o=b.options[+el.dataset.boundary];if(o.ok){complete(payload);return;}if(settled)return;settled=true;$('#mission-feedback').innerHTML=`<div class="mission-result bad"><strong>${esc(o.reply)}</strong><p>${esc(b.retry || '')}</p><button type="button" class="mission-primary" id="boundary-retry">다시 선택하기</button></div>`;$('#mission-body').querySelectorAll('button').forEach(x=>x.disabled=true);$('#boundary-retry').onclick=()=>boundary(payload);});
  }
  function render(){if(!mission)return;switch(mission.type){case 'ox':case 'compare':quiz();break;case 'assemble':assemble();break;case 'order':ordering();break;case 'bug':bug();break;case 'science':science();break;case 'sort':sorting();break;case 'chat':chat();break;case 'speed':speedIntro();break;case 'prompt':boss();break;default:quiz();}}
  function open(id){const m=MISSIONS.find(m=>m.id===id);if(!m)return;clearTimer();previousFocus=document.activeElement;mission=m;showing=true;awarded=false;round=0;answers={};staged={};selected=null;settled=false;order=m.type==='order'?shuffle(m.answer):[];shell();render();$('.mission-close').focus();}
  return {open,close,isOpen:()=>showing,hint};
}
