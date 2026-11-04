import * as THREE from './vendor/three.module.js';
import {createWorld} from './world.js';
import {SoftwareRenderer} from './software-renderer.js';
import {createPlayer} from './player.js';
import * as MissionData from './missions-data.js';
import {createMissionUI} from './missions-ui.js';
import {createMinigameRunner} from './minigames/runner.js';
import {NPC_LINES,getKnowledgeDetails,getArcadeData} from './minigames/content.js';
import {createWorldFeedback} from './world-feedback.js';
import {createSchoolMessenger} from './messenger.js';
import {createLearningRoom} from './learning-room.js';
import {createRestRoom} from './rest-room.js';
import {createPresence} from './presence.js';
import {createChannels} from './channels.js';
import {createChannelUI} from './channels-ui.js';
import {PRESENCE_ENDPOINT} from './presence-config.js';
import {freshState,loadGame,saveGame,storageAvailable} from './save.js';
import {AudioManager} from './audio.js';
import {downloadCertificate,copyText} from './certificate.js';

const {MISSIONS}=MissionData;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const departure=()=>{const m=1000+state.penalty;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`};
const floorNames={5:'교실 · 학년 연구실',4:'교무실 · 도서관',3:'컴퓨터실 · 과학실',2:'행정실 · 방송실',1:'급식실 · 배움터 · 보건실 · 교문'};
const canvas=$('#world'),overlay=$('#app-overlay'),audio=new AudioManager();
let state=loadGame()||freshState(),mode='home',world,player,renderer,scene,camera,teacher,nearest=null,activeMission=null;
let frame=0,saveClock=0,toastTimer,tutorialTime=0,endingTime=0,lastFocus=null,overlayKind='',nightAmount=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let sun,ambient,feedback;
let encounter=null,npcSpeechClock=0,lastSpokenNPC=null;
let presence,channels,restingBed=null,restView=false,wantsChannelRest=false;
const onlineNickname=`퇴근동료${Math.floor(1000+Math.random()*9000)}`;
const channelUI=createChannelUI({container:$('#channels-overlay'),onSelect:selectChannel,onClose:()=>{wantsChannelRest=false;player?.setActive(mode==='play'&&!busy());},onRefresh:()=>channels?.refresh(),onSolo:()=>{channels?.stop();channelUI.close();},onReconnect:reconnectChannels});
const learning=createLearningRoom({container:$('#learning-overlay'),onClose:()=>{player?.setActive(mode==='play'&&overlay.hidden);},onLearned:()=>{state.beginnerLearned=true;$('#learning-button').textContent='🌱 배움터 ✓';persist();toast('기초 체험 완료 · 이제 미션에서 써먹어 봐요.')}});
const rest=createRestRoom({audio,getBed:id=>world?.getBed(id),onEnter:bed=>{clearEncounter();messenger.suspend();restView=player.firstPerson;player.setView(false);player.setActive(false);player.teleport(bed.bedPose);world.setRestPose(teacher,bed.id);restingBed=bed;},onLeave:bed=>{world?.clearRestPose(teacher);restingBed=null;if(player){player.teleport(bed.exitPoint);player.setView(restView);player.setActive(mode==='play'&&overlay.hidden);}}});
const messenger=createSchoolMessenger({getState:()=>state,onLocate:id=>{if(!busy())travelToMission(id)},onSound:()=>audio.play('notify')});
const arcade=createMinigameRunner({container:$('#minigame-overlay'),onSuccess:recordSuccess,onFailure:missionFailure,onClose:()=>{activeMission=null;player?.setActive(mode==='play'&&overlay.hidden);}});
function missionFailure(id,payload){state.penalty=Math.min(320,state.penalty+5);persist();audio.play('error');updateHUD();if(id>3)toast('✗ 퇴근 +5분 · 다시 도전해요.');}
function recordSuccess(id,payload){
 if(!state.completed.includes(id)){state.completed.push(id);state.completed.sort((a,b)=>a-b);world.setCompleted(state.completed);audio.play('success');}
 if(id===10){if(typeof payload?.prompt==='string')state.bossDraft=payload.prompt;state.finished=true;}
 persist();updateHUD();
}
function clearEncounter(){encounter=null;document.body.classList.remove('stumbling');if(teacher)teacher.rotation.z=0;feedback?.clear();}
function onCrowdEvent(event){
 if(busy())return;
 if(event.type==='complaint'){feedback.speak(()=>world.getCharacterAnchor(event.actor),event.text);audio.play('notify');return;}
 if(event.type==='message'){if(tutorialTime<=0)messenger.request();return;}
 encounter={...event,remaining:event.duration};feedback.speak(()=>world.getCharacterAnchor(event.actor),event.text);
 if(event.type==='principal'){state.penalty=Math.min(320,state.penalty+1);persist();updateHUD();audio.play('notify');}
 else{document.body.classList.add('stumbling');audio.play('error');}
 player.setActive(false);
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500)}
function persist(){saveGame(state)}
function busy(){return !overlay.hidden||missions.isOpen()||arcade.isOpen()||!!encounter||learning.isOpen()||rest.isOpen()||channelUI.isOpen()||mode!=='play'||document.hidden}
const missions=createMissionUI({container:$('#mission-overlay'),getDraft:()=>state.bossDraft,getRelaxed:()=>state.settings.relaxed,
 onDraft:text=>{state.bossDraft=text;persist()},
 onFailure:missionFailure,
 onSuccess:recordSuccess,
 onClose:()=>{activeMission=null;player?.setActive(mode==='play'&&overlay.hidden);if(state.finished&&mode==='play')beginEnding();else if(state.completed.length===9)toast('결재 9건 완료! 1층 교문 앞에서 마지막 업무를 확인하세요.');}
});

function showPanel(kind,html,wide=false){
 messenger.suspend();
 lastFocus=document.activeElement;overlayKind=kind;overlay.innerHTML=`<section class="panel${wide?' wide':''}" role="dialog" aria-modal="true" aria-labelledby="panel-title">${html}</section>`;overlay.hidden=false;player?.setActive(false);
 overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=closePanel);
 requestAnimationFrame(()=>overlay.querySelector('input,button,select,textarea')?.focus());
}
function closePanel(){overlay.hidden=true;overlay.innerHTML='';overlayKind='';player?.setActive(mode==='play'&&!missions.isOpen());if(lastFocus instanceof HTMLElement&&lastFocus.isConnected)lastFocus.focus()}
const closeButton='<button class="close-button" data-close aria-label="닫기">×</button>';
function guide(){showPanel('guide',`${closeButton}<div class="eyebrow">HOW TO GO HOME</div><h2 id="panel-title">업무는 10개.<br>퇴근은 한 번이면 충분합니다.</h2><p>5층 학교를 걸으며 빛나는 업무 표식에 다가가세요. 미션 1–9는 원하는 순서로, 10번은 마지막에 열립니다. 각 미션을 끝내면 노하우 카드가 가방에 쌓입니다.</p><div class="controls-table"><kbd>W A S D</kbd><span>걷기 · Shift를 누르면 빠르게</span><kbd>마우스 드래그</kbd><span>시선 돌리기 · 방향키로도 회전 가능</span><kbd>E</kbd><span>가까운 NPC · 엘리베이터 살펴보기</span><kbd>F · G</kbd><span>복도 방해꾼에게 한마디 · 뿅망치</span><kbd>🌱 · ✚ · ♧</kbd><span>선택 배움터 · 침대 5개 보건실 · 채널 바꾸기</span><kbd>H · J · M</kbd><span>무료 힌트 · 노하우 가방 · 학교 지도</span><kbd>0 · Esc</kbd><span>1인칭/3인칭 · 일시정지와 설정</span><kbd>태블릿</kbd><span>왼쪽 조이스틱으로 이동 · 화면 드래그로 시선 · 조사 버튼</span></div><div class="notice">길 찾기가 어려우면 <strong>지도에서 장소를 선택해 바로 이동</strong>할 수 있어요. 오답은 예상 퇴근을 5분 늦추지만, 기다리는 벌칙이나 게임오버는 없습니다. 최대 22:00까지 표시됩니다.</div><div class="actions"><button class="primary" data-close>이제 알겠어요 ↗</button></div>`)}
function newGame(){showPanel('new',`${closeButton}<div class="eyebrow">EMPLOYEE CHECK-IN</div><h2 id="panel-title">오늘도 출근하셨군요.</h2><p>가상의 퇴근초등학교에 오신 것을 환영합니다.<br>퇴근 증명서에 넣을 이름 또는 별명을 적어 주세요.</p><label for="teacher-name">오늘의 퇴근 도전자</label><input id="teacher-name" type="text" maxlength="24" autocomplete="off" placeholder="예: 정시퇴근 선생님" value="${esc(state.name==='퇴근희망 교사'?'':state.name)}"><div class="option-row"><label for="start-relaxed">느긋하게 배우기<small>급식실 스피드 퀴즈의 제한 시간을 없앱니다.</small></label><input type="checkbox" id="start-relaxed" ${state.settings.relaxed?'checked':''}></div><div class="notice">게임을 시작하면 채널에 자동 입장해요. 임의 별명과 캐릭터 위치만 공유하며, 증명서 이름과 진행 상황은 이 브라우저에 저장해요. 새 게임은 이전 기록을 교체합니다.</div><div class="actions"><button class="primary" id="confirm-start">출근 도장 찍기 →</button></div>`);
 $('#confirm-start').onclick=()=>{const name=$('#teacher-name').value;const relaxed=$('#start-relaxed').checked;const settings=state.settings;state=freshState(name);state.settings={...settings,relaxed};persist();closePanel();start(false);opening()};
 $('#teacher-name').addEventListener('keydown',e=>{if(e.key==='Enter')$('#confirm-start').click()});}
function opening(){
 const lines=MissionData.STORY?.opening||[];
 showPanel('opening',`<div class="eyebrow">PROLOGUE · 16:10</div><h2 id="panel-title">오늘은 진짜로,<br>제시간에 나간다.</h2>${lines.map(d=>`<p><strong>${esc(d.speaker)}</strong><br>${esc(d.text)}</p>`).join('')}<div class="notice">노하우 카드 10장을 모으면 교문이 열립니다.<br>퇴근을 배우다 보면, 바이브 코딩도 배우게 됩니다.</div><div class="actions"><button class="primary" id="begin-learning">처음이라면 · 배움터 체험</button><button class="secondary" id="begin-walking">이미 알아요 · 바로 시작 ↗</button></div>`);
 $('#begin-learning').onclick=()=>{closePanel();travelToRoom('learning-room');openLearning()};
 $('#begin-walking').onclick=()=>{closePanel();tutorialTime=30;$('#tutorial').hidden=false;audio.unlock();};
}
function start(resume=true){
 if(resume)state=loadGame()||state;
 rest.close();learning.close();channelUI.close();channels?.stop();messenger.reset();
 clearEncounter();world.resetCrowd?.();if(!state.finished)world.reset?.();player.setView(false);player.resetCamera();$('#tutorial-title').textContent='W A S D로 걸어 보세요';$('#tutorial-text').textContent='빛나는 표식이 오늘 처리할 업무입니다.';
 mode='play';$('#home').hidden=true;$('#hud').hidden=false;document.body.classList.add('playing');world.setCompleted(state.completed);world.setFloor(state.floor);player.setFloor(state.floor);teacher.visible=true;applyQuality();audio.setEnabled(state.settings.sound);updateSound();updateHUD();persist();
 if(state.finished)showCertificate();
 else {void channels?.start();if(!storageAvailable())toast('이 브라우저에서는 자동 저장이 제한됩니다. 현재 창을 유지해 주세요.');}
}
function home(){rest.close();learning.close();channelUI.close();channels?.stop();persist();messenger.reset();clearEncounter();arcade.close();closePanel();missions.close();mode='home';$('#social-bar').hidden=true;$('#home').hidden=false;$('#hud').hidden=true;document.body.classList.remove('playing');world.setFloor(null);teacher.visible=false;player.setActive(false);$('#continue-game').hidden=!loadGame();$('#tutorial').hidden=true}
function changeFloor(floor){rest.close();learning.close();clearEncounter();lastSpokenNPC=null;state.floor=floor;world.setFloor(floor);player.setFloor(floor);updateHUD();persist();audio.play('click')}
function elevator(){showPanel('elevator',`${closeButton}<div class="eyebrow">ELEVATOR · 교직원 전용</div><h2 id="panel-title">몇 층 업무부터 처리할까요?</h2><p>층 이동은 무료입니다. 업무만 유료입니다. 당신의 시간으로.</p><div class="elevator-floors">${[5,4,3,2,1].map(f=>`<button data-floor="${f}"><b>${f}F</b><span>${floorNames[f]}</span><small>${state.floor===f?'현재 층':'이동 →'}</small></button>`).join('')}</div>`);$$('[data-floor]').forEach(b=>b.onclick=()=>{changeFloor(Number(b.dataset.floor));closePanel()})}
function openMission(id){
 if(state.completed.includes(id)){showKnowledge(id);return}
 if(id===10&&state.completed.length<9){toast(`교문 결재 대기 · 먼저 1–9번 업무를 마쳐 주세요. (${state.completed.length}/9)`);return}
 messenger.suspend();
 activeMission=id;$('#tutorial').hidden=true;tutorialTime=0;player.setActive(false);audio.play('click');if(id<=3){arcade.open({...MISSIONS.find(m=>m.id===id),runtime:{playSound:type=>audio.play(type)}});}else missions.open(id);
}
function interact(){if(busy())return;updateInteraction();if(nearest?.id==='elevator')elevator();else if(nearest?.kind==='learning')openLearning();else if(nearest?.kind==='bed')lieDown(nearest.id);else if(nearest?.missionId)openMission(nearest.missionId);else toast('빛나는 표식 가까이 다가가세요. 지도(M)에서 바로 이동할 수도 있어요.')}
function showMap(){showPanel('map',`${closeButton}<div class="eyebrow">SCHOOL MAP · FAST TRAVEL</div><h2 id="panel-title">업무 동선은 짧을수록 좋습니다.</h2><p>장소를 누르면 그 방 입구로 이동합니다. 도착 후 NPC에게 다가가 E를 누르세요.</p><div class="campus-room-list"><button data-room="learning-room">🌱 배움터 <small>선택 · 기초부터 3분</small></button><button data-room="nurse-room">✚ 보건실 <small>미션 없음 · 잠깐 쉬기</small></button></div><div class="mission-list">${MISSIONS.map(m=>`<button class="mission-row ${state.completed.includes(m.id)?'done':''} ${m.id===10?'boss':''}" data-go="${m.id}"><span class="number">${String(m.id).padStart(2,'0')}</span><div><h3>${esc(m.id<=3?getArcadeData(m).arcade.title:m.shortTitle||m.title)}</h3><small>${m.floor}F · ${esc(m.room)}</small></div><span class="status">${state.completed.includes(m.id)?'✓ 결재':m.id===10&&state.completed.length<9?'잠김':'→'}</span></button>`).join('')}</div><div class="notice">10번 업무는 1–9번을 모두 완료하면 열립니다. 길을 잃어도 걱정 마세요. 지도 이동에는 벌칙이 없습니다.</div>`,true);
 $$('[data-go]').forEach(b=>b.onclick=()=>travelToMission(+b.dataset.go));$$('[data-room]').forEach(b=>b.onclick=()=>travelToRoom(b.dataset.room))}
function travelToMission(id){const m=MISSIONS.find(m=>m.id===id);if(!m)return;changeFloor(m.floor);const item=world.interactables.find(i=>i.missionId===id);if(item)player.teleport({x:item.x,y:item.y,z:item.z+2.2});closePanel();toast(`${m.room} 도착 · 가까운 표식에서 E를 눌러 주세요.`)}

function repel(kind){if(busy())return;const hit=world.useCorridorAction?.(kind,player.position);if(!hit?.ok){if(hit?.reason!=='cooldown')toast('가까운 복도 방해꾼에게 써 보세요.');return}const anchor=world.getCharacterAnchor(hit.actor);feedback.speak(anchor,hit.text);audio.play(kind==='bonk'?'success':'click');const burst=document.createElement('span');burst.className='corridor-burst';burst.textContent=kind==='bonk'?'뿅! ✦':'차례대로! ✧';document.body.append(burst);setTimeout(()=>burst.remove(),750);}
function lieDown(id){const occupied=presence?.getOccupiedBeds?.()||[];const inUse=occupied.find(b=>b.bedId===id);if(inUse){const free=[1,2,3,4,5].map(n=>'bed-'+n).find(b=>!occupied.some(p=>p.bedId===b));if(!free){wantsChannelRest=true;showTogether();toast('침대가 모두 쉬는 중이에요. 빈 채널로 옮겨 볼까요?');return}toast(`${inUse.nickname} 선생님 옆 빈 침대로 갈게요.`);id=free;}rest.open(id)}
function travelToRoom(id){const room=world.specialRooms.find(r=>r.id===id);if(!room)return;changeFloor(room.floor);player.teleport(room.entry);closePanel();toast(id==='learning-room'?'배움터 도착 · E로 기초 체험':'보건실 도착 · 침대 앞에서 E로 눕기')}
function openLearning(){if(mode!=='play')return;messenger.suspend();tutorialTime=0;$('#tutorial').hidden=true;player.setActive(false);learning.open()}
function onPresenceStatus(next){channels?.handlePresenceStatus(next);}
function onChannelChange(next){
 const label=next.connected?`채널 ${next.selected} · 함께 ${next.count}명`:next.loading?'채널 연결 중…':next.offline?'혼자 쉬는 중':'연결을 확인 중…';
 $('#social-status').textContent=label;$('#social-bar').hidden=mode!=='play';
 $('#social-connect-label').textContent=next.connected?`채널 ${next.selected}`:'채널';
 $$('[data-greet]').forEach(button=>button.disabled=!next.connected);
 channelUI.update(next);
}
function showTogether(){
 if(mode!=='play'||!overlay.hidden||missions.isOpen()||arcade.isOpen()||learning.isOpen()||encounter)return;
 messenger.suspend();player?.setActive(false);channelUI.open(channels.getSnapshot());void channels.refresh();
}
async function reconnectChannels(){const bed=restingBed?.id;const ok=await channels.start();if(ok&&mode==='play'){channelUI.close();if(bed)lieDown(bed);}}
async function selectChannel(id){
 const bed=restingBed?.id||(wantsChannelRest?'bed-1':null);
 const ok=await channels.select(id);
 if(mode!=='play')return;
 if(!ok){if(bed&&channels.getSnapshot().connected)lieDown(bed);return;}
 channelUI.close();
 if(bed)lieDown(bed);
 else toast(`채널 ${id}로 이동했어요. 같은 층의 동료에게 인사해요.`);
}

function cardMarkup(m){return `<article class="knowledge-card"><div class="card-top"><span>KNOW-HOW ${String(m.id).padStart(2,'0')}</span><span>✓ 결재 완료</span></div><h3>${esc(m.card.title.replace(/^\d+\s*·\s*/,''))}</h3><p>${esc(m.card.body)}</p>${m.id<=3?`<details class="knowledge-details"><summary>문항·정답·해설 펼치기</summary>${getKnowledgeDetails(m).map(x=>`<p><strong>${esc(x.question)}</strong>${x.answer?`<br>정답: ${esc(x.answer)}`:''}<br>${esc(x.explanation)}</p>`).join('')}</details>`:''}</article>`}
function showKnowledge(id){const m=MISSIONS.find(m=>m.id===id);showPanel('card',`${closeButton}<div class="eyebrow">KNOW-HOW CARD</div><h2 id="panel-title">이미 훌륭하게 처리한 업무예요.</h2>${cardMarkup(m)}<div class="actions"><button class="primary" data-close>다음 업무로 →</button></div>`)}
function bag(){showPanel('bag',`${closeButton}<div class="eyebrow">MY KNOW-HOW · ${state.completed.length} / 10</div><h2 id="panel-title">퇴근길에 챙겨 갈 것들.</h2><p>어디서나 다시 보는 바이브 코딩 노하우. 수업자료 실습에서도 꺼내 쓰세요.</p><div class="bag-grid">${MISSIONS.map(m=>state.completed.includes(m.id)?cardMarkup(m):`<div class="empty-card">${String(m.id).padStart(2,'0')} · ${esc(m.room)}<br><br>이 업무를 마치면 카드가 열립니다.</div>`).join('')}</div>${state.bossDraft?'<div class="actions"><button class="secondary" id="bag-copy">내 프롬프트 복사하기 ↗</button></div>':''}`,true);if($('#bag-copy'))$('#bag-copy').onclick=copyPrompt}
function hint(){if(learning.isOpen()||rest.isOpen())return;if(arcade.isOpen()){arcade.hint();return}if(missions.isOpen()){missions.hint();return}if(mode!=='play')return;const next=nearest?.missionId?MISSIONS.find(m=>m.id===nearest.missionId):MISSIONS.find(m=>!state.completed.includes(m.id)&&m.floor===state.floor)||MISSIONS.find(m=>!state.completed.includes(m.id));if(next)toast(`${next.room}: ${next.hint}`)}
function pause(){if(mode!=='play'||missions.isOpen()||arcade.isOpen()||learning.isOpen()||rest.isOpen())return;showPanel('pause',`${closeButton}<div class="eyebrow">COFFEE BREAK</div><h2 id="panel-title">잠깐 쉬어도 퇴근은 옵니다.</h2><p>쉬는 동안 플레이 시간도 멈춥니다. 완료한 업무는 자동 저장돼요.</p><div class="option-row"><label for="quality">그래픽 품질<small>학교 PC에서 느리면 '저'를 선택하세요.</small></label><select id="quality"><option value="low">저 · 가볍게</option><option value="medium">중 · 균형</option><option value="high">고 · 선명하게</option></select></div><div class="option-row"><label for="relaxed">느긋하게 배우기<small>급식실 퀴즈의 제한 시간을 없앱니다.</small></label><input id="relaxed" type="checkbox" ${state.settings.relaxed?'checked':''}></div><div class="option-row"><label for="sound-check">효과음<small>직접 만든 짧은 전자음만 사용합니다.</small></label><input id="sound-check" type="checkbox" ${state.settings.sound?'checked':''}></div><div class="actions"><button class="primary" data-close>다시 걸어가기 ↗</button><button class="secondary" id="pause-guide">조작법</button><button class="secondary" id="pause-home">저장하고 첫 화면</button></div>`);
 $('#quality').value=state.settings.quality;$('#quality').onchange=e=>{state.settings.quality=e.target.value;applyQuality();persist()};$('#relaxed').onchange=e=>{state.settings.relaxed=e.target.checked;persist()};$('#sound-check').onchange=e=>{state.settings.sound=e.target.checked;audio.setEnabled(state.settings.sound);updateSound();persist()};$('#pause-home').onclick=home;$('#pause-guide').onclick=guide;
}
function updateHUD(){
 $('#playtime').textContent=time(state.elapsed);
 $('#learning-button').textContent=state.beginnerLearned?'🌱 배움터 ✓':'🌱 배움터';
 $('#floor-label').textContent=state.floor+'F';$('#location-title').textContent=floorNames[state.floor];$('#progress-label').textContent=`${state.completed.length} / 10`;
 $('#progress-stamps').innerHTML=MISSIONS.map(m=>`<span class="stamp ${m.id===10?'boss':''} ${state.completed.includes(m.id)?'done':''}" title="${esc(m.title)}"></span>`).join('');
 $('#progress-caption').textContent=state.completed.length===9?'교문 앞 최종 업무가 열렸습니다.':state.completed.length===10?'모든 업무가 결재되었습니다.':'도장 10개를 모으면 교문이 열립니다.';
 $('#objective').textContent=state.completed.length===9?'1층 교문 앞에서 마지막 결재를 받으세요.':'빛나는 표식에 다가가 E를 누르세요.';$('#departure').textContent=departure();$('#bag-count').textContent=state.completed.length;
 $('#floor-buttons').innerHTML=[5,4,3,2,1].map(f=>`<button class="${state.floor===f?'active':''}" data-rail-floor="${f}" aria-label="${f}층 지도">${f}<em>F</em></button>`).join('');$$('[data-rail-floor]').forEach(b=>b.onclick=()=>{if(busy())return;elevator()});
}
function updateSound(){$$('.sound-toggle').forEach(b=>{b.querySelector('span').textContent=state.settings.sound?'ON':'OFF';b.setAttribute('aria-label',state.settings.sound?'소리 끄기':'소리 켜기')})}
function applyQuality(){const quality=state.settings.quality;renderer.setPixelRatio(renderer.isSoftware?(quality==='low'?.65:quality==='high'?1:.85):Math.min(devicePixelRatio,quality==='low'?1:quality==='high'?2:1.35));renderer.shadowMap.enabled=quality!=='low'&&!renderer.isSoftware;sun.shadow.mapSize.set(quality==='high'?2048:1024,quality==='high'?2048:1024);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}renderer.setSize(innerWidth,innerHeight);scene.traverse(o=>{if(o.material)o.material.needsUpdate=true})}
async function copyPrompt(){const ok=await copyText(state.bossDraft);toast(ok?'프롬프트를 복사했습니다. AI 대화창에 붙여 넣고 실습을 시작하세요.':'복사가 제한되었습니다. 아래 프롬프트를 길게 눌러 복사해 주세요.')}
function beginEnding(){rest.close();learning.close();channelUI.close();channels?.stop();messenger.reset();clearEncounter();arcade.close();missions.close();closePanel();mode='ending';$('#social-bar').hidden=true;endingTime=0;$('#hud').hidden=true;$('#ending-caption').hidden=false;world.setFloor(null);world.openGate();world.car.position.set(7,0,22);world.car.rotation.y=Math.PI/2;teacher.visible=false;player.setActive(false);audio.play('ending');persist()}
function showCertificate(){mode='certificate';$('#ending-caption').hidden=true;$('#hud').hidden=true;player.setActive(false);
 showPanel('certificate',`<div class="certificate-header"><div class="seal">↗</div><div class="eyebrow" style="justify-content:center;margin-top:20px">OFFICIALLY OFF DUTY</div><h2 id="panel-title">퇴근 증명서</h2><p><strong>${esc(state.name.endsWith('선생님')?state.name:state.name+' 선생님')}</strong>,<br>업무 10건을 모두 처리하셨습니다.<br>이제 당신의 저녁으로 돌아가세요.</p></div><div class="end-stats"><div><small>실제 플레이</small><strong>${time(state.elapsed)}</strong></div><div><small>게임 속 퇴근</small><strong>${departure()}</strong></div><div><small>모은 노하우</small><strong>10 / 10</strong></div></div><p class="notice">${esc(MissionData.STORY?.ending?.[0]||'오늘 배운 내용을 내일의 수업으로. 마지막 단계는 저장하고 퇴근하기입니다.')}</p><div class="actions"><button class="primary" id="download-certificate">퇴근 증명서 이미지 저장 ↓</button><button class="secondary" id="copy-final">내 프롬프트 복사 ↗</button></div><label for="final-prompt">실습에 바로 쓰는 나의 프롬프트</label><textarea id="final-prompt" readonly>${esc(state.bossDraft)}</textarea><p>아래 프롬프트는 내가 작성한 요청문입니다. 실제 교육자료 생성·실행·내용 검증은 이어지는 실습에서 진행해 주세요.</p><div class="bag-grid">${MISSIONS.map(cardMarkup).join('')}</div><div class="actions"><button class="secondary" id="end-home">첫 화면으로</button><button class="secondary" id="end-replay">다시 도전하기</button></div>`,true);
 $('#download-certificate').onclick=async()=>{try{await downloadCertificate(state,MISSIONS);toast('퇴근 증명서를 PNG 이미지로 저장했습니다.')}catch{toast('이미지 저장이 제한됩니다. 현재 화면을 캡처해 주세요.')}};$('#copy-final').onclick=copyPrompt;$('#end-home').onclick=home;$('#end-replay').onclick=newGame;
}
function init(){
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){try{renderer=new SoftwareRenderer({canvas});console.info('WebGL unavailable: using Canvas 3D compatibility renderer.')}catch(fallbackError){$('#boot-error').hidden=false;$('#boot-error').innerHTML='<h2>3D 화면을 열 수 없어요.</h2><p>Chrome·Edge·웨일에서 하드웨어 가속을 켜고 다시 실행해 주세요. 이 게임은 WebGL을 사용하는 3D 게임입니다.</p>';console.error(error,fallbackError);return}}
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene=new THREE.Scene();scene.background=new THREE.Color('#e9eadb');scene.fog=new THREE.Fog('#e9eadb',70,170);
 camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,220);
 ambient=new THREE.HemisphereLight('#fff1d5','#749888',2.7);scene.add(ambient);
 sun=new THREE.DirectionalLight('#ffdbac',3.1);sun.position.set(-18,42,28);sun.castShadow=true;sun.shadow.camera.left=-42;sun.shadow.camera.right=42;sun.shadow.camera.top=42;sun.shadow.camera.bottom=-42;sun.shadow.camera.near=1;sun.shadow.camera.far=100;sun.shadow.bias=-.00045;sun.shadow.normalBias=.04;scene.add(sun);
 const fill=new THREE.DirectionalLight('#b9d7d0',1);fill.position.set(25,16,-18);scene.add(fill);
 world=createWorld(scene);feedback=createWorldFeedback({camera});teacher=world.createTeacher('#d9bc75');scene.add(teacher);teacher.visible=false;
 player=createPlayer({camera,canvas,model:teacher,world,onMove:()=>{}});player.setActive(false);world.setFloor(null);applyQuality();updateSound();$('#continue-game').hidden=!loadGame();
 presence=createPresence({scene,world,camera,endpoint:PRESENCE_ENDPOINT,getLocal:()=>({x:player.position.x,y:player.position.y,z:player.position.z,yaw:teacher.rotation.y,floor:state.floor,action:rest.isOpen()?'rest':learning.isOpen()?'learn':activeMission?'mission':player.moving?'walk':'idle',bedId:restingBed?.id}),onStatus:onPresenceStatus,onGreeting:({nickname,text})=>{if(!busy())toast(`${nickname}: ${text}`)}});
 channels=createChannels({presence,endpoint:PRESENCE_ENDPOINT,getNickname:()=>onlineNickname,onChange:onChannelChange,onBeforeSwitch:()=>{if(rest.isOpen())rest.close();}});
 window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();persist();toast('그래픽 연결이 잠시 끊겼어요. 새로고침하면 저장한 진행으로 이어 할 수 있습니다.')});
 requestAnimationFrame(loop);
}
function updateInteraction(){
 nearest=null;let dist=3.0;for(const item of world.interactables){const d=Math.hypot(player.position.x-item.x,player.position.z-item.z);if(d<dist){dist=d;nearest=item}}
 $('#interaction').hidden=!nearest||busy();if(nearest){$('#interact-kind').textContent=nearest.kind==='learning'?'선택형 기초 체험':nearest.kind==='bed'?'미션 없는 휴식':nearest.id==='elevator'?'층 이동':state.completed.includes(nearest.missionId)?'결재 완료 · 노하우 다시 보기':nearest.missionId===10?'최종 결재':'업무 접수';$('#interact-label').textContent=nearest.label}
}
function loop(ms){requestAnimationFrame(loop);const elapsedDt=Math.min(1,(ms-(frame||ms))/1000);const dt=Math.min(.05,elapsedDt);frame=ms;const t=ms/1000;
 if(mode==='home'){
  const pos=world.heroCamera.clone();pos.x+=reduced?0:Math.sin(t*.11)*1.2;camera.position.copy(pos);
  const target=world.heroTarget.clone();const offset=innerWidth<800?8:14;target.x-=offset;target.y+=innerWidth<800?2:0;camera.lookAt(target);
 }else if(mode==='play'){
  if(encounter&&!document.hidden&&overlay.hidden&&!missions.isOpen()&&!arcade.isOpen()){
   encounter.remaining-=elapsedDt;
   if(encounter.type==='principal')player.focusOn(encounter.actor,dt);
   else teacher.rotation.z=Math.sin(encounter.remaining*25)*.17;
   feedback.status(encounter.type,encounter.remaining);
   if(encounter.remaining<=0){encounter=null;teacher.rotation.z=0;document.body.classList.remove('stumbling');}
  }
  const active=!busy();player.setActive(active);player.update(dt,active);
  if(restingBed){const distance=Math.max(16,7.2/(Math.tan(camera.fov*Math.PI/360)*camera.aspect));camera.position.set(20.1,1+Math.sin(.7)*distance,-1.4+Math.cos(.7)*distance);camera.lookAt(20.1,1,-1.4);}
  world.updateCrowd(dt,{position:player.position,floor:state.floor,enabled:active,onEvent:onCrowdEvent});
  if(active&&!encounter){npcSpeechClock-=elapsedDt;const near=world.interactables.find(i=>i.missionId&&Math.hypot(player.position.x-i.x,player.position.z-i.z)<2.6);if(near&&(lastSpokenNPC!==near.missionId||npcSpeechClock<=0)){lastSpokenNPC=near.missionId;npcSpeechClock=14;feedback.speak(()=>world.getNPCAnchor(near.missionId),NPC_LINES[near.missionId]||['퇴근 전에 이것만요!']);}}if(!document.hidden&&overlay.hidden&&!rest.isOpen()&&!learning.isOpen()&&!channelUI.isOpen()){state.elapsed+=elapsedDt;$('#playtime').textContent=time(state.elapsed);saveClock+=dt;if(saveClock>4){persist();saveClock=0}}
  if(tutorialTime>0&&active){tutorialTime-=elapsedDt;$('#tutorial-time').textContent=Math.ceil(tutorialTime)+'초';if(tutorialTime<20){$('#tutorial-title').textContent='화면을 드래그해 둘러보세요';$('#tutorial-text').textContent='빛나는 업무 표식에 가까이 가서 E를 눌러 보세요.'}if(tutorialTime<10){$('#tutorial-title').textContent='길을 잃으면 M · 힌트는 H';$('#tutorial-text').textContent='지도에서 바로 이동할 수 있어요. 모은 카드는 J로 다시 봅니다.'}if(tutorialTime<=0)$('#tutorial').hidden=true}updateInteraction();
 }else if(mode==='ending'){
  endingTime+=elapsedDt;const p=Math.min(1,endingTime/5);world.car.position.x=7+p*30;camera.position.set(31+p*8,15,37);camera.lookAt(8+p*16,2,20);if(endingTime>5.5)showCertificate();
 }
 if(mode!=='home'){const target=Math.min(.7,state.penalty/320);nightAmount+=(target-nightAmount)*dt*.4;const c=new THREE.Color('#e9eadb').lerp(new THREE.Color('#445470'),nightAmount);scene.background.copy(c);scene.fog.color.copy(c);ambient.intensity=2.7-nightAmount*1.6;sun.intensity=3.1-nightAmount*2.5;}else{scene.background.set('#e9eadb');scene.fog.color.set('#e9eadb');ambient.intensity=2.7;sun.intensity=3.1;}
 rest.update(elapsedDt);channels?.update(elapsedDt,{visible:mode==='play'&&!document.hidden});presence?.update(elapsedDt,{visible:mode==='play'&&overlay.hidden&&!missions.isOpen()&&!arcade.isOpen()&&!learning.isOpen()&&!document.hidden,floor:state.floor});
 if(restingBed){const conflict=presence?.getBedConflict?.(restingBed.id);if(conflict){rest.close();if(conflict.freeBedId)lieDown(conflict.freeBedId);toast(conflict.freeBedId?'같이 눕다가 겹쳤네요. 옆 빈 침대로 이동했어요.':'침대가 모두 쉬는 중이에요. 잠깐만 기다려 주세요.');}}
 world.update(dt,t,state.completed);if(!arcade.isOpen())renderer.render(scene,camera);feedback?.update(elapsedDt,mode==='play'&&overlay.hidden&&!missions.isOpen()&&!arcade.isOpen()&&!document.hidden);
 messenger.update(elapsedDt,!busy()&&tutorialTime<=0&&!state.finished);
}
$('#talk-button').onclick=()=>repel('talk');$('#bonk-button').onclick=()=>repel('bonk');
$('#learning-button').onclick=()=>{if(!busy()){travelToRoom('learning-room');openLearning()}};$('#nurse-button').onclick=()=>{if(!busy())travelToRoom('nurse-room')};$('#together-button').onclick=showTogether;$('#social-channel-button').onclick=showTogether;$$('[data-greet]').forEach(b=>b.onclick=()=>{if(mode==='play')presence?.greet(b.dataset.greet)});
$('#start').onclick=newGame;$('#continue-game').onclick=()=>start(true);$('#home-guide').onclick=guide;$('#pause-button').onclick=pause;$('#map-button').onclick=()=>{if(!busy())showMap()};$('#bag-button').onclick=()=>{if(!busy())bag()};$('#hint-button').onclick=hint;$('#interact-button').onclick=interact;$('#touch-interact').onclick=interact;$('#tutorial-skip').onclick=()=>{tutorialTime=0;$('#tutorial').hidden=true};
$$('.sound-toggle').forEach(b=>b.onclick=()=>{state.settings.sound=!state.settings.sound;audio.setEnabled(state.settings.sound);audio.unlock();audio.play('click');updateSound();persist()});
window.addEventListener('keydown',e=>{
 const input=e.target.closest?.('input,textarea,select,[contenteditable=true]');
 if(e.key==='Tab'&&(!overlay.hidden||missions.isOpen()||arcade.isOpen())){const root=arcade.isOpen()?$('#minigame-overlay'):missions.isOpen()?$('#mission-overlay'):overlay;const focusable=[...root.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea,select,[tabindex="0"]')].filter(x=>x.offsetParent!==null);if(focusable.length){const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}
 if(e.code==='Escape'){if(channelUI.isOpen()){channelUI.close();return}if(rest.isOpen()){rest.close();return}if(learning.isOpen()){learning.close();return}if(arcade.isOpen()){arcade.close();return}if(missions.isOpen()){missions.close();activeMission=null;if(!state.finished)player.setActive(true)}else if(!overlay.hidden&&overlayKind!=='certificate'&&overlayKind!=='opening')closePanel();else if(messenger.isOpen())messenger.dismiss();else pause();return}
 if(input||e.repeat)return;
 if(!input&&e.code==='KeyH'&&mode==='play'){e.preventDefault();hint();return}
 if(busy())return;
 if(e.code==='KeyF'){e.preventDefault();repel('talk')}else if(e.code==='KeyG'){e.preventDefault();repel('bonk')}else if(e.code==='KeyE'){e.preventDefault();interact()}else if(e.code==='KeyJ'){e.preventDefault();bag()}else if(e.code==='KeyM'){e.preventDefault();showMap()}else if(e.code==='Digit0'){player.setView(!player.firstPerson);toast(player.firstPerson?'1인칭 · 드래그로 둘러보세요.':'3인칭 · 선생님을 따라가는 시점')}else if(e.code==='KeyP')pause();
});
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();messenger.suspend();player?.setActive(false)}});
init();
